import { prisma } from "../../lib/prisma.js";
import { storage } from "../../lib/storage/index.js";

/**
 * Deletes the account and everything in it. Database rows go via cascades; stored files are
 * removed afterwards (a failed file delete is logged, never left blocking the account deletion).
 */
export async function deleteAccount(userId) {
  const documents = await prisma.document.findMany({ where: { userId }, select: { storageKey: true } });
  await prisma.user.delete({ where: { id: userId } });
  const results = await Promise.allSettled(documents.map((d) => storage.remove(d.storageKey)));
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length) console.error(`Account ${userId} deleted, but ${failed.length} file(s) could not be removed`);
}
