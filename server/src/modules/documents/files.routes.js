import { Router } from "express";
import { storage } from "../../lib/storage.js";

/**
 * Serves locally stored files. There's no session check: the HMAC signature in the URL
 * (issued by GET /documents/:id/download, valid 5 minutes) is the authorization.
 */
export const filesRouter = Router();

filesRouter.get("/:userId/:file", (req, res) => {
  const key = `${req.params.userId}/${req.params.file}`;
  const { exp, name, sig } = req.query;
  const inline = req.query.inline === "1";

  if (!storage.verify({ key, exp, name, inline, sig })) {
    return res.status(403).json({ error: { code: "LINK_EXPIRED", message: "This download link is invalid or has expired" } });
  }

  res.set({
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(name)}`,
    "Cache-Control": "private, max-age=300",
  });
  res.sendFile(storage.resolve(key), (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "File not found" } });
    }
  });
});
