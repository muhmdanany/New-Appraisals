import { z } from "zod";
import { COMPETENCY_TYPES, COMPETENCY_LEVELS } from "@/lib/enums";
import { idSchema, optionalText } from "./common";

export const competencyInputSchema = z.object({
  name: z.string().trim().min(2, "الاسم مطلوب").max(200),
  type: z.enum(COMPETENCY_TYPES),
  level: z.enum(COMPETENCY_LEVELS),
  description: optionalText(),
  indicators: optionalText(),
});
export type CompetencyInput = z.infer<typeof competencyInputSchema>;

export const competencyUpdateSchema = competencyInputSchema.extend({ id: idSchema });

/** A single row coming from an Excel import (type/level already mapped to enums). */
export const competencyImportSchema = z.object({
  rows: z.array(competencyInputSchema).min(1).max(2000),
});

/** A single AI-suggested competency. */
export const aiCompetencySchema = z.object({
  name: z.string().trim().min(2).max(200),
  type: z.enum(COMPETENCY_TYPES),
  level: z.enum(COMPETENCY_LEVELS),
  description: optionalText(),
  indicators: optionalText(),
});
export type AiCompetency = z.infer<typeof aiCompetencySchema>;

export const aiCompetencyResultSchema = z.object({
  competencies: z.array(aiCompetencySchema).min(1).max(40),
});
export type AiCompetencyResult = z.infer<typeof aiCompetencyResultSchema>;

/** Persisting AI-generated competencies and linking them to the chosen job. */
export const competencyGenerateSaveSchema = z.object({
  jobId: idSchema,
  competencies: z.array(aiCompetencySchema).min(1).max(40),
});
