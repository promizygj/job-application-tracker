import { z } from "zod";

// Forms send "" for cleared fields; store those as null.
const emptyToNull = (v) => (typeof v === "string" && v.trim() === "" ? null : v);

/** Optional field that may be null; "" is treated as null. */
export const nullable = (schema) => z.preprocess(emptyToNull, schema.nullable()).optional();

/** Optional, trimmed free text up to `max` characters. */
export const text = (max) => nullable(z.string().trim().max(max));

/** http(s) URL. */
export const httpUrl = (message = "Enter a valid http(s) URL") => z.url({ protocol: /^https?$/, error: message }).max(2048);

/** "YYYY-MM-DD" → Date at 00:00 UTC (matches @db.Date columns). */
export const isoDate = z.iso.date("Use the format YYYY-MM-DD").transform((v) => new Date(`${v}T00:00:00.000Z`));

/** ISO 8601 date-time with timezone offset → Date. */
export const isoDateTime = z.iso
  .datetime({ offset: true, error: "Use an ISO date-time, e.g. 2026-11-10T14:00:00Z" })
  .transform((v) => new Date(v));

/** Query param like "A,B,C" → validated array of enum values. */
export const csvOf = (enumObj) =>
  z
    .string()
    .transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean))
    .pipe(z.array(z.enum(enumObj)).min(1))
    .optional();

export const isTimezone = (tz) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const timezone = z.string().refine(isTimezone, "Unknown timezone");

export const page = z.coerce.number().int().min(1).default(1);
export const limit = z.coerce.number().int().min(1).max(100).default(20);
