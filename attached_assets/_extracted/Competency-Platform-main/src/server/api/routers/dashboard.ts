import { createTRPCRouter, roleProcedure } from "@/server/api/trpc";

export const dashboardRouter = createTRPCRouter({
  /** Headline counts for the dashboard stat cards. ADMIN + HR_MANAGER only. */
  stats: roleProcedure("ADMIN", "HR_MANAGER").query(async ({ ctx }) => {
    const [jobs, competencies, grades, evaluations, employees, kpis, careerPaths, departments] =
      await Promise.all([
        ctx.db.job.count(),
        ctx.db.competency.count(),
        ctx.db.grade.count(),
        ctx.db.evaluation.count(),
        ctx.db.employee.count(),
        ctx.db.kpi.count(),
        ctx.db.careerPath.count(),
        ctx.db.department.count(),
      ]);

    return { jobs, competencies, grades, evaluations, employees, kpis, careerPaths, departments };
  }),

  /** Performance analytics over finalized evaluations. ADMIN + HR_MANAGER only. */
  analytics: roleProcedure("ADMIN", "HR_MANAGER").query(async ({ ctx }) => {
    const FINALIZED = ["APPROVED", "ACKNOWLEDGED", "OBJECTED"] as const;

    const [scored, byStatus, policy] = await Promise.all([
      ctx.db.evaluation.findMany({
        where: { status: { in: [...FINALIZED] }, totalScore: { not: null } },
        select: { totalScore: true },
      }),
      ctx.db.evaluation.groupBy({ by: ["status"], _count: { _all: true } }),
      ctx.db.bellCurvePolicy.findFirst({ where: { isActive: true }, select: { name: true, distribution: true } }),
    ]);

    // Rating bands, highest → lowest.
    const bands = [
      { label: "متميز", min: 91 },
      { label: "يتجاوز التوقعات", min: 76 },
      { label: "يحقق التوقعات", min: 61 },
      { label: "يحتاج تحسيناً", min: 41 },
      { label: "دون المستوى", min: 0 },
    ];
    const distribution = bands.map((b) => ({ label: b.label, count: 0 }));
    for (const e of scored) {
      const s = e.totalScore ?? 0;
      const idx = s >= 91 ? 0 : s >= 76 ? 1 : s >= 61 ? 2 : s >= 41 ? 3 : 4;
      distribution[idx]!.count += 1;
    }

    const avgScore = scored.length
      ? Math.round(scored.reduce((a, e) => a + (e.totalScore ?? 0), 0) / scored.length)
      : null;

    const statusCounts: Record<string, number> = {};
    for (const row of byStatus) statusCounts[row.status] = row._count._all;

    return {
      finalizedCount: scored.length,
      avgScore,
      distribution,
      statusCounts,
      policy: policy ? { name: policy.name, distribution: policy.distribution } : null,
    };
  }),
});
