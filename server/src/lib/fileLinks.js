import crypto from "node:crypto";
import { env } from "../config/env.js";
import { safeEqual } from "./tokens.js";
import { isStorageKey } from "./storage/index.js";

// A dedicated key (derived from AUTH_SECRET) so download links can't be confused with session tokens.
const SIGNING_KEY = crypto.createHmac("sha256", env.AUTH_SECRET).update("jat:file-download-urls").digest();

const sign = (key, exp, name, inline) =>
  crypto.createHmac("sha256", SIGNING_KEY).update(`${key}\n${exp}\n${name}\n${inline ? 1 : 0}`).digest("base64url");

/**
 * Short-lived link to a stored file, served by GET /api/v1/files/... (whatever the storage driver).
 * Relative, so the browser fetches it through the Next.js /api/v1 rewrite.
 */
export function signFileLink(key, { fileName, inline = false, ttlSeconds = 300 }) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const params = new URLSearchParams({ exp: String(exp), name: fileName, sig: sign(key, exp, fileName, inline) });
  if (inline) params.set("inline", "1");
  return { url: `/api/v1/files/${key}?${params}`, expiresAt: new Date(exp * 1000) };
}

/** Checks a link's signature and expiry. */
export function verifyFileLink({ key, exp, name, inline, sig }) {
  if (!isStorageKey(key) || !/^\d+$/.test(exp ?? "") || !name || !sig) return false;
  if (Number(exp) < Date.now() / 1000) return false;
  return safeEqual(sig, sign(key, Number(exp), name, inline));
}
