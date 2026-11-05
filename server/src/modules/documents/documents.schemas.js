import { DocumentType } from "@prisma/client";
import { z } from "zod";
import { text } from "../../utils/zod.js";

const name = z.string().trim().min(1, "Name is required").max(100); // logical name, e.g. "Frontend CV"
const bool = z.enum(["true", "false"]).transform((v) => v === "true");

// Multipart text fields that come with the file.
export const uploadFieldsSchema = z.object({ type: z.enum(DocumentType), name, notes: text(1000) }).strict();

export const updateDocumentSchema = z
  .object({
    name,
    notes: text(1000),
    // Each name group always has exactly one default, so you can only *make* a version the default.
    isDefault: z.literal(true, "Set isDefault to true to make this version the default"),
  })
  .partial()
  .strict()
  .refine((d) => Object.keys(d).length > 0, "Provide at least one field to update");

export const listQuerySchema = z.object({ type: z.enum(DocumentType).optional(), name: z.string().trim().max(100).optional() });
export const downloadQuerySchema = z.object({ inline: bool.optional() });
export const deleteQuerySchema = z.object({ force: bool.optional() });
export const attachSchema = z.object({ documentId: z.string().min(1).max(50) }).strict();
