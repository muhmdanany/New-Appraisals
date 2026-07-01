import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure, roleProcedure, hrReadProcedure } from "@/server/api/trpc";
import { idSchema } from "@/lib/validators/common";
import {
  evaluationCreateSchema,
  evaluationUpdateSchema,
  evaluationRejectSchema,
  evaluationObjectSchema,
  type EvaluationSave,
} from "@/lib/validators/evaluation";
import { visibleEmployeeIds } from "@/server/services/rbac";
import {
  computeScores,
  canViewEvaluation,
  canApproveEvaluation,
} from "@/server/services/evaluation";
import { scoreToBandIndex, DEFAULT_POLICY, type PolicySet } from "@/server/services/bell-curve";
import type { Context } from "@/server/api/trpc";

/** Build the score fields + EvaluationItem rows for a save payload. */
async function buildScoresAndItems(ctx: Context, input: EvaluationSave) {
  const scores = computeScores(input);
  const useShared = input.mode !== "SPECIFIC";
  const useJob = input.mode !== "SHARED";

  const items: {
    kind: "COMPETENCY" | "KPI";
    refKey: string;
    label: string;
    score: number;
    note?: string | null;
  }[] = [];

  if (useShared && Object.keys(input.sharedScores).length) {
    const comps = await ctx.db.competency.findMany({
      where: { sharedKey: { in: Object.keys(input.sharedScores) } },
      select: { sharedKey: true, name: true },
    });
    const nameByKey = new Map(comps.map((c) => [c.sharedKey ?? "", c.name]));
    for (const [refKey, score] of Object.entries(input.sharedScores)) {
      items.push({ kind: "COMPETENCY", refKey, label: nameByKey.get(refKey) ?? refKey, score });
    }
  }

  if (useJob && Object.keys(input.jobScores).length) {
    const comps = await ctx.db.competency.findMany({
      where: { id: { in: Object.keys(input.jobScores) } },
      select: { id: true, name: true },
    });
    const nameById = new Map(comps.map((c) => [c.id, c.name]));
    for (const [refKey, score] of Object.entries(input.jobScores)) {
      items.push({ kind: "COMPETENCY", refKey, label: nameById.get(refKey) ?? refKey, score });
    }
  }

  for (const k of input.kpis) {
    items.push({ kind: "KPI", refKey: k.name, label: k.name, score: k.achievement, note: k.note ?? null });
  }

  return { scores, items };
}

const evalListInclude = {
  employee: { select: { id: true, name: true, employeeNumber: true } },
  job: { select: { id: true, name: true } },
  evaluator: { select: { id: true, name: true } },
  approver: { select: { id: true, name: true } },
} as const;

