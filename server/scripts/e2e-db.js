// Database helper for the end-to-end tests (e2e/). Run from the server folder:
//   node scripts/e2e-db.js create-user <email> <password> <name> [verified]
//   node scripts/e2e-db.js email-change-token <email> <newEmail>
//   node scripts/e2e-db.js cleanup
// It only ever touches accounts whose email looks like e2e-…@example.com, and refuses to run in production.
import { prisma } from "../src/lib/prisma.js";
import { createToken } from "../src/lib/tokens.js";
import { env } from "../src/config/env.js";
import { hashPassword } from "../src/modules/auth/auth.service.js";
import { deleteAccount } from "../src/modules/users/users.service.js";

const TEST_EMAIL = /^e2e-[a-z0-9-]+@example\.com$/;

function assertTestEmail(email) {
  if (!TEST_EMAIL.test(email)) throw new Error(`Refusing to touch non-test account: ${email}`);
}

const commands = {
  async "create-user"(email, password, name, verified) {
    assertTestEmail(email);
    const user = await prisma.user.create({
      data: { email, name, passwordHash: await hashPassword(password), emailVerifiedAt: verified === "verified" ? new Date() : null },
    });
    return { id: user.id };
  },

  /** The token an email-change confirmation email would contain (the email itself goes to the console in dev). */
  async "email-change-token"(email, newEmail) {
    assertTestEmail(email);
    assertTestEmail(newEmail);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.authToken.updateMany({ where: { userId: user.id, type: "EMAIL_CHANGE", usedAt: null }, data: { usedAt: new Date() } });
    const { token, tokenHash } = createToken();
    await prisma.authToken.create({
      data: { userId: user.id, type: "EMAIL_CHANGE", tokenHash, newEmail, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
    return { token };
  },

  async "user-exists"(email) {
    assertTestEmail(email);
    return { exists: (await prisma.user.count({ where: { email } })) > 0 };
  },

  /** Deletes every e2e account the normal way, so their uploaded files go too. */
  async cleanup() {
    const users = await prisma.user.findMany({
      where: { email: { startsWith: "e2e-", endsWith: "@example.com" } },
      select: { id: true, email: true },
    });
    for (const u of users) {
      assertTestEmail(u.email);
      await deleteAccount(u.id);
    }
    return { deleted: users.length };
  },
};

const [cmd, ...args] = process.argv.slice(2);
try {
  if (env.NODE_ENV === "production") throw new Error("e2e-db.js must not run in production");
  if (!commands[cmd]) throw new Error(`Unknown command: ${cmd}`);
  console.log(JSON.stringify(await commands[cmd](...args)));
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
