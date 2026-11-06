import { ApplicationStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { notFound } from "../../utils/AppError.js";
import { buildWhere, POSITION_GAP, recordStatusChange } from "../applications/applications.service.js";

// Below this gap between neighbours, floats start losing precision: renumber the column instead.
const MIN_GAP = 1e-6;

const CARD_SELECT = {
  id: true,
  company: true,
  jobTitle: true,
  employmentType: true,
  location: true,
  salaryMin: true,
  salaryMax: true,
  salaryCurrency: true,
  salaryPeriod: true,
  status: true,
  position: true,
  priority: true,
  appliedAt: true,
  createdAt: true,
  updatedAt: true,
};

export async function getBoard(userId, query) {
  const now = new Date();
  const apps = await prisma.application.findMany({
    where: buildWhere(userId, query),
    orderBy: [{ position: "asc" }, { id: "asc" }],
    select: {
      ...CARD_SELECT,
      interviews: {
        where: { startsAt: { gte: now }, outcome: "PENDING" },
        orderBy: { startsAt: "asc" },
        take: 1,
        select: { startsAt: true },
      },
    },
  });

  // Every status gets a column, even when empty, in pipeline order.
  const columns = Object.fromEntries(Object.values(ApplicationStatus).map((s) => [s, []]));
  for (const { interviews, ...card } of apps) {
    columns[card.status].push({ ...card, nextInterviewAt: interviews[0]?.startsAt ?? null });
  }
  return { columns };
}

/** Position for a card dropped between `prev` and `next` (either may be missing). */
function positionBetween(prev, next) {
  if (prev == null && next == null) return POSITION_GAP;
  if (prev == null) return next - POSITION_GAP;
  if (next == null) return prev + POSITION_GAP;
  return (prev + next) / 2;
}

/**
 * Moves a card into the `status` column, before `beforeId` (null = end) or at `index`.
 * Only the moved card's row changes, unless its neighbours are too close together,
 * in which case the column is renumbered.
 */
export function move(user, id, { status, index, beforeId }) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.application.findFirst({ where: { id, userId: user.id } });
    if (!existing) throw notFound("Application");

    const column = await tx.application.findMany({
      where: { userId: user.id, status, id: { not: id } },
      orderBy: [{ position: "asc" }, { id: "asc" }],
      select: { id: true, position: true },
    });
    let slot;
    if (beforeId !== undefined) {
      const at = beforeId === null ? -1 : column.findIndex((c) => c.id === beforeId);
      slot = at === -1 ? column.length : at; // unknown/stale beforeId → append
    } else {
      slot = Math.min(index, column.length);
    }
    const prev = column[slot - 1]?.position;
    const next = column[slot]?.position;

    const patch = { status };
    if (prev != null && next != null && next - prev < MIN_GAP) {
      // Renumber the column (1000, 2000, …) with the moved card in its slot. Rare.
      const ordered = [...column.slice(0, slot), { id }, ...column.slice(slot)];
      for (const [i, card] of ordered.entries()) {
        if (card.id !== id) await tx.application.update({ where: { id: card.id }, data: { position: (i + 1) * POSITION_GAP } });
      }
      patch.position = (slot + 1) * POSITION_GAP;
    } else {
      patch.position = positionBetween(prev, next);
    }

    if (status !== existing.status) await recordStatusChange(tx, user, existing, status, patch);
    return tx.application.update({ where: { id }, data: patch, select: CARD_SELECT });
  });
}
