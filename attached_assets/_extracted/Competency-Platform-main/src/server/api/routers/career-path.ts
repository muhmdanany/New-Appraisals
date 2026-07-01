import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, generalReadProcedure, adminProcedure } from "@/server/api/trpc";
import { idSchema } from "@/lib/validators/common";
import {
  careerPathInputSchema,
  careerPathUpdateSchema,
  careerPathGenerateSchema,
} from "@/lib/validators/career-path";
import { isAiEnabled, generateCareerPath } from "@/server/services/ai";
import type { CareerPathInput } from "@/lib/validators/career-path";

/** Build nested stage create payload with order indices. */
function stageCreate(stages: CareerPathInput["stages"]) {
  return stages.map((s, i) => ({
    order: i + 1,
    title: s.title,
    level: s.level,
    gradeNum: s.gradeNum ?? null,
    durationInRole: s.durationInRole ?? null,
    description: s.description ?? null,
    requiredCompetencies: s.requiredCompetencies,
    promotionCriteria: s.promotionCriteria,
  }));
}

export const careerPathRouter = createTRPCRouter({
  list: generalReadProcedure.query(async ({ ctx }) => {
    return ctx.db.careerPath.findMany({
      select: {
        id: true,
        name: true,
        field: true,
        duration: true,
        isAiGenerated: true,
        _count: { select: { stages: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  byId: generalReadProcedure.input(z.object({ id: idSchema })).query(async ({ ctx, input }) => {
    const path = await ctx.db.careerPath.findUnique({
      where: { id: input.id },
      include: { stages: { orderBy: { order: "asc" } } },
    });
    if (!path) throw new TRPCError({ code: "NOT_FOUND" });
    return path;
  }),

  create: adminProcedure.input(careerPathInputSchema).mutation(async ({ ctx, input }) => {
    return ctx.db.careerPath.create({
      data: {
        name: input.name,
        field: input.field ?? null,
        duration: input.duration ?? null,
        description: input.description ?? null,
        stages: { create: stageCreate(input.stages) },
      },
      select: { id: true },
    });
  }),

  update: adminProcedure.input(careerPathUpdateSchema).mutation(async ({ ctx, input }) => {
    const { id } = input;
    return ctx.db.$transaction(async (tx) => {
      await tx.careerPathStage.deleteMany({ where: { careerPathId: id } });
      return tx.careerPath.update({
        where: { id },
        data: {
          name: input.name,
          field: input.field ?? null,
          duration: input.duration ?? null,
          description: input.description ?? null,
          stages: { create: stageCreate(input.stages) },
        },
        select: { id: true },
      });
    });
  }),

  delete: adminProcedure.input(z.object({ id: idSchema })).mutation(async ({ ctx, input }) => {
    await ctx.db.careerPath.delete({ where: { id: input.id } });
    return { id: input.id };
  }),

  aiEnabled: adminProcedure.query(() => isAiEnabled()),

  /** AI-generate a full path for a field (not persisted — returned for review). */
  generate: adminProcedure.input(careerPathGenerateSchema).mutation(async ({ input }) => {
    return generateCareerPath(input.field);
  }),
});
