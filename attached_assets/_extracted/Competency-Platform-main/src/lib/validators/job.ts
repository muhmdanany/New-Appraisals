import { z } from "zod";
import { CONTRACT_TYPES } from "@/lib/enums";
import { idSchema, optionalText } from "./common";

export const jobInputSchema = z.object({
  name: z.string().trim().min(2, "المسمى الوظيفي مطلوب").max(200),
  // Empty string = "no selection"; the router converts it to null.
  departmentId: z.string().optional(),
  gradeId: z.string().optional(),
  reportsToJobId: z.string().optional(),
  contractType: z.enum(CONTRACT_TYPES).default("FULL_TIME"),
  experienceLevel: optionalText(100),
  description: optionalText(),
  competencyIds: z.array(idSchema).default([]),
});
export type JobInput = z.infer<typeof jobInputSchema>;

export const jobUpdateSchema = jobInputSchema.extend({ id: idSchema });

/**
 * Import row: references department by name and grade by number (resolved on the
 * server), and competencies by comma-separated names (linked when they exist).
 */
export const jobImportRowSchema = z.object({
  name: z.string().trim().min(2).max(200),
  departmentName: optionalText(200),
  gradeNum: optionalText(20),
  contractType: z.enum(CONTRACT_TYPES).default("FULL_TIME"),
  experienceLevel: optionalText(100),
  description: optionalText(),
  competencyNames: z.array(z.string().trim().min(1)).default([]),
});
export const jobImportSchema = z.object({
  rows: z.array(jobImportRowSchema).min(1).max(2000),
});
