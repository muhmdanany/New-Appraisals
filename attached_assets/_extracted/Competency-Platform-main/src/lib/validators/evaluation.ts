import { z } from "zod";
import { idSchema, optionalText } from "./common";

export const EVALUATION_MODES = ["SHARED", "SPECIFIC", "BOTH"] as const;

/** refKey → rating (1..5). */
const scoreMap = z.record(z.string(), z.number().int().min(1).max(5));

export const kpiItemSchema = z.object({
  name: z.string().trim().min(1, "اسم المؤشر مطلوب").max(200),
  achievement: z.number().min(0).max(100),
  note: optionalText(500),
});

/** Fields common to creating and editing a draft evaluation. */
export const evaluationSaveSchema = z.object({
  period: z.string().trim().min(1, "الفترة مطلوبة").max(100),
  mode: z.enum(EVALUATION_MODES),
  kpiWeight: z.number().int().min(0).max(100),
  sharedScores: scoreMap.default({}),
  jobScores: scoreMap.default({}),
  kpis: z.array(kpiItemSchema).max(30).default([]),
});
export type EvaluationSave = z.infer<typeof evaluationSaveSchema>;

export const evaluationCreateSchema = evaluationSaveSchema.extend({ employeeId: idSchema });
export const evaluationUpdateSchema = evaluationSaveSchema.extend({ id: idSchema });

export const evaluationRejectSchema = z.object({
  id: idSchema,
  reason: z.string().trim().min(1, "سبب الرفض مطلوب").max(2000),
});
export const evaluationObjectSchema = z.object({
  id: idSchema,
  items: z
    .array(
      z.object({
        itemId: idSchema,
        note: z.string().trim().max(2000).optional(),
      }),
    )
    .min(1, "اختر بنداً واحداً على الأقل للاعتراض عليه"),
});
