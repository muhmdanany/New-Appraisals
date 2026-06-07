import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, adminProcedure } from "@/server/api/trpc";
import { idSchema } from "@/lib/validators/common";
import { kpiSaveSchema } from "@/lib/validators/kpi";
import { isAiEnabled, generateKpis } from "@/server/services/ai";

export const kpiRouter = createTRPCRouter({
  /** Whether AI generation is configured (no secrets exposed). */
  aiEnabled: adminProcedure.query(() => isAiEnabled()),

  /** Jobs with a summary of their KPI coverage. */
  list: adminProcedure.query(async ({ ctx }) => {
    const jobs = await ctx.db.job.findMany({
      select: {
        id: true,
        name: true,
        department: { select: { name: true } },
        _count: { select: { competencies: true } },
        kpiSet: {
          select: {
            id: true,
            isAiGenerated: true,
            groups: { select: { _count: { select: { kpis: true } } } },
          },
        },
      },
      orderBy: { name: "asc" },
    });
    return jobs.map((j) => ({
      id: j.id,
      name: j.name,
      department: j.department?.name ?? null,
      competencyCount: j._count.competencies,
      hasKpis: Boolean(j.kpiSet),
      isAiGenerated: j.kpiSet?.isAiGenerated ?? false,
      kpiCount: j.kpiSet?.groups.reduce((sum, g) => sum + g._count.kpis, 0) ?? 0,
    }));
  }),

  /** KPI set for a job + the job's competencies (for the builder). */
  get: adminProcedure.input(z.object({ jobId: idSchema })).query(async ({ ctx, input }) => {
    const job = await ctx.db.job.findUnique({
      where: { id: input.jobId },
      select: {
        id: true,
        name: true,
        competencies: { select: { competency: { select: { name: true } } } },
        kpiSet: {
          select: {
            summary: true,
            isAiGenerated: true,
            groups: {
              orderBy: { order: "asc" },
              select: {
                competencyName: true,
                compType: true,
                kpis: {
                  orderBy: { order: "asc" },
                  select: { name: true, description: true, measure: true, target: true, frequency: true, weight: true },
                },
              },
            },
          },
        },
      },
    });
    if (!job) throw new TRPCError({ code: "NOT_FOUND" });
    return {
      job: { id: job.id, name: job.name, competencies: job.competencies.map((c) => c.competency.name) },
      kpiSet: job.kpiSet,
    };
  }),

  /** Create or replace a job's KPI set. */
  save: adminProcedure.input(kpiSaveSchema).mutation(async ({ ctx, input }) => {
    const groupsData = input.groups.map((g, gi) => ({
      competencyName: g.competencyName,
      compType: g.compType ?? null,
      order: gi,
      kpis: {
        create: g.kpis.map((k, ki) => ({
          name: k.name,
          description: k.description ?? null,
          measure: k.measure ?? null,
          target: k.target ?? null,
          frequency: k.frequency ?? null,
          weight: k.weight ?? null,
          order: ki,
        })),
      },
    }));

    return ctx.db.$transaction(async (tx) => {
      const existing = await tx.kpiSet.findUnique({ where: { jobId: input.jobId }, select: { id: true } });
      if (existing) {
        await tx.kpiGroup.deleteMany({ where: { kpiSetId: existing.id } });
        return tx.kpiSet.update({
          where: { id: existing.id },
          data: { summary: input.summary ?? null, isAiGenerated: input.isAiGenerated, groups: { create: groupsData } },
          select: { id: true },
        });
      }
      return tx.kpiSet.create({
        data: {
          jobId: input.jobId,
          summary: input.summary ?? null,
          isAiGenerated: input.isAiGenerated,
          groups: { create: groupsData },
        },
        select: { id: true },
      });
    });
  }),

  /** AI-generate KPIs for a job (not persisted — returned for review). */
  generate: adminProcedure.input(z.object({ jobId: idSchema })).mutation(async ({ ctx, input }) => {
    const job = await ctx.db.job.findUnique({
      where: { id: input.jobId },
      select: { name: true, competencies: { select: { competency: { select: { name: true } } } } },
    });
    if (!job) throw new TRPCError({ code: "NOT_FOUND" });
    return generateKpis({ name: job.name, competencies: job.competencies.map((c) => c.competency.name) });
  }),

  delete: adminProcedure.input(z.object({ jobId: idSchema })).mutation(async ({ ctx, input }) => {
    await ctx.db.kpiSet.deleteMany({ where: { jobId: input.jobId } });
    return { jobId: input.jobId };
  }),
});
