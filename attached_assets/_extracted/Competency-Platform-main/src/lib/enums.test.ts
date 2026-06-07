import { describe, it, expect } from "vitest";
import { parseCompetencyType, parseCompetencyLevel, parseContractType } from "./enums";

describe("enum label parsers", () => {
  it("maps Arabic labels back to enum values", () => {
    expect(parseCompetencyType("قيادية")).toBe("LEADERSHIP");
    expect(parseCompetencyType("سلوكية")).toBe("BEHAVIORAL");
    expect(parseCompetencyLevel("متقدمة")).toBe("ADVANCED");
    expect(parseContractType("دوام كامل")).toBe("FULL_TIME");
  });

  it("also accepts the raw enum value (round-trips exports)", () => {
    expect(parseCompetencyType("LEADERSHIP")).toBe("LEADERSHIP");
    expect(parseContractType("FULL_TIME")).toBe("FULL_TIME");
  });

  it("trims whitespace and returns null for unknown input", () => {
    expect(parseCompetencyType("  تقنية  ")).toBe("TECHNICAL");
    expect(parseCompetencyType("غير معروف")).toBeNull();
    expect(parseCompetencyLevel("")).toBeNull();
  });
});
