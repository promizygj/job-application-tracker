import { pipeline } from "node:stream/promises";
import { Router } from "express";
import { ALLOWED } from "../../lib/fileType.js";
import { verifyFileLink } from "../../lib/fileLinks.js";
import { StorageNotFoundError, storage } from "../../lib/storage/index.js";

/**
 * Streams stored files (local disk or Cloudinary). There's no session check: the HMAC signature
 * in the URL (issued by GET /documents/:id/download, valid 5 minutes) is the authorization.
 */
export const filesRouter = Router();

filesRouter.get("/:userId/:file", async (req, res) => {
  const key = `${req.params.userId}/${req.params.file}`;
  const { exp, name, sig } = req.query;
  const inline = req.query.inline === "1";

  if (!verifyFileLink({ key, exp, name, inline, sig })) {
    return res.status(403).json({ error: { code: "LINK_EXPIRED", message: "This download link is invalid or has expired" } });
  }

  let file;
  try {
    file = await storage.read(key);
  } catch (err) {
    if (err instanceof StorageNotFoundError) return res.status(404).json({ error: { code: "NOT_FOUND", message: "File not found" } });
    throw err;
  }

  res.set({
    "Content-Type": ALLOWED[key.split(".").pop()],
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(name)}`,
    // private: browsers may cache briefly; shared caches (e.g. Vercel's CDN) must not.
    "Cache-Control": "private, max-age=300",
    ...(file.size && { "Content-Length": String(file.size) }),
  });
  try {
    await pipeline(file.stream, res);
  } catch (err) {
    if (!res.headersSent) throw err;
    res.destroy(err); // connection already streaming: just stop
  }
});
