import bcrypt from "bcryptjs";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { sendMail } from "../../lib/mailer.js";
import { createToken, hashToken } from "../../lib/tokens.js";
import { AppError } from "../../utils/AppError.js";

const BCRYPT_COST = 12;
const HOUR = 60 * 60 * 1000;
// Compared against when the email doesn't exist, so response time doesn't reveal which emails are registered.
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", BCRYPT_COST);

export const hashPassword = (pw) => bcrypt.hash(pw, BCRYPT_COST);

export async function register({ name, email, password }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError(409, "CONFLICT", "An account with this email already exists");

  const user = await prisma.user.create({ data: { name, email, passwordHash: await hashPassword(password) } });
  await sendVerificationEmail(user);
  return user;
}

/** Used by the Auth.js Credentials provider. Returns the user or throws a generic 401. */
export async function verifyCredentials({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  return user;
}

async function issueAuthToken(userId, type, ttlMs, extra = {}) {
  // Invalidate earlier unused tokens of the same type so only the newest link works.
  await prisma.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } });
  const { token, tokenHash } = createToken();
  await prisma.authToken.create({ data: { userId, type, tokenHash, expiresAt: new Date(Date.now() + ttlMs), ...extra } });
  return token;
}

/** Marks a token used (atomically) and returns it, or throws if invalid/expired/used. */
async function consumeAuthToken(token, type) {
  const record = await prisma.authToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.type !== type || record.usedAt || record.expiresAt < new Date()) {
    throw new AppError(400, "INVALID_TOKEN", "This link is invalid or has expired");
  }
  const { count } = await prisma.authToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (count === 0) throw new AppError(400, "INVALID_TOKEN", "This link is invalid or has expired");
  return record;
}

export async function sendVerificationEmail(user) {
  const token = await issueAuthToken(user.id, "EMAIL_VERIFICATION", 24 * HOUR);
  await sendMail({
    to: user.email,
    subject: "Verify your JobTrack email",
    text: `Hi ${user.name},\n\nConfirm your email address:\n${env.CLIENT_URL}/verify-email?token=${token}\n\nThis link expires in 24 hours.`,
  });
}

export async function verifyEmail(token) {
  const record = await consumeAuthToken(token, "EMAIL_VERIFICATION");
  return prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } });
}

export async function forgotPassword(email) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return; // Same response either way — don't reveal whether the email exists.
  const token = await issueAuthToken(user.id, "PASSWORD_RESET", HOUR);
  await sendMail({
    to: user.email,
    subject: "Reset your JobTrack password",
    text: `Hi ${user.name},\n\nReset your password:\n${env.CLIENT_URL}/reset-password?token=${token}\n\nThis link expires in 1 hour. If you didn't ask for this, ignore this email.`,
  });
}

export async function resetPassword(token, password) {
  const record = await consumeAuthToken(token, "PASSWORD_RESET");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: record.userId } });
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(password),
      sessionVersion: { increment: 1 }, // signs out every device
      emailVerifiedAt: user.emailVerifiedAt ?? new Date(), // the reset link proved they own the email
    },
  });
}

/** Throws a field error unless `password` matches the user's current password. */
export async function assertPassword(user, password, field = "password") {
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new AppError(400, "VALIDATION_ERROR", "Password is incorrect", [{ path: field, message: "Password is incorrect" }]);
}

/** Step 1 of an email change: confirm the password, then email a link to the NEW address. */
export async function requestEmailChange(user, { newEmail, password }) {
  await assertPassword(user, password);
  if (newEmail === user.email) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid input", [{ path: "newEmail", message: "That's already your email address" }]);
  }
  if (await prisma.user.findUnique({ where: { email: newEmail } })) {
    throw new AppError(409, "CONFLICT", "An account with this email already exists", [{ path: "newEmail", message: "This email is already in use" }]);
  }
  const token = await issueAuthToken(user.id, "EMAIL_CHANGE", 24 * HOUR, { newEmail });
  await sendMail({
    to: newEmail,
    subject: "Confirm your new JobTrack email",
    text: `Hi ${user.name},\n\nConfirm that you want to use this address for JobTrack:\n${env.CLIENT_URL}/confirm-email?token=${token}\n\nThis link expires in 24 hours. Until you confirm, your account keeps using ${user.email}.`,
  });
}

/** Step 2: the link from the new inbox switches the address (and counts as verifying it). */
export async function confirmEmailChange(token) {
  const record = await consumeAuthToken(token, "EMAIL_CHANGE");
  if (await prisma.user.findUnique({ where: { email: record.newEmail } })) {
    throw new AppError(409, "CONFLICT", "That email address was taken by another account in the meantime");
  }
  return prisma.user.update({ where: { id: record.userId }, data: { email: record.newEmail, emailVerifiedAt: new Date() } });
}

export const logoutAll = (userId) =>
  prisma.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
