import { prisma } from "../../lib/prisma.js";
import { notFound } from "../../utils/AppError.js";

const APPLICATION_SUMMARY = { select: { id: true, company: true, jobTitle: true, status: true } };
// Scheduling an interview for an application in one of these statuses suggests moving it to INTERVIEW (INT-4).
const SUGGEST_INTERVIEW_FROM = new Set(["SAVED", "APPLIED", "ASSESSMENT"]);

async function findOwnedApplication(userId, applicationId) {
  const app = await prisma.application.findFirst({ where: { id: applicationId, userId }, select: { id: true, status: true } });
  if (!app) throw notFound("Application");
  return app;
}

export async function list(userId, { when, from, to, toInclusive, outcome, page, limit }) {
  const now = new Date();
  const startsAt = [
    when === "upcoming" && { startsAt: { gte: now } },
    when === "past" && { startsAt: { lt: now } },
    from && { startsAt: { gte: from } },
    to && { startsAt: toInclusive ? { lte: to } : { lt: to } },
  ].filter(Boolean);

  const where = { userId, ...(outcome && { outcome: { in: outcome } }), AND: startsAt };
  // Past interviews read most-recent first; everything else soonest first.
  const dir = when === "past" ? "desc" : "asc";

  const [total, items] = await prisma.$transaction([
    prisma.interview.count({ where }),
    prisma.interview.findMany({
      where,
      orderBy: [{ startsAt: dir }, { id: dir }],
      include: { application: APPLICATION_SUMMARY },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function listForApplication(userId, applicationId) {
  await findOwnedApplication(userId, applicationId);
  return prisma.interview.findMany({ where: { applicationId }, orderBy: { startsAt: "asc" } });
}

export async function getById(userId, id) {
  const interview = await prisma.interview.findFirst({ where: { id, userId }, include: { application: APPLICATION_SUMMARY } });
  if (!interview) throw notFound("Interview");
  return interview;
}

/** Returns the interview plus `suggestedStatus: "INTERVIEW"` when the client should offer to move the application. */
export async function create(user, applicationId, data) {
  const app = await findOwnedApplication(user.id, applicationId);
  const interview = await prisma.interview.create({
    data: { ...data, timezone: data.timezone ?? user.timezone, applicationId, userId: user.id },
    include: { application: APPLICATION_SUMMARY },
  });
  return { interview, suggestedStatus: SUGGEST_INTERVIEW_FROM.has(app.status) ? "INTERVIEW" : null };
}

export async function update(userId, id, data) {
  await getById(userId, id);
  return prisma.interview.update({ where: { id }, data, include: { application: APPLICATION_SUMMARY } });
}

export async function remove(userId, id) {
  const { count } = await prisma.interview.deleteMany({ where: { id, userId } });
  if (count === 0) throw notFound("Interview");
}
