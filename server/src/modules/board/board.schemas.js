import { ApplicationStatus, EmploymentType } from "@prisma/client";
import { z } from "zod";
import { csvOf } from "../../utils/zod.js";

/**
 * Where to drop the card in the `status` column. Send exactly one of:
 *  - beforeId: the card it should sit directly above, or null for the end of the column.
 *    Works even when the board is filtered (hidden cards don't shift the position).
 *  - index: 0-based slot in the full column, counted without the moved card. Past the end = append.
 */
export const moveSchema = z
  .object({
    status: z.enum(ApplicationStatus),
    index: z.number().int().min(0).max(100_000).optional(),
    beforeId: z.string().min(1).max(50).nullable().optional(),
  })
  .strict()
  .refine((d) => (d.index === undefined) !== (d.beforeId === undefined), {
    message: "Send either index or beforeId",
    path: ["index"],
  });

export const boardQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  employmentType: csvOf(EmploymentType),
});
