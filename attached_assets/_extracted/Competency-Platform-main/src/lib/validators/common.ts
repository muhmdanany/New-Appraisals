import { z } from "zod";

/** A non-empty id (cuid). */
export const idSchema = z.string().min(1, "معرّف غير صالح");

/** Standard list query params: search + pagination. */
export const listParamsSchema = z.object({
  search: z.string().trim().max(200).optional(),
  take: z.number().int().min(1).max(500).default(100),
  skip: z.number().int().min(0).default(0),
});
export type ListParams = z.infer<typeof listParamsSchema>;

/** Normalizes an optional free-text field: trims and turns "" into undefined. */
export const optionalText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));
