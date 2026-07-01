import { calculateScore, type ScoreResult, type EvaluationMode } from "./scoring";
import type { Role } from "@/lib/rbac";

export interface ScoreComputationInput {
  mode: EvaluationMode;
  kpiWeight: number;
  sharedScores: Record<string, number>; // sharedKey (b*/l*/t*) → 1..5
  jobScores: Record<string, number>; // competencyId → 1..5
  kpis: { achievement: number }[];
}

function valuesWithPrefix(scores: Record<string, number>, prefix: string): number[] {
  return Object.entries(scores)
    .filter(([key]) => key.startsWith(prefix))
    .map(([, value]) => value);
}

/** Group raw scores into the shape the scoring engine expects, then compute. */
export function computeScores(input: ScoreComputationInput): ScoreResult {
  return calculateScore({
    mode: input.mode,
    kpiWeight: input.kpiWeight,
    behavioral: valuesWithPrefix(input.sharedScores, "b"),
    leadership: valuesWithPrefix(input.sharedScores, "l"),
    technical: valuesWithPrefix(input.sharedScores, "t"),
    jobSpecific: Object.values(input.jobScores),
    kpis: input.kpis.map((k) => k.achievement),
  });
}

/** A shared-competency refKey looks like b1/l3/t2; anything else is job-specific. */
export function isSharedKey(refKey: string): boolean {
  return /^[blt]\d+$/.test(refKey);
}

// ── Workflow access predicates ───────────────────────────────
// `visibleIds` is the result of visibleEmployeeIds: null = org-wide access.

type EvalView = {
  employeeId: string;
  evaluatorId: string;
  status: string;
};

const EMPLOYEE_VISIBLE_STATUSES = ["APPROVED", "ACKNOWLEDGED", "OBJECTED"];

export function canViewEvaluation(
  user: { id: string; role: Role; employeeId: string | null },
  evaluation: EvalView,
  visibleIds: string[] | null,
): boolean {
  if (user.role === "ADMIN" || user.role === "HR_MANAGER") return true;
  if (user.role === "FIRST_LEVEL_MANAGER") return evaluation.evaluatorId === user.id;
  if (user.role === "SECOND_LEVEL_MANAGER") {
    const inScope = visibleIds === null || visibleIds.includes(evaluation.employeeId);
    return inScope && evaluation.status !== "DRAFT";
  }
  if (user.role === "EMPLOYEE") {
    return (
      evaluation.employeeId === user.employeeId &&
      EMPLOYEE_VISIBLE_STATUSES.includes(evaluation.status)
    );
  }
  return false;
}

/** Second-level approver (or ADMIN) may act on a SUBMITTED evaluation in scope. */
export function canApproveEvaluation(
  user: { role: Role; employeeId: string | null },
  evaluation: EvalView,
  visibleIds: string[] | null,
): boolean {
  if (user.role === "ADMIN") return true;
  if (user.role !== "SECOND_LEVEL_MANAGER") return false;
  return visibleIds === null || visibleIds.includes(evaluation.employeeId);
}
