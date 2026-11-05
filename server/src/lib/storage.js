import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import { safeEqual } from "./tokens.js";

/**
 * File storage behind a small interface so Cloudinary/S3 can replace the local driver later:
 *   save(buffer, { userId, ext }) → storageKey
 *   remove(storageKey)
 *   signedUrl(storageKey, { fileName, inline, ttlSeconds }) → { url, expiresAt }
 *   (local only) resolve(storageKey) → absolute path, verify(params) → boolean
 */

const ROOT = path.resolve(process.cwd(), env.UPLOAD_DIR);
// Keys look like "<userId>/<32 hex chars>.<ext>". Anything else is rejected, which rules out path traversal.
const KEY_PATTERN = /^[a-z0-9]+\/[a-f0-9]{32}\.(pdf|docx|doc)$/;
// Derive a dedicated signing key so download links can't be confused with session tokens.
const SIGNING_KEY = crypto.createHmac("sha256", env.AUTH_SECRET).update("jat:file-download-urls").digest();

const sign = (key, exp, name, inline) =>
  crypto.createHmac("sha256", SIGNING_KEY).update(`${key}\n${exp}\n${name}\n${inline ? 1 : 0}`).digest("base64url");

function resolve(key) {
  if (!KEY_PATTERN.test(key)) throw new Error(`Invalid storage key: ${key}`);
  const full = path.join(ROOT, key);
  if (!full.startsWith(ROOT + path.sep)) throw new Error("Path escapes upload directory");
  return full;
}

export const localStorage = {
  async save(buffer, { userId, ext }) {
    const key = `${userId}/${crypto.randomBytes(16).toString("hex")}.${ext}`;
    const full = resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, buffer, { flag: "wx" });
    return key;
  },

  async remove(key) {
    const full = resolve(key);
    await fs.rm(full, { force: true });
    await fs.rmdir(path.dirname(full)).catch(() => {}); // tidy up the user's folder once it's empty
  },

  signedUrl(key, { fileName, inline = false, ttlSeconds = 300 }) {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const params = new URLSearchParams({ exp: String(exp), name: fileName, sig: sign(key, exp, fileName, inline) });
    if (inline) params.set("inline", "1");
    // Relative URL: the browser fetches it through the Next.js /api/v1 rewrite.
    return { url: `/api/v1/files/${key}?${params}`, expiresAt: new Date(exp * 1000) };
  },

  /** Checks a download link's signature and expiry. */
  verify({ key, exp, name, inline, sig }) {
    if (!KEY_PATTERN.test(key) || !/^\d+$/.test(exp ?? "") || !name || !sig) return false;
    if (Number(exp) < Date.now() / 1000) return false;
    return safeEqual(sig, sign(key, Number(exp), name, inline));
  },

  resolve,
};

export const storage = localStorage; // switch on env.STORAGE_DRIVER when more drivers exist