export const evaluationRouter = createTRPCRouter({
  /**
   * Running rating distribution of an employee's DEPARTMENT for a period, vs. the
   * bell-curve policy — powers the live "distribution guardrail" on the form and
   * the approver's view. Aggregate counts only (no individual identities).
   */
  departmentDistribution: hrReadProcedure
    .input(
      z.object({
        employeeId: idSchema,
        period: z.string().trim().min(1),
        excludeEvaluationId: idSchema.optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const employee = await ctx.db.employee.findUnique({
        where: { id: input.employeeId },
        select: { departmentId: true, department: { select: { name: true, _count: { select: { employees: true } } } } },
      });
      if (!employee?.departmentId || !employee.department) return null;

      const evals = await ctx.db.evaluation.findMany({
        where: {
          period: input.period,
          status: { not: "REJECTED" },
          totalScore: { not: null },
          employee: { departmentId: employee.departmentId },
          ...(input.excludeEvaluationId ? { id: { not: input.excludeEvaluationId } } : {}),
        },
        select: { totalScore: true, kpiScore: true },
      });

      const counts = [0, 0, 0, 0, 0];
      let achievementSum = 0;
      for (const e of evals) {
        if (e.totalScore === null) continue;
        const idx = scoreToBandIndex(e.totalScore);
        counts[idx] = (counts[idx] ?? 0) + 1;
        achievementSum += (e.kpiScore ?? e.totalScore) / 100;
      }

      const policyRow = await ctx.db.bellCurvePolicy.findFirst({
        where: { isActive: true },
        select: { distribution: true },
      });

      return {
        departmentName: employee.department.name,
        employeeCount: employee.department._count.employees,
        counts,
        evaluatedCount: evals.length,
        achievement: evals.length ? achievementSum / evals.length : 0,
        policy: (policyRow?.distribution as PolicySet | null) ?? DEFAULT_POLICY,
      };
    }),

  /** Data needed to render a blank evaluation form for an employee. */
  formData: roleProcedure("ADMIN", "FIRST_LEVEL_MANAGER")
    .input(z.object({ employeeId: idSchema }))
    .query(async ({ ctx, input }) => {
      if (ctx.session.user.role === "FIRST_LEVEL_MANAGER") {
        const ids = await visibleEmployeeIds(ctx.db, ctx.session.user);
        if (ids !== null && !ids.includes(input.employeeId)) throw new TRPCError({ code: "FORBIDDEN" });
      }
      const employee = await ctx.db.employee.findUnique({
        where: { id: input.employeeId },
        select: {
          id: true,
          name: true,
          employeeNumber: true,
          department: { select: { name: true } },
          grade: { select: { num: true, name: true } },
          job: {
            select: {
              id: true,
              name: true,
              competencies: {
                select: { competency: { select: { id: true, name: true, indicators: true } } },
              },
              kpiSet: {
                select: { groups: { select: { kpis: { select: { name: true, measure: true, target: true } } } } },
              },
            },
          },
        },
      });
      if (!employee) throw new TRPCError({ code: "NOT_FOUND" });

      const sharedComps = await ctx.db.competency.findMany({
        where: { isShared: true },
        select: { sharedKey: true, name: true, indicators: true, type: true },
        orderBy: { sharedKey: "asc" },
      });
      const group = (t: string) =>
        sharedComps
          .filter((c) => c.type === t)
          .map((c) => ({ key: c.sharedKey ?? "", name: c.name, indicators: c.indicators }));

      const kpis =
        employee.job?.kpiSet?.groups.flatMap((g) => g.kpis.map((k) => ({ name: k.name, measure: k.measure, target: k.target }))) ?? [];

      return {
        employee: {
          id: employee.id,
          name: employee.name,
          employeeNumber: employee.employeeNumber,
          department: employee.department?.name ?? null,
          grade: employee.grade ? `درجة ${employee.grade.num} — ${employee.grade.name}` : null,
          job: employee.job ? { id: employee.job.id, name: employee.job.name } : null,
        },
        shared: { behavioral: group("BEHAVIORAL"), leadership: group("LEADERSHIP"), technical: group("TECHNICAL") },
        jobCompetencies: employee.job?.competencies.map((c) => c.competency) ?? [],
        kpis,
      };
    }),

  create: roleProcedure("ADMIN", "FIRST_LEVEL_MANAGER")
    .input(evaluationCreateSchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.session.user.role === "FIRST_LEVEL_MANAGER") {
        const ids = await visibleEmployeeIds(ctx.db, ctx.session.user);
        if (ids !== null && !ids.includes(input.employeeId)) throw new TRPCError({ code: "FORBIDDEN" });
      }
      const employee = await ctx.db.employee.findUnique({
        where: { id: input.employeeId },
        select: { id: true, jobId: true },
      });
      if (!employee) throw new TRPCError({ code: "NOT_FOUND" });

      const { scores, items } = await buildScoresAndItems(ctx, input);
      return ctx.db.evaluation.create({
        data: {
          employeeId: input.employeeId,
          jobId: employee.jobId,
          evaluatorId: ctx.session.user.id,
          period: input.period,
          mode: input.mode,
          kpiWeight: input.kpiWeight,
          competencyWeight: 100 - input.kpiWeight,
          kpiScore: scores.kpiScore,
          competencyScore: scores.competencyScore,
          totalScore: scores.totalScore,
          ratingLabel: scores.ratingLabel,
          status: "DRAFT",
          items: { create: items },
        },
        select: { id: true },
      });
    }),

  update: roleProcedure("ADMIN", "FIRST_LEVEL_MANAGER")
    .input(evaluationUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.evaluation.findUnique({
        where: { id: input.id },
        select: { evaluatorId: true, status: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (ctx.session.user.role !== "ADMIN" && existing.evaluatorId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (existing.status !== "DRAFT" && existing.status !== "REJECTED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن تعديل تقييم بعد إرساله." });
      }
      const { scores, items } = await buildScoresAndItems(ctx, input);
      return ctx.db.$transaction(async (tx) => {
        await tx.evaluationItem.deleteMany({ where: { evaluationId: input.id } });
        return tx.evaluation.update({
          where: { id: input.id },
          data: {
            period: input.period,
            mode: input.mode,
            kpiWeight: input.kpiWeight,
            competencyWeight: 100 - input.kpiWeight,
            kpiScore: scores.kpiScore,
            competencyScore: scores.competencyScore,
            totalScore: scores.totalScore,
            ratingLabel: scores.ratingLabel,
            status: "DRAFT",
            rejectionReason: null,
            items: { create: items },
          },
          select: { id: true },
        });
      });
    }),

  submit: roleProcedure("ADMIN", "FIRST_LEVEL_MANAGER")
    .input(z.object({ id: idSchema }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.evaluation.findUnique({
        where: { id: input.id },
        select: { evaluatorId: true, status: true, totalScore: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (ctx.session.user.role !== "ADMIN" && existing.evaluatorId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (existing.status !== "DRAFT" && existing.status !== "REJECTED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "التقييم في حالة لا تسمح بالإرسال." });
      }
      if (existing.totalScore === null) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "أكمل إدخال الدرجات قبل الإرسال." });
      }
      return ctx.db.evaluation.update({
        where: { id: input.id },
        data: { status: "SUBMITTED", rejectionReason: null },
        select: { id: true, status: true },
      });
    }),

  approve: roleProcedure("ADMIN", "SECOND_LEVEL_MANAGER")
    .input(z.object({ id: idSchema }))
    .mutation(async ({ ctx, input }) => {
      const ev = await ctx.db.evaluation.findUnique({
        where: { id: input.id },
        select: { employeeId: true, evaluatorId: true, status: true },
      });
      if (!ev) throw new TRPCError({ code: "NOT_FOUND" });
      const visible = await visibleEmployeeIds(ctx.db, ctx.session.user);
      if (!canApproveEvaluation(ctx.session.user, ev, visible)) throw new TRPCError({ code: "FORBIDDEN" });
      if (ev.status !== "SUBMITTED") throw new TRPCError({ code: "BAD_REQUEST", message: "التقييم ليس قيد الاعتماد." });
      return ctx.db.evaluation.update({
        where: { id: input.id },
        data: { status: "APPROVED", approverId: ctx.session.user.id, approvedAt: new Date() },
        select: { id: true, status: true },
      });
    }),

  reject: roleProcedure("ADMIN", "SECOND_LEVEL_MANAGER")
    .input(evaluationRejectSchema)
    .mutation(async ({ ctx, input }) => {
      const ev = await ctx.db.evaluation.findUnique({
        where: { id: input.id },
        select: { employeeId: true, evaluatorId: true, status: true },
      });
      if (!ev) throw new TRPCError({ code: "NOT_FOUND" });
      const visible = await visibleEmployeeIds(ctx.db, ctx.session.user);
      if (!canApproveEvaluation(ctx.session.user, ev, visible)) throw new TRPCError({ code: "FORBIDDEN" });
      if (ev.status !== "SUBMITTED") throw new TRPCError({ code: "BAD_REQUEST", message: "التقييم ليس قيد الاعتماد." });
      return ctx.db.evaluation.update({
        where: { id: input.id },
        data: { status: "REJECTED", approverId: ctx.session.user.id, rejectionReason: input.reason },
        select: { id: true, status: true },
      });
    }),

  acknowledge: roleProcedure("EMPLOYEE")
    .input(z.object({ id: idSchema }))
    .mutation(async ({ ctx, input }) => {
      const ev = await ctx.db.evaluation.findUnique({
        where: { id: input.id },
        select: { employeeId: true, status: true },
      });
      if (!ev) throw new TRPCError({ code: "NOT_FOUND" });
      if (ev.employeeId !== ctx.session.user.employeeId) throw new TRPCError({ code: "FORBIDDEN" });
      if (ev.status !== "APPROVED") throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن الاعتماد في هذه الحالة." });
      return ctx.db.evaluation.update({
        where: { id: input.id },
        data: { status: "ACKNOWLEDGED", employeeAck: true },
        select: { id: true, status: true },
      });
    }),

  object: roleProcedure("EMPLOYEE")
    .input(evaluationObjectSchema)
    .mutation(async ({ ctx, input }) => {
      const ev = await ctx.db.evaluation.findUnique({
        where: { id: input.id },
        select: { employeeId: true, status: true, items: { select: { id: true } } },
      });
      if (!ev) throw new TRPCError({ code: "NOT_FOUND" });
      if (ev.employeeId !== ctx.session.user.employeeId) throw new TRPCError({ code: "FORBIDDEN" });
      if (ev.status !== "APPROVED") throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن الاعتراض في هذه الحالة." });

      const validIds = new Set(ev.items.map((i) => i.id));
      const targets = input.items.filter((i) => validIds.has(i.itemId));
      if (!targets.length) throw new TRPCError({ code: "BAD_REQUEST", message: "بنود الاعتراض غير صالحة." });

      await ctx.db.$transaction([
        // Reset any previous objections, then apply the new ones.
        ctx.db.evaluationItem.updateMany({
          where: { evaluationId: input.id },
          data: { objected: false, objectionNote: null },
        }),
        ...targets.map((t) =>
          ctx.db.evaluationItem.update({
            where: { id: t.itemId },
            data: { objected: true, objectionNote: t.note ?? null },
          }),
        ),
        ctx.db.evaluation.update({ where: { id: input.id }, data: { status: "OBJECTED" } }),
      ]);
      return { id: input.id, status: "OBJECTED" as const };
    }),

  list: protectedProcedure
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const user = ctx.session.user;
      let where: Record<string, unknown> = {};
      if (user.role === "FIRST_LEVEL_MANAGER") {
        where = { evaluatorId: user.id };
      } else if (user.role === "SECOND_LEVEL_MANAGER") {
        const ids = await visibleEmployeeIds(ctx.db, user);
        where = { employeeId: { in: ids ?? [] }, status: { not: "DRAFT" } };
      } else if (user.role === "EMPLOYEE") {
        where = {
          employeeId: user.employeeId ?? "__none__",
          status: { in: ["APPROVED", "ACKNOWLEDGED", "OBJECTED"] },
        };
      }
      if (input?.status) where = { ...where, status: input.status };
      return ctx.db.evaluation.findMany({
        where,
        include: evalListInclude,
        orderBy: { createdAt: "desc" },
        take: 200,
      });
    }),

  byId: protectedProcedure.input(z.object({ id: idSchema })).query(async ({ ctx, input }) => {
    const ev = await ctx.db.evaluation.findUnique({
      where: { id: input.id },
      include: { ...evalListInclude, items: true },
    });
    if (!ev) throw new TRPCError({ code: "NOT_FOUND" });
    const visible = await visibleEmployeeIds(ctx.db, ctx.session.user);
    if (!canViewEvaluation(ctx.session.user, ev, visible)) throw new TRPCError({ code: "FORBIDDEN" });
    return ev;
  }),

  delete: roleProcedure("ADMIN", "FIRST_LEVEL_MANAGER")
    .input(z.object({ id: idSchema }))
    .mutation(async ({ ctx, input }) => {
      const ev = await ctx.db.evaluation.findUnique({
        where: { id: input.id },
        select: { evaluatorId: true, status: true },
      });
      if (!ev) throw new TRPCError({ code: "NOT_FOUND" });
      if (ctx.session.user.role !== "ADMIN") {
        if (ev.evaluatorId !== ctx.session.user.id || (ev.status !== "DRAFT" && ev.status !== "REJECTED")) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }
      await ctx.db.evaluation.delete({ where: { id: input.id } });
      return { id: input.id };
    }),
});
