import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, generalReadProcedure, adminProcedure } from "@/server/api/trpc";
import { handleUniqueError } from "@/server/api/errors";
import { listParamsSchema, idSchema } from "@/lib/validators/common";
import {
  competencyInputSchema,
  competencyUpdateSchema,
  competencyImportSchema,
  competencyGenerateSaveSchema,
} from "@/lib/validators/competency";
import { COMPETENCY_TYPES } from "@/lib/enums";
import { isAiEnabled, generateCompetencies } from "@/server/services/ai";

const listSchema = listParamsSchema.extend({
  type: z.enum(COMPETENCY_TYPES).optional(),
});

export const competencyRouter = createTRPCRouter({
  list: generalReadProcedure.input(listSchema).query(async ({ ctx, input }) => {
    return ctx.db.competency.findMany({
      where: {
        ...(input.type ? { type: input.type } : {}),
        ...(input.search
          ? { name: { contains: input.search, mode: "insensitive" } }
          : {}),
      },
      orderBy: [{ isShared: "desc" }, { type: "asc" }, { name: "asc" }],
      take: input.take,
      skip: input.skip,
    });
  }),

  /** Minimal list for job-form multi-select. */
  options: generalReadProcedure.query(async ({ ctx }) => {
    return ctx.db.competency.findMany({
      select: { id: true, name: true, type: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });
  }),

  create: adminProcedure.input(competencyInputSchema).mutation(async ({ ctx, input }) => {
    try {
      return await ctx.db.competency.create({ data: input });
    } catch (err) {
      handleUniqueError(err, "توجد جدارة بنفس الاسم بالفعل.");
    }
  }),

  update: adminProcedure.input(competencyUpdateSchema).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    try {
      return await ctx.db.competency.update({ where: { id }, data });
    } catch (err) {
      handleUniqueError(err, "توجد جدارة بنفس الاسم بالفعل.");
    }
  }),

  delete: adminProcedure.input(z.object({ id: idSchema })).mutation(async ({ ctx, input }) => {
    const competency = await ctx.db.competency.findUnique({
      where: { id: input.id },
      select: { isShared: true },
    });
    if (!competency) throw new TRPCError({ code: "NOT_FOUND" });
    if (competency.isShared) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "لا يمكن حذف الجدارات المشتركة المستخدمة في التقييم.",
      });
    }
    await ctx.db.competency.delete({ where: { id: input.id } });
    return { id: input.id };
  }),

  /** Whether AI generation is configured (no secrets exposed). */
  aiEnabled: adminProcedure.query(() => isAiEnabled()),

  /** AI-suggest competencies from a job's name + description (not persisted). */
  generate: adminProcedure
    .input(z.object({ jobId: idSchema }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.db.job.findUnique({
        where: { id: input.jobId },
        select: { name: true, description: true },
      });
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      return generateCompetencies({ name: job.name, description: job.description });
    }),

  /** Persist selected AI competencies (upsert by name) and link them to the job. */
  saveGenerated: adminProcedure
    .input(competencyGenerateSaveSchema)
    .mutation(async ({ ctx, input }) => {
      let created = 0;
      let linked = 0;
      for (const c of input.competencies) {
        let comp = await ctx.db.competency.findUnique({ where: { name: c.name }, select: { id: true } });
        if (!comp) {
          comp = await ctx.db.competency.create({
            data: {
              name: c.name,
              type: c.type,
              level: c.level,
              description: c.description ?? null,
              indicators: c.indicators ?? null,
            },
            select: { id: true },
          });
          created += 1;
        }
        const existingLink = await ctx.db.jobCompetency.findUnique({
          where: { jobId_competencyId: { jobId: input.jobId, competencyId: comp.id } },
          select: { id: true },
        });
        if (!existingLink) {
          await ctx.db.jobCompetency.create({ data: { jobId: input.jobId, competencyId: comp.id } });
          linked += 1;
        }
      }
      return { created, linked, total: input.competencies.length };
    }),

  /** Bulk import from a spreadsheet. Upserts by name. */
  import: adminProcedure.input(competencyImportSchema).mutation(async ({ ctx, input }) => {
    let created = 0;
    let updated = 0;
    for (const row of input.rows) {
      const existing = await ctx.db.competency.findUnique({ where: { name: row.name } });
      if (existing) {
        // Never repurpose a shared competency via import.
        if (existing.isShared) continue;
        await ctx.db.competency.update({ where: { id: existing.id }, data: row });
        updated += 1;
      } else {
        await ctx.db.competency.create({ data: row });
        created += 1;
      }
    }
    return { created, updated, total: input.rows.length };
  }),
});
