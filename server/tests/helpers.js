import { encode } from "@auth/core/jwt";
import supertest from "supertest";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { prisma } from "../src/lib/prisma.js";
import { hashPassword } from "../src/modules/auth/auth.service.js";

export { prisma };
export const request = supertest(app);

const COOKIE = "authjs.session-token";
let counter = 0;

/** Session cookie for an existing user (as Auth.js would set it at sign-in). */
export async function sessionCookie(user) {
  const token = await encode({ token: { sub: user.id, sv: user.sessionVersion }, secret: env.AUTH_SECRET, salt: COOKIE });
  return `${COOKIE}=${token}`;
}

/** Creates a user and returns it with a valid Auth.js session cookie, like the Next.js app would set. */
export async function createUser({ password, ...overrides } = {}) {
  counter += 1;
  const user = await prisma.user.create({
    data: {
      name: `Test User ${counter}`,
      email: `user${counter}-${Date.now()}@test.local`,
      passwordHash: password ? await hashPassword(password) : "not-used",
      ...overrides,
    },
  });
  const token = await encode({ token: { sub: user.id, sv: user.sessionVersion }, secret: env.AUTH_SECRET, salt: COOKIE });
  return { user, cookie: `${COOKIE}=${token}` };
}

export function resetDb() {
  if (!env.DATABASE_URL.includes("_test")) throw new Error("resetDb() only runs against a *_test database");
  return prisma.user.deleteMany(); // cascades to everything else
}
