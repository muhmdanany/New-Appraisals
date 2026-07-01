import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, generalReadProcedure, adminProcedure } from "@/server/api/trpc";
import { listParamsSchema, idSchema } from "@/lib/validators/common";
import { jobInputSchema, jobUpdateSchema, jobImportSchema } from "@/lib/validators/job";
import { isAiEnabled, generateJobDescription } from "@/server/services/ai";
import { optionalText } from "@/lib/validators/common";

export const jobRouter = createTRPCRouter({
  list: generalReadProcedure.input(listParamsSchema).query(async ({ ctx, input }) => {
    return ctx.db.job.findMany({
      where: input.search
        ? { name: { contains: input.search, mode: "insensitive" } }
        : undefined,
      select: {
        id: true,
        name: true,
        contractType: true,
        experienceLevel: true,
        department: { select: { id: true, name: true } },
        grade: { select: { id: true, num: true, name: true } },
        competencies: { select: { competency: { select: { name: true } } } },
        _count: { select: { competencies: true } },
      },
      orderBy: { name: "asc" },
      take: input.take,
      skip: input.skip,
    });
  }),

  byId: generalReadProcedure.input(z.object({ id: idSchema })).query(async ({ ctx, input }) => {
    const job = await ctx.db.job.findUnique({
      where: { id: input.id },
      include: { competencies: { select: { competencyId: true } } },
    });
    if (!job) throw new TRPCError({ code: "NOT_FOUND" });
    const { competencies, ...rest } = job;
    return { ...rest, competencyIds: competencies.map((c) => c.competencyId) };
  }),

  create: adminProcedure.input(jobInputSchema).mutation(async ({ ctx, input }) => {
    const { competencyIds, departmentId, gradeId, reportsToJobId, ...rest } = input;
    return ctx.db.job.create({
      data: {
        ...rest,
        departmentId: departmentId || null,
        gradeId: gradeId || null,
        reportsToJobId: reportsToJobId || null,
        competencies: { create: competencyIds.map((competencyId) => ({ competencyId })) },
      },
    });
  }),

  update: adminProcedure.input(jobUpdateSchema).mutation(async ({ ctx, input }) => {
    const { id, competencyIds, departmentId, gradeId, reportsToJobId, ...rest } = input;
    if (reportsToJobId && reportsToJobId === id) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن أن ترتبط الوظيفة برئاسة نفسها." });
    }
    return ctx.db.$transaction(async (tx) => {
      await tx.jobCompetency.deleteMany({ where: { jobId: id } });
      return tx.job.update({
        where: { id },
        data: {
          ...rest,
          departmentId: departmentId || null,
          gradeId: gradeId || null,
          reportsToJobId: reportsToJobId || null,
          competencies: { create: competencyIds.map((competencyId) => ({ competencyId })) },
        },
      });
    });
  }),

  /** Whether AI generation is configured. */
  aiEnabled: adminProcedure.query(() => isAiEnabled()),

  /** AI-generate a job description from the current form values (not persisted). */
  generateDescription: adminProcedure
    .input(
      z.object({
        name: z.string().trim().min(2).max(200),
        competencyNames: z.array(z.string()).default([]),
        departmentName: optionalText(200),
        gradeName: optionalText(200),
      }),
    )
    .mutation(async ({ input }) => {
      const description = await generateJobDescription({
        name: input.name,
        competencies: input.competencyNames,
        department: input.departmentName,
        grade: input.gradeName,
      });
      return { description };
    }),

  /** Full job profile for PDF export. */
  profile: generalReadProcedure.input(z.object({ id: idSchema })).query(async ({ ctx, input }) => {
    const job = await ctx.db.job.findUnique({
      where: { id: input.id },
      select: {
        name: true,
        description: true,
        experienceLevel: true,
        department: { select: { name: true } },
        grade: { select: { num: true, name: true } },
        reportsTo: { select: { name: true } },
        competencies: { select: { competency: { select: { name: true, type: true } } } },
        kpiSet: {
          select: {
            groups: {
              orderBy: { order: "asc" },
              select: {
                competencyName: true,
                kpis: {
                  orderBy: { order: "asc" },
                  select: { name: true, measure: true, target: true, weight: true },
                },
              },
            },
          },
        },
      },
    });
    if (!job) throw new TRPCError({ code: "NOT_FOUND" });
    return job;
  }),

  delete: adminProcedure.input(z.object({ id: idSchema })).mutation(async ({ ctx, input }) => {
    await ctx.db.job.delete({ where: { id: input.id } });
    return { id: input.id };
  }),

  import: adminProcedure.input(jobImportSchema).mutation(async ({ ctx, input }) => {
    const [departments, grades, competencies] = await Promise.all([
      ctx.db.department.findMany({ select: { id: true, name: true } }),
      ctx.db.grade.findMany({ select: { id: true, num: true } }),
      ctx.db.competency.findMany({ select: { id: true, name: true } }),
    ]);
    const deptByName = new Map(departments.map((d) => [d.name, d.id]));
    const gradeByNum = new Map(grades.map((g) => [g.num, g.id]));
    const compByName = new Map(competencies.map((c) => [c.name, c.id]));

    let created = 0;
    let updated = 0;
    for (const row of input.rows) {
      const departmentId = row.departmentName ? (deptByName.get(row.departmentName) ?? null) : null;
      const gradeId = row.gradeNum ? (gradeByNum.get(row.gradeNum) ?? null) : null;
      const competencyIds = row.competencyNames
        .map((n) => compByName.get(n))
        .filter((id): id is string => Boolean(id));

      const existing = await ctx.db.job.findFirst({ where: { name: row.name }, select: { id: true } });
      const data = {
        name: row.name,
        departmentId,
        gradeId,
        contractType: row.contractType,
        experienceLevel: row.experienceLevel ?? null,
        description: row.description ?? null,
      };
      if (existing) {
        await ctx.db.$transaction([
          ctx.db.jobCompetency.deleteMany({ where: { jobId: existing.id } }),
          ctx.db.job.update({
            where: { id: existing.id },
            data: { ...data, competencies: { create: competencyIds.map((competencyId) => ({ competencyId })) } },
          }),
        ]);
        updated += 1;
      } else {
        await ctx.db.job.create({
          data: { ...data, competencies: { create: competencyIds.map((competencyId) => ({ competencyId })) } },
        });
        created += 1;
      }
    }
    return { created, updated, total: input.rows.length };
  }),
});
