import { ApplicationStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { todayFor } from "../applications/applications.service.js";

const DAY = 24 * 60 * 60 * 1000;
const ymd = (date) => date.toISOString().slice(0, 10);

/**
 * Counts from the status history (see docs/01-requirements.md §6).
 * "Applied" = ever reached a status that means the application was sent (not just SAVED → WITHDRAWN).
 * "Ever reached X" counts an application once, even if it later moved on (e.g. INTERVIEW → REJECTED).
 */
async function outcomeCounts(userId) {
  const [row] = await prisma.$queryRaw`
    SELECT
      COUNT(DISTINCT sc."applicationId") FILTER (WHERE sc."toStatus" IN ('APPLIED','ASSESSMENT','INTERVIEW','OFFER','REJECTED'))::int AS applied,
      COUNT(DISTINCT sc."applicationId") FILTER (WHERE sc."toStatus" IN ('ASSESSMENT','INTERVIEW','OFFER','REJECTED'))::int AS responded,
      COUNT(DISTINCT sc."applicationId") FILTER (WHERE sc."toStatus" = 'INTERVIEW')::int AS interviewed,
      COUNT(DISTINCT sc."applicationId") FILTER (WHERE sc."toStatus" = 'OFFER')::int AS offered
    FROM "StatusChange" sc
    WHERE sc."userId" = ${userId}`;
  // Rejection rate uses the *current* status.
  const rejected = await prisma.application.count({
    where: { userId, status: "REJECTED", statusChanges: { some: { toStatus: { in: ["APPLIED", "ASSESSMENT", "INTERVIEW", "OFFER", "REJECTED"] } } } },
  });
  return { ...row, rejected };
}

/** count / applied, rounded to 4 decimals; null when nothing has been applied for yet. */
const rate = (count, applied) => (applied === 0 ? null : Math.round((count / applied) * 10_000) / 10_000);

export async function summary(userId) {
  const [total, grouped, counts, upcomingInterviews, recentApplications] = await Promise.all([
    prisma.application.count({ where: { userId } }),
    prisma.application.groupBy({ by: ["status"], where: { userId }, _count: { _all: true } }),
    outcomeCounts(userId),
    prisma.interview.findMany({
      where: { userId, startsAt: { gte: new Date() }, outcome: "PENDING" },
      orderBy: { startsAt: "asc" },
      take: 5,
      select: {
        id: true,
        title: true,
        type: true,
        startsAt: true,
        durationMinutes: true,
        timezone: true,
        meetingUrl: true,
        location: true,
        application: { select: { id: true, company: true, jobTitle: true } },
      },
    }),
    prisma.application.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5,
      select: { id: true, company: true, jobTitle: true, status: true, employmentType: true, appliedAt: true, createdAt: true },
    }),
  ]);

  // All 7 statuses, in pipeline order, zero-filled.
  const byStatus = Object.fromEntries(Object.values(ApplicationStatus).map((s) => [s, 0]));
  for (const g of grouped) byStatus[g.status] = g._count._all;

  const { applied, responded, interviewed, offered, rejected } = counts;
  return {
    total,
    byStatus,
    counts: { applied, responded, interviewed, offered, rejected },
    rates: {
      response: rate(responded, applied),
      interview: rate(interviewed, applied),
      offer: rate(offered, applied),
      rejection: rate(rejected, applied),
    },
    upcomingInterviews,
    recentApplications,
  };
}

/**
 * Applications (by appliedAt) and interviews (by start time, cancelled excluded) per week
 * for the last `weeks` weeks, Monday-based, in the user's timezone. Empty weeks are included.
 */
export async function activity(user, weeks) {
  const today = todayFor(user);
  const thisMonday = new Date(today.getTime() - ((today.getUTCDay() + 6) % 7) * DAY);
  const start = new Date(thisMonday.getTime() - (weeks - 1) * 7 * DAY);
  const end = new Date(thisMonday.getTime() + 7 * DAY); // exclusive
  const [startStr, endStr] = [ymd(start), ymd(end)];

  // Interview times are stored as UTC; convert to the user's zone before bucketing.
  const localStart = Prisma.sql`(("startsAt" AT TIME ZONE 'UTC') AT TIME ZONE ${user.timezone})::date`;

  const [appliedRows, interviewRows] = await Promise.all([
    prisma.$queryRaw`
      SELECT date_trunc('week', "appliedAt")::date AS week, COUNT(*)::int AS count
      FROM "Application"
      WHERE "userId" = ${user.id} AND "appliedAt" >= ${startStr}::date AND "appliedAt" < ${endStr}::date
      GROUP BY 1`,
    prisma.$queryRaw`
      SELECT date_trunc('week', ${localStart})::date AS week, COUNT(*)::int AS count
      FROM "Interview"
      WHERE "userId" = ${user.id} AND "outcome" <> 'CANCELLED'
        AND ${localStart} >= ${startStr}::date AND ${localStart} < ${endStr}::date
      GROUP BY 1`,
  ]);

  const toMap = (rows) => new Map(rows.map((r) => [ymd(r.week), r.count]));
  const applied = toMap(appliedRows);
  const interviews = toMap(interviewRows);

  return Array.from({ length: weeks }, (_, i) => {
    const weekStart = ymd(new Date(start.getTime() + i * 7 * DAY));
    return { weekStart, applied: applied.get(weekStart) ?? 0, interviews: interviews.get(weekStart) ?? 0 };
  });
}

export async function funnel(userId) {
  const { applied, interviewed, offered } = await outcomeCounts(userId);
  return [
    { stage: "APPLIED", count: applied },
    { stage: "INTERVIEW", count: interviewed },
    { stage: "OFFER", count: offered },
  ];
}
