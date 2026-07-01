import { z } from "zod";
import { idSchema, optionalText } from "./common";

export const kpiEntrySchema = z.object({
  name: z.string().trim().min(1, "اسم المؤشر مطلوب").max(300),
  description: optionalText(),
  measure: optionalText(300),
  target: optionalText(200),
  frequency: optionalText(100),
  weight: optionalText(50),
});

export const kpiGroupSchema = z.object({
  competencyName: z.string().trim().min(1, "اسم الجدارة مطلوب").max(200),
  compType: optionalText(100),
  kpis: z.array(kpiEntrySchema).min(1, "أضف مؤشراً واحداً على الأقل").max(20),
});

export const kpiSaveSchema = z.object({
  jobId: idSchema,
  summary: optionalText(1000),
  isAiGenerated: z.boolean().default(false),
  groups: z.array(kpiGroupSchema).min(1, "أضف مجموعة واحدة على الأقل").max(40),
});
export type KpiSaveInput = z.infer<typeof kpiSaveSchema>;

/** Shape we accept back from the AI model (no jobId). */
export const aiKpiResultSchema = z.object({
  summary: optionalText(1000),
  groups: z.array(kpiGroupSchema).min(1).max(40),
});
export type AiKpiResult = z.infer<typeof aiKpiResultSchema>;
