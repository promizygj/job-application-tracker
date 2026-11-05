import path from "node:path";
import { prisma } from "../../lib/prisma.js";
import { detectDocumentType } from "../../lib/fileType.js";
import { storage } from "../../lib/storage.js";
import { AppError, notFound } from "../../utils/AppError.js";

// storageKey never leaves the server.
const SELECT = {
  id: true,
  type: true,
  name: true,
  version: true,
  isDefault: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  notes: true,
  createdAt: true,
  _count: { select: { applications: true } },
};
const present = ({ _count, ...doc }) => ({ ...doc, usedInCount: _count.applications });

async function findOwned(userId, id, db = prisma) {
  const doc = await db.document.findFirst({ where: { id, userId }, select: { ...SELECT, storageKey: true } });
  if (!doc) throw notFound("Document");
  return doc;
}

async function nextVersion(tx, userId, type, name) {
  const { _max } = await tx.document.aggregate({ where: { userId, type, name }, _max: { version: true } });
  return (_max.version ?? 0) + 1;
}

/** Keeps the rule "every non-empty (type, name) group has exactly one default": promotes the latest version if none. */
async function ensureDefault(tx, userId, type, name) {
  const hasDefault = await tx.document.count({ where: { userId, type, name, isDefault: true } });
  if (hasDefault) return;
  const latest = await tx.document.findFirst({ where: { userId, type, name }, orderBy: { version: "desc" }, select: { id: true } });
  if (latest) await tx.document.update({ where: { id: latest.id }, data: { isDefault: true } });
}

/** Original filename without directories or control characters, with the extension we detected. */
function cleanFileName(original, ext) {
  const base = path
    .basename(original ?? "document")
    .replace(/[\x00-\x1f\x7f"\\/]/g, "")
    .replace(/\.[^.]*$/, "")
    .trim()
    .slice(0, 200);
  return `${base || "document"}.${ext}`;
}

export async function list(userId, { type, name }) {
  const docs = await prisma.document.findMany({
    where: { userId, ...(type && { type }), ...(name && { name }) },
    orderBy: [{ type: "asc" }, { name: "asc" }, { version: "desc" }],
    select: SELECT,
  });
  return docs.map(present);
}

export async function getById(userId, id) {
  const { storageKey: _omit, ...doc } = await findOwned(userId, id);
  return present(doc);
}

/** Saves the file, then creates the next version of (type, name) and makes it the default. */
export async function upload(userId, { type, name, notes }, file) {
  if (!file) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid input", [{ path: "file", message: "Choose a file to upload" }]);
  }
  const detected = detectDocumentType(file.buffer);
  if (!detected) throw new AppError(415, "UNSUPPORTED_FILE_TYPE", "Only PDF, DOC and DOCX files are allowed");

  const storageKey = await storage.save(file.buffer, { userId, ext: detected.ext });
  try {
    const doc = await prisma.$transaction(async (tx) => {
      const version = await nextVersion(tx, userId, type, name);
      await tx.document.updateMany({ where: { userId, type, name }, data: { isDefault: false } });
      return tx.document.create({
        data: {
          userId,
          type,
          name,
          notes,
          version,
          isDefault: true,
          fileName: cleanFileName(file.originalname, detected.ext),
          mimeType: detected.mimeType,
          sizeBytes: file.size,
          storageKey,
        },
        select: SELECT,
      });
    });
    return present(doc);
  } catch (err) {
    await storage.remove(storageKey).catch(() => {}); // don't leave orphaned files
    if (err.code === "P2002") throw new AppError(409, "CONFLICT", "Another upload of this document finished at the same time. Please try again.");
    throw err;
  }
}

export async function update(userId, id, data) {
  return prisma.$transaction(async (tx) => {
    const existing = await findOwned(userId, id, tx);
    const patch = { ...(data.notes !== undefined && { notes: data.notes }) };
    const renamed = data.name !== undefined && data.name !== existing.name;
    const targetName = renamed ? data.name : existing.name;

    if (renamed) {
      // Joins the other group as its newest version.
      patch.name = data.name;
      patch.version = await nextVersion(tx, userId, existing.type, data.name);
      patch.isDefault = false;
    }
    if (data.isDefault) {
      await tx.document.updateMany({ where: { userId, type: existing.type, name: targetName }, data: { isDefault: false } });
      patch.isDefault = true;
    }

    await tx.document.update({ where: { id }, data: patch });
    await ensureDefault(tx, userId, existing.type, targetName);
    if (renamed) await ensureDefault(tx, userId, existing.type, existing.name);

    return present(await tx.document.findUniqueOrThrow({ where: { id }, select: SELECT }));
  });
}

export async function remove(userId, id, { force = false } = {}) {
  const doc = await findOwned(userId, id);
  const used = doc._count.applications;
  if (used > 0 && !force) {
    throw new AppError(409, "DOCUMENT_IN_USE", `This document is attached to ${used} application(s). Delete it anyway?`, [
      { path: "usedInCount", message: String(used) },
    ]);
  }
  await prisma.$transaction(async (tx) => {
    await tx.document.delete({ where: { id } });
    await ensureDefault(tx, userId, doc.type, doc.name);
  });
  await storage.remove(doc.storageKey).catch((err) => console.error("Failed to delete stored file:", err.message));
}

export async function downloadUrl(userId, id, { inline = false } = {}) {
  const doc = await findOwned(userId, id);
  return storage.signedUrl(doc.storageKey, { fileName: doc.fileName, inline });
}

// ── Attach / detach (DOC-3) ──

export async function listForApplication(userId, applicationId) {
  const app = await prisma.application.findFirst({ where: { id: applicationId, userId }, select: { id: true } });
  if (!app) throw notFound("Application");
  const links = await prisma.applicationDocument.findMany({
    where: { applicationId },
    orderBy: { attachedAt: "asc" },
    select: { attachedAt: true, document: { select: SELECT } },
  });
  return links.map(({ attachedAt, document }) => ({ ...present(document), attachedAt }));
}

export async function attach(userId, applicationId, documentId) {
  const [app, doc] = await Promise.all([
    prisma.application.findFirst({ where: { id: applicationId, userId }, select: { id: true } }),
    prisma.document.findFirst({ where: { id: documentId, userId }, select: { id: true } }),
  ]);
  if (!app) throw notFound("Application");
  if (!doc) throw notFound("Document");
  // Attaching twice is harmless.
  await prisma.applicationDocument.createMany({ data: [{ applicationId, documentId }], skipDuplicates: true });
  return getById(userId, documentId);
}

export async function detach(userId, applicationId, documentId) {
  const { count } = await prisma.applicationDocument.deleteMany({
    where: { applicationId, documentId, application: { userId } },
  });
  if (count === 0) throw notFound("Attached document");
}
