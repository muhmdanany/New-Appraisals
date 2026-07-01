/**
 * Enum value ↔ Arabic label maps, mirroring the Prisma enums. Dependency-free so
 * they work in client components and import/export logic. Used for display, form
 * selects, and mapping spreadsheet labels back to enum values on import.
 */

export const COMPETENCY_TYPES = ["LEADERSHIP", "TECHNICAL", "BEHAVIORAL", "JOB", "MANAGERIAL"] as const;
export type CompetencyType = (typeof COMPETENCY_TYPES)[number];
export const COMPETENCY_TYPE_LABELS: Record<CompetencyType, string> = {
  LEADERSHIP: "قيادية",
  TECHNICAL: "تقنية",
  BEHAVIORAL: "سلوكية",
  JOB: "وظيفية",
  MANAGERIAL: "إدارية",
};

export const COMPETENCY_LEVELS = ["BASIC", "INTERMEDIATE", "ADVANCED", "EXPERT"] as const;
export type CompetencyLevel = (typeof COMPETENCY_LEVELS)[number];
export const COMPETENCY_LEVEL_LABELS: Record<CompetencyLevel, string> = {
  BASIC: "أساسية",
  INTERMEDIATE: "متوسطة",
  ADVANCED: "متقدمة",
  EXPERT: "خبير",
};

export const CONTRACT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "TEMPORARY"] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];
export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  FULL_TIME: "دوام كامل",
  PART_TIME: "دوام جزئي",
  CONTRACT: "عقد",
  TEMPORARY: "مؤقت",
};

export const DEPARTMENT_LEVELS = ["SECTOR", "DIVISION", "DEPARTMENT"] as const;
export type DepartmentLevel = (typeof DEPARTMENT_LEVELS)[number];
export const DEPARTMENT_LEVEL_LABELS: Record<DepartmentLevel, string> = {
  SECTOR: "قطاع",
  DIVISION: "إدارة",
  DEPARTMENT: "قسم",
};

/**
 * Experience levels for jobs, each mapped to the grade number it implies. Used to
 * auto-select a job's grade from the chosen experience level (admin can override).
 */
export const EXPERIENCE_LEVELS: { label: string; gradeNum: string }[] = [
  { label: "مبتدئ (0-2 سنوات)", gradeNum: "2" },
  { label: "متوسط (3-5 سنوات)", gradeNum: "4" },
  { label: "خبير (6-9 سنوات)", gradeNum: "7" },
  { label: "قيادي (10-14 سنة)", gradeNum: "10" },
  { label: "تنفيذي (15 سنة فأكثر)", gradeNum: "12" },
];

export const CAREER_STAGE_LEVELS = ["ENTRY", "MID", "SENIOR", "LEAD", "EXEC"] as const;
export type CareerStageLevel = (typeof CAREER_STAGE_LEVELS)[number];
export const CAREER_STAGE_LEVEL_LABELS: Record<CareerStageLevel, string> = {
  ENTRY: "مبتدئ",
  MID: "متوسط",
  SENIOR: "خبير",
  LEAD: "قيادي",
  EXEC: "تنفيذي",
};

/** Build a reverse (label → value) lookup that also accepts the raw enum value. */
function reverseMap<T extends string>(labels: Record<T, string>): (input: string) => T | null {
  const byLabel = new Map<string, T>();
  (Object.entries(labels) as [T, string][]).forEach(([value, label]) => {
    byLabel.set(label.trim(), value);
    byLabel.set(value, value);
  });
  return (input: string) => byLabel.get(input.trim()) ?? null;
}

export const parseCompetencyType = reverseMap(COMPETENCY_TYPE_LABELS);
export const parseCompetencyLevel = reverseMap(COMPETENCY_LEVEL_LABELS);
export const parseContractType = reverseMap(CONTRACT_TYPE_LABELS);
