import { describe, it, expect } from "vitest";
import {
  calculateScore,
  competencyTo100,
  ratingLabelFor,
} from "./scoring";

describe("competencyTo100", () => {
  it("maps the 1..5 scale onto 0..100", () => {
    expect(competencyTo100(1)).toBe(0);
    expect(competencyTo100(3)).toBe(50);
    expect(competencyTo100(5)).toBe(100);
  });
});

describe("ratingLabelFor", () => {
  it("returns the correct band label per threshold", () => {
    expect(ratingLabelFor(95)).toBe("متميز");
    expect(ratingLabelFor(91)).toBe("متميز");
    expect(ratingLabelFor(80)).toBe("يتجاوز التوقعات");
    expect(ratingLabelFor(61)).toBe("يحقق التوقعات");
    expect(ratingLabelFor(50)).toBe("يحتاج تحسيناً");
    expect(ratingLabelFor(10)).toBe("دون المستوى");
    expect(ratingLabelFor(0)).toBe("دون المستوى");
  });
});

describe("calculateScore", () => {
  it("weights KPIs and competencies (BOTH mode, default 60/40)", () => {
    const r = calculateScore({
      mode: "BOTH",
      kpiWeight: 60,
      behavioral: [5, 5, 5, 5, 5], // -> 100
      leadership: [5, 5, 5, 5, 5], // -> 100
      technical: [5, 5, 5, 5], // -> 100
      jobSpecific: [5, 5], // -> 100
      kpis: [80, 80],
    });
    expect(r.kpiScore).toBe(80);
    expect(r.competencyScore).toBe(100);
    // 80*0.6 + 100*0.4 = 48 + 40 = 88
    expect(r.totalScore).toBe(88);
    expect(r.ratingLabel).toBe("يتجاوز التوقعات");
  });

  it("converts a mid 1..5 rating correctly", () => {
    const r = calculateScore({
      mode: "SHARED",
      kpiWeight: 60,
      behavioral: [3, 3, 3, 3, 3], // avg 3 -> 50
      leadership: [3, 3, 3, 3, 3],
      technical: [3, 3, 3, 3],
    });
    expect(r.groupScores.behavioral).toBe(50);
    expect(r.competencyScore).toBe(50);
    // only competencies present -> used at full weight
    expect(r.totalScore).toBe(50);
    expect(r.ratingLabel).toBe("يحتاج تحسيناً");
  });

  it("uses KPIs at full weight when no competencies are present", () => {
    const r = calculateScore({
      mode: "SPECIFIC",
      kpiWeight: 60,
      kpis: [90, 90, 90],
    });
    expect(r.competencyScore).toBeNull();
    expect(r.kpiScore).toBe(90);
    expect(r.totalScore).toBe(90);
    expect(r.ratingLabel).toBe("يتجاوز التوقعات");
  });

  it("ignores shared groups in SPECIFIC mode and job comps in SHARED mode", () => {
    const specific = calculateScore({
      mode: "SPECIFIC",
      kpiWeight: 50,
      behavioral: [5, 5, 5, 5, 5], // ignored
      jobSpecific: [4, 4], // avg 4 -> 75
      kpis: [60],
    });
    expect(specific.groupScores.behavioral).toBeNull();
    expect(specific.groupScores.jobSpecific).toBe(75);
    // 60*0.5 + 75*0.5 = 67.5 -> 68
    expect(specific.totalScore).toBe(68);

    const shared = calculateScore({
      mode: "SHARED",
      kpiWeight: 50,
      jobSpecific: [1, 1], // ignored
      behavioral: [4, 4, 4, 4, 4], // -> 75
      kpis: [60],
    });
    expect(shared.groupScores.jobSpecific).toBeNull();
    expect(shared.groupScores.behavioral).toBe(75);
  });

  it("averages only the present groups", () => {
    const r = calculateScore({
      mode: "BOTH",
      kpiWeight: 0,
      behavioral: [5, 5, 5, 5, 5], // 100
      // leadership/technical not rated
      jobSpecific: [3, 3], // 50
    });
    // competency avg = (100 + 50) / 2 = 75; kpiWeight 0 -> all competency
    expect(r.competencyScore).toBe(75);
    expect(r.totalScore).toBe(75);
  });

  it("returns nulls when nothing is rated", () => {
    const r = calculateScore({ mode: "BOTH", kpiWeight: 60 });
    expect(r.totalScore).toBeNull();
    expect(r.ratingLabel).toBeNull();
    expect(r.kpiScore).toBeNull();
    expect(r.competencyScore).toBeNull();
  });

  it("clamps an out-of-range weight", () => {
    const r = calculateScore({
      mode: "BOTH",
      kpiWeight: 150,
      behavioral: [1, 1, 1, 1, 1], // 0
      kpis: [100],
    });
    // weight clamped to 100 -> all KPI
    expect(r.totalScore).toBe(100);
  });
});
