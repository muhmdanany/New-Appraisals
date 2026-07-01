import { z } from "zod";
import { CAREER_STAGE_LEVELS } from "@/lib/enums";
import { idSchema, optionalText } from "./common";

export const careerStageInputSchema = z.object({
  title: z.string().trim().min(1, "عنوان المرحلة مطلوب").max(200),
  level: z.enum(CAREER_STAGE_LEVELS),
  gradeNum: optionalText(20),
  durationInRole: optionalText(100),
  description: optionalText(),
  requiredCompetencies: z.array(z.string().trim().min(1)).max(30).default([]),
  promotionCriteria: z.array(z.string().trim().min(1)).max(30).default([]),
});
export type CareerStageInput = z.infer<typeof careerStageInputSchema>;

export const careerPathInputSchema = z.object({
  name: z.string().trim().min(2, "اسم المسار مطلوب").max(200),
  field: optionalText(200),
  duration: optionalText(100),
  description: optionalText(),
  stages: z.array(careerStageInputSchema).min(1, "أضف مرحلة واحدة على الأقل").max(20),
});
export type CareerPathInput = z.infer<typeof careerPathInputSchema>;

export const careerPathUpdateSchema = careerPathInputSchema.extend({ id: idSchema });

export const careerPathGenerateSchema = z.object({
  field: z.string().trim().min(2, "أدخل التخصص أو المجال").max(200),
});

/** Shape accepted back from the AI model. */
export const aiCareerPathSchema = z.object({
  name: z.string().trim().min(2).max(200),
  field: optionalText(200),
  duration: optionalText(100),
  description: optionalText(),
  stages: z.array(careerStageInputSchema).min(1).max(20),
});
export type AiCareerPath = z.infer<typeof aiCareerPathSchema>;
