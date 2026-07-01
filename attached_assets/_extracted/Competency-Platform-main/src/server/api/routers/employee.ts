import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, hrReadProcedure, adminProcedure } from "@/server/api/trpc";
import { handleUniqueError } from "@/server/api/errors";
import { listParamsSchema, idSchema } from "@/lib/validators/common";
import {
  employeeInputSchema,
  employeeUpdateSchema,
  employeeImportSchema,
} from "@/lib/validators/employee";
import { visibleEmployeeIds } from "@/server/services/rbac";

const employeeSelect = {
  id: true,
  employeeNumber: true,
  name: true,
  extraFields: true,
  job: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  grade: { select: { id: true, num: true, name: true } },
  manager: { select: { id: true, name: true, employeeNumber: true } },
} as const;

export const employeeRouter = createTRPCRouter({
  /** Roster, scoped to what the current user may see (org-wide for ADMIN/HR). */
  list: hrReadProcedure.input(listParamsSchema).query(async ({ ctx, input }) => {
    const ids = await visibleEmployeeIds(ctx.db, ctx.session.user);
    return ctx.db.employee.findMany({
      where: {
        ...(ids !== null ? { id: { in: ids } } : {}),
        ...(input.search
          ? {
              OR: [
                { name: { contains: input.search, mode: "insensitive" } },
                { employeeNumber: { contains: input.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: employeeSelect,
      orderBy: { name: "asc" },
      take: input.take,
      skip: input.skip,
    });
  }),

  byId: hrReadProcedure.input(z.object({ id: idSchema })).query(async ({ ctx, input }) => {
    const ids = await visibleEmployeeIds(ctx.db, ctx.session.user);
    if (ids !== null && !ids.includes(input.id)) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const employee = await ctx.db.employee.findUnique({ where: { id: input.id }, select: employeeSelect });
    if (!employee) throw new TRPCError({ code: "NOT_FOUND" });
    return employee;
  }),

  /** Manager-select options (used by ADMIN forms) — all employees. */
  options: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.employee.findMany({
      select: { id: true, name: true, employeeNumber: true },
      orderBy: { name: "asc" },
    });
  }),

  create: adminProcedure.input(employeeInputSchema).mutation(async ({ ctx, input }) => {
    try {
      return await ctx.db.employee.create({
        data: {
          name: input.name,
          employeeNumber: input.employeeNumber,
          jobId: input.jobId || null,
          departmentId: input.departmentId || null,
          gradeId: input.gradeId || null,
          managerId: input.managerId || null,
          extraFields: input.extraFields,
        },
      });
    } catch (err) {
      handleUniqueError(err, "الرقم الوظيفي مستخدم بالفعل.");
    }
  }),

  update: adminProcedure.input(employeeUpdateSchema).mutation(async ({ ctx, input }) => {
    const { id } = input;
    if (input.managerId && input.managerId === id) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن أن يكون الموظف مديراً لنفسه." });
    }
    try {
      return await ctx.db.employee.update({
        where: { id },
        data: {
          name: input.name,
          employeeNumber: input.employeeNumber,
          jobId: input.jobId || null,
          departmentId: input.departmentId || null,
          gradeId: input.gradeId || null,
          managerId: input.managerId || null,
          extraFields: input.extraFields,
        },
      });
    } catch (err) {
      handleUniqueError(err, "الرقم الوظيفي مستخدم بالفعل.");
    }
  }),

  delete: adminProcedure.input(z.object({ id: idSchema })).mutation(async ({ ctx, input }) => {
    await ctx.db.employee.delete({ where: { id: input.id } });
    return { id: input.id };
  }),

  /**
   * Bulk import. Two passes: (1) upsert all employees by number with their core
   * fields + dynamic extra fields; (2) resolve and link managers by number (so a
   * manager defined in the same file is found).
   */
  import: adminProcedure.input(employeeImportSchema).mutation(async ({ ctx, input }) => {
    const [jobs, departments, grades] = await Promise.all([
      ctx.db.job.findMany({ select: { id: true, name: true } }),
      ctx.db.department.findMany({ select: { id: true, name: true } }),
      ctx.db.grade.findMany({ select: { id: true, num: true } }),
    ]);
    const jobByName = new Map(jobs.map((j) => [j.name, j.id]));
    const deptByName = new Map(departments.map((d) => [d.name, d.id]));
    const gradeByNum = new Map(grades.map((g) => [g.num, g.id]));

    let created = 0;
    let updated = 0;

    // Pass 1 — upsert core fields.
    for (const row of input.rows) {
      const data = {
        name: row.name,
        jobId: row.jobName ? (jobByName.get(row.jobName) ?? null) : null,
        departmentId: row.departmentName ? (deptByName.get(row.departmentName) ?? null) : null,
        gradeId: row.gradeNum ? (gradeByNum.get(row.gradeNum) ?? null) : null,
        extraFields: row.extraFields,
      };
      const existing = await ctx.db.employee.findUnique({
        where: { employeeNumber: row.employeeNumber },
        select: { id: true },
      });
      if (existing) {
        await ctx.db.employee.update({ where: { id: existing.id }, data });
        updated += 1;
      } else {
        await ctx.db.employee.create({ data: { ...data, employeeNumber: row.employeeNumber } });
        created += 1;
      }
    }

    // Pass 2 — resolve managers by employee number.
    const numbers = input.rows.map((r) => r.employeeNumber);
    const all = await ctx.db.employee.findMany({
      where: { employeeNumber: { in: numbers } },
      select: { id: true, employeeNumber: true },
    });
    const idByNumber = new Map(all.map((e) => [e.employeeNumber, e.id]));
    let linked = 0;
    for (const row of input.rows) {
      if (!row.managerNumber) continue;
      const selfId = idByNumber.get(row.employeeNumber);
      const managerId = idByNumber.get(row.managerNumber) ?? null;
      if (!selfId || managerId === selfId) continue;
      await ctx.db.employee.update({ where: { id: selfId }, data: { managerId } });
      linked += 1;
    }

    return { created, updated, linked, total: input.rows.length };
  }),
});
