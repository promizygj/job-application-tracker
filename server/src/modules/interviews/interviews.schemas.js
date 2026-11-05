import { InterviewOutcome, InterviewType } from "@prisma/client";
import { z } from "zod";
import { csvOf, httpUrl, isoDateTime, limit, nullable, page, text, timezone } from "../../utils/zod.js";

const fields = {
  title: z.string().trim().min(1, "Title is required").max(150),
  type: z.enum(InterviewType),
  startsAt: isoDateTime,
  durationMinutes: z.number().int("Use whole minutes").min(5).max(24 * 60),
  timezone, // IANA name, e.g. "Europe/London" — the zone the interview was arranged in
  location: text(300),
  meetingUrl: nullable(httpUrl()),
  interviewerName: text(150),
  interviewerRole: text(150),
  interviewerEmail: nullable(z.email("Enter a valid email").max(254)),
  prepNotes: text(20_000),
  feedbackNotes: text(20_000),
  outcome: z.enum(InterviewOutcome),
};

export const createInterviewSchema = z
  .object({
    ...fields,
    durationMinutes: fields.durationMinutes.default(60),
    timezone: fields.timezone.optional(), // defaults to the user's profile timezone
    outcome: fields.outcome.default("PENDING"),
  })
  .strict();

export const updateInterviewSchema = z
  .object(fields)
  .partial()
  .strict()
  .refine((d) => Object.keys(d).length > 0, "Provide at least one field to update");

/** A date ("2026-11-01") or a date-time with offset. */
const rangeBound = z.union([z.iso.datetime({ offset: true }), z.iso.date()], "Use YYYY-MM-DD or an ISO date-time");

export const listQuerySchema = z
  .object({
    when: z.enum(["upcoming", "past"]).optional(),
    // Calendar range. A date-only `to` includes that whole day (UTC).
    from: rangeBound.optional(),
    to: rangeBound.optional(),
    outcome: csvOf(InterviewOutcome),
    page,
    limit,
  })
  .transform(({ from, to, ...rest }) => ({
    ...rest,
    from: from && new Date(from.length === 10 ? `${from}T00:00:00.000Z` : from),
    to: to && (to.length === 10 ? new Date(Date.parse(`${to}T00:00:00.000Z`) + 24 * 60 * 60 * 1000) : new Date(to)),
    toInclusive: Boolean(to) && to.length !== 10,
  }))
  .refine((d) => !d.from || !d.to || d.from <= d.to, { path: ["to"], message: "`to` must be on or after `from`" });
