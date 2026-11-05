import crypto from "node:crypto";

/** Random URL-safe token (sent to the user) and its SHA-256 hash (stored in the DB). */
export function createToken() {
  const token = crypto.randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}
