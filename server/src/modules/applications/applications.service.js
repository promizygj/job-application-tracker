import { prisma } from "../../lib/prisma.js";
import { AppError, notFound } from "../../utils/AppError.js";

export const POSITION_GAP = 1000;
// Moving into any of these means the user has actually applied.
const NOT_APPLIED = new Set(["SAVED", "WITHDRAWN"]);

// List rows leave out the long text fields.
const LIST_SELECT = {
  id: true,
  company: true,
  jobTitle: true,
  jobUrl: true,
  location: true,
  employmentType: true,
  jobType: true,
  salaryMin: true,
  salaryMax: true,
  salaryCurrency: true,
  salaryPeriod: true,
  status: true,
  position: true,
  priority: true,
  source: true,
  appliedAt: true,
  followUpAt: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { interviews: true, documents: true } },
};

/** Today's date (00:00 UTC) in the user's own timezone, matching the @db.Date column. */
export function todayFor(user) {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: user.timezone }).format(new Date());
  return new Date(`${ymd}T00:00:00.000Z`);
}

/** Position after the last card in a Kanban column. */
export async function endOfColumn(tx, userId, status) {
  const { _max } = await tx.application.aggregate({ where: { userId, status }, _max: { position: true } });
  return (_max.position ?? 0) + POSITION_GAP;
}

function assertSalaryRange({ salaryMin, salaryMax }) {
  if (salaryMin != null && salaryMax != null && salaryMax < salaryMin) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid input", [
      { path: "salaryMax", message: "Maximum salary must be greater than or equal to the minimum" },
    ]);
  }
}

/**
 * Records a status move in the history and fills appliedAt when the user has now applied.
 * `patch` is the update about to be written; it may be modified.
 */
export async function recordStatusChange(tx, user, existing, toStatus, patch) {
  const appliedAt = "appliedAt" in patch ? patch.appliedAt : existing.appliedAt;
  if (!appliedAt && !NOT_APPLIED.has(toStatus)) patch.appliedAt = todayFor(user);
  await tx.statusChange.create({
    data: { applicationId: existing.id, userId: user.id, fromStatus: existing.status, toStatus },
  });
}

/** Prisma `where` for the search/filter query params (shared by the list and the board). */
export function buildWhere(userId, { q, status, employmentType, appliedFrom, appliedTo }) {
  return {
    userId,
    ...(q && {
      OR: [
        { company: { contains: q, mode: "insensitive" } },
        { jobTitle: { contains: q, mode: "insensitive" } },
      ],
    }),
    ...(status && { status: { in: status } }),
    ...(employmentType && { employmentType: { in: employmentType } }),
    ...((appliedFrom || appliedTo) && {
      appliedAt: { ...(appliedFrom && { gte: appliedFrom }), ...(appliedTo && { lte: appliedTo }) },
    }),
  };
}

export async function list(userId, query) {
  const { sort, page, limit } = query;
  const where = buildWhere(userId, query);

  const dir = sort.startsWith("-") ? "desc" : "asc";
  const field = sort.replace(/^-/, "");
  // Apps without an applied date go last either way; id breaks ties so pages are stable.
  const orderBy = [
    field === "appliedAt" ? { appliedAt: { sort: dir, nulls: "last" } } : { [field]: dir },
    { id: dir },
  ];

  const [total, items] = await prisma.$transaction([
    prisma.application.count({ where }),
    prisma.application.findMany({ where, orderBy, select: LIST_SELECT, skip: (page - 1) * limit, take: limit }),
  ]);

  return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getById(userId, id) {
  const app = await prisma.application.findFirst({
    where: { id, userId },
    include: {
      interviews: { orderBy: { startsAt: "asc" } },
      statusChanges: { orderBy: { changedAt: "asc" }, select: { id: true, fromStatus: true, toStatus: true, changedAt: true } },
      documents: {
        orderBy: { attachedAt: "asc" },
        include: {
          // storageKey stays server-side; downloads go through a signed URL endpoint.
          document: { select: { id: true, type: true, name: true, version: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true } },
        },
      },
    },
  });
  if (!app) throw notFound("Application");

  const { documents, ...rest } = app;
  return { ...rest, documents: documents.map(({ document, attachedAt }) => ({ ...document, attachedAt })) };
}

export function create(user, data) {
  assertSalaryRange(data);
  return prisma.$transaction(async (tx) => {
    const app = await tx.application.create({
      data: {
        ...data,
        userId: user.id,
        appliedAt: data.appliedAt ?? (NOT_APPLIED.has(data.status) ? null : todayFor(user)),
        position: await endOfColumn(tx, user.id, data.status),
      },
    });
    await tx.statusChange.create({
      data: { applicationId: app.id, userId: user.id, fromStatus: null, toStatus: app.status },
    });
    return app;
  });
}

export function update(user, id, data) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.application.findFirst({ where: { id, userId: user.id } });
    if (!existing) throw notFound("Application");
    assertSalaryRange({ ...existing, ...data });

    const patch = { ...data };
    if (data.status && data.status !== existing.status) {
      patch.position = await endOfColumn(tx, user.id, data.status);
      await recordStatusChange(tx, user, existing, data.status, patch);
    }
    return tx.application.update({ where: { id }, data: patch });
  });
}

export async function remove(userId, id) {
  const { count } = await prisma.application.deleteMany({ where: { id, userId } });
  if (count === 0) throw notFound("Application");
}

export async function history(userId, id) {
  const app = await prisma.application.findFirst({ where: { id, userId }, select: { id: true } });
  if (!app) throw notFound("Application");
  return prisma.statusChange.findMany({
    where: { applicationId: id },
    orderBy: { changedAt: "asc" },
    select: { id: true, fromStatus: true, toStatus: true, changedAt: true },
  });
}
