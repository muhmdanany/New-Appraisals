import { z } from "zod";

import { createTRPCRouter, generalReadProcedure, adminProcedure } from "@/server/api/trpc";
import { handleUniqueError } from "@/server/api/errors";
import { idSchema } from "@/lib/validators/common";
import { gradeInputSchema, gradeUpdateSchema, gradeImportSchema } from "@/lib/validators/grade";

/** Build the Prisma create payload for a grade's salary/decimal fields. */
function gradeScalars(input: z.infer<typeof gradeInputSchema>) {
  const { levels: _levels, salaryMin, salaryMax, ...rest } = input;
  return {
    ...rest,
    salaryMin: salaryMin ?? null,
    salaryMax: salaryMax ?? null,
  };
}

export const gradeRouter = createTRPCRouter({
  list: generalReadProcedure.query(async ({ ctx }) => {
    const grades = await ctx.db.grade.findMany({
      include: { levels: { orderBy: { level: "asc" } }, _count: { select: { jobs: true } } },
    });
    // Sort numerically by grade number ("1".."15").
    return grades.sort((a, b) => Number(a.num) - Number(b.num));
  }),

  byId: generalReadProcedure.input(z.object({ id: idSchema })).query(async ({ ctx, input }) => {
    return ctx.db.grade.findUnique({
      where: { id: input.id },
      include: { levels: { orderBy: { level: "asc" } } },
    });
  }),

  /** Minimal list for job-form select. */
  options: generalReadProcedure.query(async ({ ctx }) => {
    const grades = await ctx.db.grade.findMany({ select: { id: true, num: true, name: true } });
    return grades.sort((a, b) => Number(a.num) - Number(b.num));
  }),

  create: adminProcedure.input(gradeInputSchema).mutation(async ({ ctx, input }) => {
    try {
      return await ctx.db.grade.create({
        data: { ...gradeScalars(input), levels: { create: input.levels } },
      });
    } catch (err) {
      handleUniqueError(err, "رقم الدرجة مستخدم بالفعل.");
    }
  }),

  update: adminProcedure.input(gradeUpdateSchema).mutation(async ({ ctx, input }) => {
    const { id, levels } = input;
    try {
      return await ctx.db.$transaction(async (tx) => {
        await tx.gradeLevel.deleteMany({ where: { gradeId: id } });
        return tx.grade.update({
          where: { id },
          data: { ...gradeScalars(input), levels: { create: levels } },
        });
      });
    } catch (err) {
      handleUniqueError(err, "رقم الدرجة مستخدم بالفعل.");
    }
  }),

  delete: adminProcedure.input(z.object({ id: idSchema })).mutation(async ({ ctx, input }) => {
    await ctx.db.grade.delete({ where: { id: input.id } });
    return { id: input.id };
  }),

  /** Bulk import — upserts each grade (with its levels) by grade number. */
  import: adminProcedure.input(gradeImportSchema).mutation(async ({ ctx, input }) => {
    let created = 0;
    let updated = 0;
    for (const grade of input.rows) {
      const existing = await ctx.db.grade.findUnique({ where: { num: grade.num }, select: { id: true } });
      if (existing) {
        await ctx.db.$transaction([
          ctx.db.gradeLevel.deleteMany({ where: { gradeId: existing.id } }),
          ctx.db.grade.update({
            where: { id: existing.id },
            data: { ...gradeScalars(grade), levels: { create: grade.levels } },
          }),
        ]);
        updated += 1;
      } else {
        await ctx.db.grade.create({
          data: { ...gradeScalars(grade), levels: { create: grade.levels } },
        });
        created += 1;
      }
    }
    return { created, updated, total: input.rows.length };
  }),
});
