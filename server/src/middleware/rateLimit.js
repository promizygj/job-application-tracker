import { rateLimit, ipKeyGenerator } from "express-rate-limit";

const json = (req, res) =>
  res.status(429).json({ error: { code: "RATE_LIMITED", message: "Too many attempts, please try again later" } });

// General limit for public auth endpoints (per IP).
export const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, handler: json });

// Login: 5 failed attempts per email per 15 minutes (successful logins don't count).
// Keyed by email because requests come from the Next.js server, not the browser.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => String(req.body?.email ?? ipKeyGenerator(req.ip)).toLowerCase(),
  handler: json,
});
