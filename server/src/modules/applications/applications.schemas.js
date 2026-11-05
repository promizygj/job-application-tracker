import { ApplicationStatus, EmploymentType, JobType, Priority, SalaryPeriod } from "@prisma/client";
import { z } from "zod";
import { csvOf, httpUrl, isoDate, isoDateTime, limit, nullable, page, text } from "../../utils/zod.js";

const money = nullable(z.number().int("Use whole numbers").min(0).max(100_000_000));

const fields = {
  company: z.string().trim().min(1, "Company is required").max(200),
  jobTitle: z.string().trim().min(1, "Job title is required").max(200),
  jobDescription: text(50_000),
  jobUrl: nullable(httpUrl()),
  location: text(200),
  employmentType: z.enum(EmploymentType, "Choose Remote, Hybrid or On-site"),
  jobType: nullable(z.enum(JobType)),
  salaryMin: money,
  salaryMax: money,
  salaryCurrency: nullable(z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code, e.g. USD")),
  salaryPeriod: nullable(z.enum(SalaryPeriod)),
  status: z.enum(ApplicationStatus),
  priority: z.enum(Priority),
  source: text(100),
  appliedAt: nullable(isoDate),
  followUpAt: nullable(isoDateTime),
  notes: text(20_000),
};

export const createApplicationSchema = z
  .object({
    ...fields,
    status: fields.status.default("SAVED"),
    priority: fields.priority.default("MEDIUM"),
  })
  .strict();

export const updateApplicationSchema = z
  .object(fields)
  .partial()
  .strict()
  .refine((d) => Object.keys(d).length > 0, "Provide at least one field to update");

export const SORT_FIELDS = ["appliedAt", "createdAt", "updatedAt", "company", "status"];

export const listQuerySchema = z
  .object({
    q: z.string().trim().max(200).optional(),
    status: csvOf(ApplicationStatus),
    employmentType: csvOf(EmploymentType),
    appliedFrom: isoDate.optional(),
    appliedTo: isoDate.optional(),
    sort: z
      .string()
      .regex(new RegExp(`^-?(${SORT_FIELDS.join("|")})$`), `Sort by one of: ${SORT_FIELDS.join(", ")} (prefix - for descending)`)
      .default("-createdAt"),
    page,
    limit,
  })
  .refine((d) => !d.appliedFrom || !d.appliedTo || d.appliedFrom <= d.appliedTo, {
    path: ["appliedTo"],
    message: "appliedTo must be on or after appliedFrom",
  });
