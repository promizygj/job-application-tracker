import { decode } from "@auth/core/jwt";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { safeEqual } from "../lib/tokens.js";
import { AppError } from "../utils/AppError.js";

// Auth.js names the cookie differently over HTTPS. The cookie name is also the JWT salt.
const COOKIE_NAMES = ["__Secure-authjs.session-token", "authjs.session-token"];

/**
 * Reads the Auth.js session cookie (set by the Next.js app), decrypts it with the shared
 * AUTH_SECRET and loads the user. Rejects sessions whose sessionVersion is stale.
 */
export async function requireAuth(req, res, next) {
  const name = COOKIE_NAMES.find((n) => req.cookies?.[n]);
  if (!name) throw new AppError(401, "UNAUTHENTICATED", "Not signed in");

  let payload;
  try {
    payload = await decode({ token: req.cookies[name], secret: env.AUTH_SECRET, salt: name });
  } catch {
    payload = null;
  }
  if (!payload?.sub) throw new AppError(401, "UNAUTHENTICATED", "Invalid session");

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.sessionVersion !== payload.sv) {
    throw new AppError(401, "UNAUTHENTICATED", "Session expired, please sign in again");
  }
  req.user = user;
  next();
}

export function requireVerified(req, res, next) {
  if (!req.user.emailVerifiedAt) throw new AppError(403, "EMAIL_NOT_VERIFIED", "Please verify your email first");
  next();
}

/** For server-to-server calls from the Next.js Auth.js config only. */
export function requireInternal(req, res, next) {
  if (!safeEqual(req.get("x-internal-secret") ?? "", env.INTERNAL_API_SECRET)) {
    throw new AppError(401, "UNAUTHENTICATED", "Internal endpoint");
  }
  next();
}
