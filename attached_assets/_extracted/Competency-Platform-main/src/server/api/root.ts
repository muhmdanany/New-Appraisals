import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";
import { meRouter } from "@/server/api/routers/me";
import { dashboardRouter } from "@/server/api/routers/dashboard";
import { departmentRouter } from "@/server/api/routers/department";
import { competencyRouter } from "@/server/api/routers/competency";
import { jobRouter } from "@/server/api/routers/job";
import { gradeRouter } from "@/server/api/routers/grade";
import { employeeRouter } from "@/server/api/routers/employee";
import { evaluationRouter } from "@/server/api/routers/evaluation";
import { kpiRouter } from "@/server/api/routers/kpi";
import { careerPathRouter } from "@/server/api/routers/career-path";
import { reportRouter } from "@/server/api/routers/report";

/**
 * Root tRPC router. Domain routers (evaluations, kpis, …) are added in later phases.
 */
export const appRouter = createTRPCRouter({
  me: meRouter,
  dashboard: dashboardRouter,
  department: departmentRouter,
  competency: competencyRouter,
  job: jobRouter,
  grade: gradeRouter,
  employee: employeeRouter,
  evaluation: evaluationRouter,
  kpi: kpiRouter,
  careerPath: careerPathRouter,
  report: reportRouter,
});

export type AppRouter = typeof appRouter;

/** Server-side caller factory (for RSC / server actions). */
export const createCaller = createCallerFactory(appRouter);
