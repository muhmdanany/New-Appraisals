import { z } from "zod";
import { idSchema, optionalText } from "./common";

export const gradeLevelInputSchema = z.object({
  level: z.number().int().min(1).max(50),
  label: z.string().trim().min(1, "المسمى مطلوب").max(200),
  minScore: z.number().int().min(0).max(100).default(85),
  stayYears: z.number().int().min(0).max(60).default(0),
  minYrsSecondary: z.number().int().min(0).max(60).default(0),
  minYrsDiploma: z.number().int().min(0).max(60).default(0),
  minYrsBachelor: z.number().int().min(0).max(60).default(0),
  minYrsMaster: z.number().int().min(0).max(60).default(0),
  minYrsPhd: z.number().int().min(0).max(60).default(0),
  competencies: optionalText(),
});
export type GradeLevelInput = z.infer<typeof gradeLevelInputSchema>;

export const gradeInputSchema = z.object({
  num: z.string().trim().min(1, "رقم الدرجة مطلوب").max(20),
  name: z.string().trim().min(1, "اسم الدرجة مطلوب").max(200),
  classification: optionalText(200),
  leaveDays: z.number().int().min(0).max(365).default(21),
  salaryMin: z.number().nonnegative().nullable().optional(),
  salaryMax: z.number().nonnegative().nullable().optional(),
  housing: optionalText(200),
  transport: optionalText(200),
  bonus: optionalText(200),
  benefits: optionalText(),
  levels: z.array(gradeLevelInputSchema).min(1, "أضف مستوى واحداً على الأقل"),
});
export type GradeInput = z.infer<typeof gradeInputSchema>;

export const gradeUpdateSchema = gradeInputSchema.extend({ id: idSchema });

export const gradeImportSchema = z.object({
  rows: z.array(gradeInputSchema).min(1).max(500),
});
