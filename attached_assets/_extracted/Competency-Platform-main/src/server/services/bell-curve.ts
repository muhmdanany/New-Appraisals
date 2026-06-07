/**
 * Bell-curve / distribution-policy analysis.
 *
 * Ported from the reference analysis tool. Pure & framework-free so it runs on the
 * server (to compute department aggregates) and on the client (to render the
 * per-department comparison without a round-trip), and is unit-testable.
 *
 * Categories are ordered worst → best (index 0..4), matching the policy arrays:
 *   0 غير مرضي · 1 دون المتوقع · 2 حسب المتوقع · 3 فوق المتوقع · 4 استثنائي
 * which align 1:1 with our evaluation rating bands by total score.
 */

export const BELL_CATEGORY_LABELS = [
  "غير مرضي",
  "دون المتوقع",
  "حسب المتوقع",
  "فوق المتوقع",
  "استثنائي",
] as const;

export type AchievementBand = "above" | "achieved" | "below";

export interface PolicySet {
  above: number[];
  achieved: number[];
  below: number[];
}

/** The seeded default policy (also used as a fallback if none is active). */
export const DEFAULT_POLICY: PolicySet = {
  above: [0, 0, 35, 50, 15],
  achieved: [5, 5, 40, 40, 10],
  below: [10, 10, 35, 40, 5],
};

/** Map an evaluation total score (0..100) to a category index (0=worst..4=best). */
export function scoreToBandIndex(score: number): number {
  if (score >= 91) return 4;
  if (score >= 76) return 3;
  if (score >= 61) return 2;
  if (score >= 41) return 1;
  return 0;
}

/** Which policy column applies, based on a department's achievement ratio (1.0 = 100%). */
export function getAchievementCategory(achievement: number): AchievementBand {
  if (achievement > 1.0) return "above";
  if (achievement >= 0.95) return "achieved";
  return "below";
}

export function getPolicyForAchievement(achievement: number, policies: PolicySet): number[] {
  return [...policies[getAchievementCategory(achievement)]];
}

export type ShiftArrow = "up" | "down" | null;

/**
 * Allows the "حسب المتوقع" and "فوق المتوقع" categories to borrow unused quota from
 * the adjacent (better) category, mirroring the reference tool's tolerance rule.
 */
export function calculateShiftedPolicy(
  categories: number[],
  originalPolicy: number[],
): { shifted: number[]; notes: string[]; shiftArrows: ShiftArrow[] } {
  const shifted = [...originalPolicy];
  const notes: string[] = [];
  const shiftArrows: ShiftArrow[] = new Array(5).fill(null);

  for (let i = 2; i < 4; i++) {
    const actual = categories[i] ?? 0;
    const currentPolicy = shifted[i] ?? 0;
    if (actual > currentPolicy) {
      const diff = actual - currentPolicy;
      const nextIdx = i + 1;
      if (nextIdx < 5) {
        const available = shifted[nextIdx] ?? 0;
        const take = Math.min(diff, available);
        if (take > 0) {
          shifted[i] = currentPolicy + take;
          shifted[nextIdx] = available - take;
          shiftArrows[i] = "up";
          shiftArrows[nextIdx] = "down";
          notes.push(
            `فئة "${BELL_CATEGORY_LABELS[i]}" استلفت ${take}% من حصة فئة "${BELL_CATEGORY_LABELS[nextIdx]}"`,
          );
        }
      }
    }
  }
  return { shifted, notes, shiftArrows };
}

/** Departments with fewer than 10 employees are excluded from the mandatory policy. */
export const POLICY_EXCLUSION_THRESHOLD = 10;

export function isDeptCompliant(args: {
  categories: number[];
  employeeCount: number;
  achievement: number;
  policies: PolicySet;
}): boolean {
  if (args.employeeCount < POLICY_EXCLUSION_THRESHOLD) return true;
  const original = getPolicyForAchievement(args.achievement, args.policies);
  const { shifted } = calculateShiftedPolicy(args.categories, original);
  return args.categories.every((val, idx) => val <= (shifted[idx] ?? 0));
}
