import { z } from "zod";
import { idSchema, optionalText } from "./common";

/** Dynamic extra columns from Excel imports — arbitrary string key/value pairs. */
export const extraFieldsSchema = z.record(z.string(), z.string()).default({});

export const employeeInputSchema = z.object({
  name: z.string().trim().min(2, "الاسم مطلوب").max(200),
  employeeNumber: z.string().trim().min(1, "الرقم الوظيفي مطلوب").max(50),
  // Empty string = "no selection"; the router converts it to null.
  jobId: z.string().optional(),
  departmentId: z.string().optional(),
  gradeId: z.string().optional(),
  managerId: z.string().optional(),
  extraFields: extraFieldsSchema,
});
export type EmployeeInput = z.infer<typeof employeeInputSchema>;

export const employeeUpdateSchema = employeeInputSchema.extend({ id: idSchema });

/** Import row: references job/department/grade/manager by human-readable keys. */
export const employeeImportRowSchema = z.object({
  name: z.string().trim().min(1).max(200),
  employeeNumber: z.string().trim().min(1).max(50),
  jobName: optionalText(200),
  departmentName: optionalText(200),
  gradeNum: optionalText(20),
  managerNumber: optionalText(50),
  extraFields: extraFieldsSchema,
});
export const employeeImportSchema = z.object({
  rows: z.array(employeeImportRowSchema).min(1).max(5000),
});
