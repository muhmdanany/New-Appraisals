import { createTRPCRouter, roleProcedure, hrReadProcedure } from "@/server/api/trpc";
import { EVALUATION_STATUS_LABELS } from "@/lib/evaluation-status";
import { visibleEmployeeIds } from "@/server/services/rbac";
import { scoreToBandIndex, DEFAULT_POLICY, type PolicySet } from "@/server/services/bell-curve";

export const reportRouter = createTRPCRouter({
  /** Flattened evaluation rows for CSV export. ADMIN + HR_MANAGER (org-wide). */
  evaluations: roleProcedure("ADMIN", "HR_MANAGER").query(async ({ ctx }) => {
    const rows = await ctx.db.evaluation.findMany({
      include: {
        employee: { select: { name: true, employeeNumber: true } },
        job: { select: { name: true } },
        evaluator: { select: { name: true } },
        approver: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((e) => ({
      employeeName: e.employee.name,
      employeeNumber: e.employee.employeeNumber,
      job: e.job?.name ?? "",
      period: e.period,
      kpiScore: e.kpiScore ?? "",
      competencyScore: e.competencyScore ?? "",
      totalScore: e.totalScore ?? "",
      rating: e.ratingLabel ?? "",
      status: EVALUATION_STATUS_LABELS[e.status] ?? e.status,
      evaluator: e.evaluator.name,
      approver: e.approver?.name ?? "",
      date: e.createdAt.toISOString().slice(0, 10),
    }));
  }),

  /**
   * Per-department performance distribution vs. the bell-curve policy. ADMIN + HR.
   * Categories are % of finalized evaluations in each rating band (worst→best);
   * achievement = average KPI score (fallback total score) ÷ 100.
   */
  bellCurve: roleProcedure("ADMIN", "HR_MANAGER").query(async ({ ctx }) => {
    const policyRow = await ctx.db.bellCurvePolicy.findFirst({
      where: { isActive: true },
      select: { name: true, distribution: true },
    });
    const policy = (policyRow?.distribution as PolicySet | null) ?? DEFAULT_POLICY;

    const [departments, evals] = await Promise.all([
      ctx.db.department.findMany({
        select: { id: true, name: true, _count: { select: { employees: true } } },
      }),
      ctx.db.evaluation.findMany({
        where: {
          status: { in: ["APPROVED", "ACKNOWLEDGED", "OBJECTED"] },
          totalScore: { not: null },
          employee: { departmentId: { not: null } },
        },
        select: {
          totalScore: true,
          kpiScore: true,
          employee: { select: { departmentId: true } },
        },
      }),
    ]);

    const agg = new Map<string, { counts: number[]; achievementSum: number; n: number }>();
    for (const e of evals) {
      const deptId = e.employee.departmentId;
      if (!deptId || e.totalScore === null) continue;
      let row = agg.get(deptId);
      if (!row) {
        row = { counts: [0, 0, 0, 0, 0], achievementSum: 0, n: 0 };
        agg.set(deptId, row);
      }
      const idx = scoreToBandIndex(e.totalScore);
      row.counts[idx] = (row.counts[idx] ?? 0) + 1;
      row.achievementSum += (e.kpiScore ?? e.totalScore) / 100;
      row.n += 1;
    }

    const result = departments
      .map((d) => {
        const row = agg.get(d.id);
        if (!row || row.n === 0) return null;
        return {
          id: d.id,
          name: d.name,
          categories: row.counts.map((c) => Math.round((c / row.n) * 100)),
          achievement: row.achievementSum / row.n,
          employeeCount: d._count.employees,
          evaluatedCount: row.n,
        };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));

    return { policyName: policyRow?.name ?? null, policy, departments: result };
  }),

  /**
   * Employee reporting tree (non-sensitive fields) for the org chart. ADMIN/HR see
   * the whole org; managers see only their own subtree (themselves + reports).
   */
  orgTree: hrReadProcedure.query(async ({ ctx }) => {
    const visible = await visibleEmployeeIds(ctx.db, ctx.session.user);
    let where: { id?: { in: string[] } } = {};
    if (visible !== null) {
      const self = ctx.session.user.employeeId;
      where = { id: { in: self ? [...visible, self] : visible } };
    }
    return ctx.db.employee.findMany({
      where,
      select: {
        id: true,
        name: true,
        managerId: true,
        job: { select: { name: true } },
        department: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    });
  }),
});
