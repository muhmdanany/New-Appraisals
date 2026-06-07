/**
 * Evaluation scoring engine.
 *
 * Ported from the prototype's `evRecalc`/`evTo100`/`evAvg` logic and made into a
 * pure, framework-free function so it can be unit-tested in isolation and reused
 * by the evaluation tRPC router (Phase 4).
 *
 * Scale rules (unchanged from the prototype):
 *  - Competencies are rated 1..5 and converted to a /100 score via (v-1)/4*100.
 *  - Shared competency groups: behavioral, leadership, technical. Plus optional
 *    job-specific competencies.
 *  - KPIs are entered directly as 0..100 achievement percentages.
 *  - competencyScore = mean of the present group /100 scores.
 *  - total = kpiScore*kpiWeight + competencyScore*(1-kpiWeight), rounded.
 *    If only one side is present, that side is used at full weight.
 */

// Mirrors prisma `EvaluationMode` without importing the generated client, keeping
// this module dependency-free and testable before `prisma generate` has run.
export type EvaluationMode = "SHARED" | "SPECIFIC" | "BOTH";

/** Stable refKeys for the shared competency groups, matching the prototype. */
export const SHARED_COMPETENCY_KEYS = {
  behavioral: ["b1", "b2", "b3", "b4", "b5"],
  leadership: ["l1", "l2", "l3", "l4", "l5"],
  technical: ["t1", "t2", "t3", "t4"],
} as const;

export interface ScoreInput {
  mode: EvaluationMode;
  /** KPI weight as a percentage 0..100. Competency weight is the remainder. */
  kpiWeight: number;
  /** Rated behavioral competency values (1..5). Only include rated ones. */
  behavioral?: number[];
  /** Rated leadership competency values (1..5). */
  leadership?: number[];
  /** Rated technical competency values (1..5). */
  technical?: number[];
  /** Rated job-specific competency values (1..5). */
  jobSpecific?: number[];
  /** KPI achievement percentages (0..100). */
  kpis?: number[];
}

export interface ScoreResult {
  kpiScore: number | null;
  competencyScore: number | null;
  groupScores: {
    behavioral: number | null;
    leadership: number | null;
    technical: number | null;
    jobSpecific: number | null;
  };
  totalScore: number | null;
  ratingLabel: string | null;
}

/** Rating bands (mirrors the prototype thresholds). */
export const RATING_BANDS = [
  { min: 91, label: "متميز" },
  { min: 76, label: "يتجاوز التوقعات" },
  { min: 61, label: "يحقق التوقعات" },
  { min: 41, label: "يحتاج تحسيناً" },
  { min: 0, label: "دون المستوى" },
] as const;

export function ratingLabelFor(score: number): string {
  for (const band of RATING_BANDS) {
    if (score >= band.min) return band.label;
  }
  return RATING_BANDS[RATING_BANDS.length - 1]!.label;
}

/** Convert a 1..5 competency rating to a /100 score. */
export function competencyTo100(value: number): number {
  return Math.round(((value - 1) / 4) * 100);
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Average a group of 1..5 ratings and convert to /100, or null if empty. */
function groupTo100(values: number[] | undefined): number | null {
  const avg = mean(values ?? []);
  return avg === null ? null : competencyTo100(avg);
}

export function calculateScore(input: ScoreInput): ScoreResult {
  const useShared = input.mode === "SHARED" || input.mode === "BOTH";
  const useSpecific = input.mode === "SPECIFIC" || input.mode === "BOTH";

  const behavioral = useShared ? groupTo100(input.behavioral) : null;
  const leadership = useShared ? groupTo100(input.leadership) : null;
  const technical = useShared ? groupTo100(input.technical) : null;
  const jobSpecific = useSpecific ? groupTo100(input.jobSpecific) : null;

  const presentGroups = [behavioral, leadership, technical, jobSpecific].filter(
    (v): v is number => v !== null,
  );
  const competencyScore = presentGroups.length
    ? presentGroups.reduce((a, b) => a + b, 0) / presentGroups.length
    : null;

  const kpiScore = mean(input.kpis ?? []);

  const kpiWeight = clampWeight(input.kpiWeight) / 100;
  const competencyWeight = 1 - kpiWeight;

  let total: number | null = null;
  if (kpiScore !== null && competencyScore !== null) {
    total = kpiScore * kpiWeight + competencyScore * competencyWeight;
  } else if (kpiScore !== null) {
    total = kpiScore;
  } else if (competencyScore !== null) {
    total = competencyScore;
  }

  const totalScore = total === null ? null : Math.round(total);

  return {
    kpiScore,
    competencyScore,
    groupScores: { behavioral, leadership, technical, jobSpecific },
    totalScore,
    ratingLabel: totalScore === null ? null : ratingLabelFor(totalScore),
  };
}

function clampWeight(weight: number): number {
  if (Number.isNaN(weight)) return 60;
  return Math.min(100, Math.max(0, weight));
}
