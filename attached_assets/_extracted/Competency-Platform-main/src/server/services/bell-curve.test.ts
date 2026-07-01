import { describe, it, expect } from "vitest";
import {
  scoreToBandIndex,
  getAchievementCategory,
  calculateShiftedPolicy,
  isDeptCompliant,
  DEFAULT_POLICY,
} from "./bell-curve";

describe("scoreToBandIndex", () => {
  it("maps scores to worst→best band indices", () => {
    expect(scoreToBandIndex(95)).toBe(4);
    expect(scoreToBandIndex(80)).toBe(3);
    expect(scoreToBandIndex(70)).toBe(2);
    expect(scoreToBandIndex(50)).toBe(1);
    expect(scoreToBandIndex(20)).toBe(0);
  });
});

describe("getAchievementCategory", () => {
  it("selects the policy column", () => {
    expect(getAchievementCategory(1.05)).toBe("above");
    expect(getAchievementCategory(0.97)).toBe("achieved");
    expect(getAchievementCategory(0.95)).toBe("achieved");
    expect(getAchievementCategory(0.8)).toBe("below");
  });
});

describe("calculateShiftedPolicy", () => {
  it("borrows quota from the adjacent better category", () => {
    // policy "achieved" = [5,5,40,40,10]; dept over on فوق المتوقع (idx 3): 45 > 40
    const { shifted, shiftArrows, notes } = calculateShiftedPolicy([5, 5, 40, 45, 5], DEFAULT_POLICY.achieved);
    // idx 3 borrows 5 from idx 4 (which had 10) → shifted[3]=45, shifted[4]=5
    expect(shifted[3]).toBe(45);
    expect(shifted[4]).toBe(5);
    expect(shiftArrows[3]).toBe("up");
    expect(shiftArrows[4]).toBe("down");
    expect(notes.length).toBeGreaterThan(0);
  });

  it("does not shift when within policy", () => {
    const { shifted, notes } = calculateShiftedPolicy([5, 5, 40, 40, 10], DEFAULT_POLICY.achieved);
    expect(shifted).toEqual([5, 5, 40, 40, 10]);
    expect(notes).toHaveLength(0);
  });
});

describe("isDeptCompliant", () => {
  it("excludes departments with fewer than 10 employees", () => {
    expect(
      isDeptCompliant({ categories: [50, 50, 0, 0, 0], employeeCount: 4, achievement: 0.5, policies: DEFAULT_POLICY }),
    ).toBe(true);
  });

  it("flags a department that exceeds the (shifted) policy", () => {
    // achievement below → policy below=[10,10,35,40,5]; غير مرضي 30 > 10 → violation
    expect(
      isDeptCompliant({ categories: [30, 10, 30, 30, 0], employeeCount: 20, achievement: 0.6, policies: DEFAULT_POLICY }),
    ).toBe(false);
  });

  it("passes a compliant department", () => {
    expect(
      isDeptCompliant({ categories: [5, 5, 40, 40, 10], employeeCount: 20, achievement: 0.97, policies: DEFAULT_POLICY }),
    ).toBe(true);
  });
});
