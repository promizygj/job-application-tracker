import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "../src/config/env.js";
import { testOutbox } from "../src/lib/mailer.js";
import { createUser, prisma, request, resetDb, sessionCookie } from "./helpers.js";

const PASSWORD = "secret123";
let alice;

/** Token from the last email sent to `to` (the link's ?token=…). */
function tokenFrom(to, pathPart) {
  const mail = testOutbox.filter((m) => m.to === to).at(-1);
  expect(mail, `no email sent to ${to}`).toBeDefined();
  const match = mail.text.match(new RegExp(`${pathPart}\\?token=([A-Za-z0-9_-]+)`));
  expect(match, `no ${pathPart} link in email`).not.toBeNull();
  return match[1];
}

/** Calls the internal endpoint Auth.js uses to check a password. */
const credentials = (email, password) =>
  request.post("/api/v1/auth/credentials").set("x-internal-secret", env.INTERNAL_API_SECRET).send({ email, password });

beforeEach(async () => {
  await resetDb();
  testOutbox.length = 0;
  alice = await createUser({ password: PASSWORD, email: "alice@test.local", name: "Alice Smith" });
});

afterAll(() => prisma.$disconnect());

describe("profile", () => {
  it("returns the public profile only", async () => {
    const res = await request.get("/api/v1/users/me").set("Cookie", alice.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ email: "alice@test.local", name: "Alice Smith", timezone: "UTC", emailVerified: false });
    expect(res.body.data.user).not.toHaveProperty("passwordHash");
    expect(res.body.data.user).not.toHaveProperty("sessionVersion");
  });

  it("updates name, headline, location and timezone; empty values clear optional fields", async () => {
    const res = await request
      .patch("/api/v1/users/me")
      .set("Cookie", alice.cookie)
      .send({ name: "  Alice S.  ", headline: "Frontend developer", location: null, timezone: "Africa/Lagos" });
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ name: "Alice S.", headline: "Frontend developer", location: null, timezone: "Africa/Lagos" });
  });

  it.each([
    [{ name: "" }, "name"],
    [{ timezone: "Mars/Base" }, "timezone"],
    [{ email: "new@test.local" }, ""], // email changes go through the confirmation flow
  ])("rejects %j", async (body, field) => {
    const res = await request.patch("/api/v1/users/me").set("Cookie", alice.cookie).send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.path)).toContain(field);
  });
});

describe("PATCH /users/me/password", () => {
  const change = (body, cookie = alice.cookie) => request.patch("/api/v1/users/me/password").set("Cookie", cookie).send(body);

  it("changes the password and signs out every existing session", async () => {
    expect((await change({ currentPassword: PASSWORD, newPassword: "newpass456" })).status).toBe(204);
    expect((await request.get("/api/v1/users/me").set("Cookie", alice.cookie)).status).toBe(401);
    expect((await credentials("alice@test.local", PASSWORD)).status).toBe(401);
    expect((await credentials("alice@test.local", "newpass456")).status).toBe(200);
  });

  it("requires the current password", async () => {
    const res = await change({ currentPassword: "wrong-one1", newPassword: "newpass456" });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe("currentPassword");
  });

  it.each([
    [{ currentPassword: PASSWORD, newPassword: PASSWORD }, "newPassword"],
    [{ currentPassword: PASSWORD, newPassword: "short1" }, "newPassword"],
    [{ currentPassword: PASSWORD, newPassword: "lettersonly" }, "newPassword"],
  ])("rejects a weak or unchanged new password %#", async (body, field) => {
    const res = await change(body);
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.path)).toContain(field);
  });
});

describe("email change", () => {
  const requestChange = (body) => request.post("/api/v1/users/me/email").set("Cookie", alice.cookie).send(body);
  const confirm = (token) => request.post("/api/v1/auth/confirm-email-change").send({ token });

  it("emails a link to the new address and only switches once it's confirmed", async () => {
    expect((await requestChange({ newEmail: "Alice.New@Test.local", password: PASSWORD })).status).toBe(204);
    // Nothing changes until the link is used.
    expect((await prisma.user.findUnique({ where: { id: alice.user.id } })).email).toBe("alice@test.local");

    const token = tokenFrom("alice.new@test.local", "/confirm-email");
    const res = await confirm(token);
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ email: "alice.new@test.local", emailVerified: true });
    // Signing in uses the new address; the session stays valid.
    expect((await credentials("alice.new@test.local", PASSWORD)).status).toBe(200);
    expect((await request.get("/api/v1/users/me").set("Cookie", alice.cookie)).status).toBe(200);
    // The link only works once.
    expect((await confirm(token)).status).toBe(400);
  });

  it("requires the password and a different, unused address", async () => {
    await createUser({ email: "taken@test.local" });
    expect((await requestChange({ newEmail: "new@test.local", password: "wrong-one1" })).body.error.details[0].path).toBe("password");
    expect((await requestChange({ newEmail: "alice@test.local", password: PASSWORD })).body.error.details[0].path).toBe("newEmail");
    const taken = await requestChange({ newEmail: "taken@test.local", password: PASSWORD });
    expect(taken.status).toBe(409);
    expect(testOutbox).toHaveLength(0);
  });

  it("fails if the address was taken after the link was sent", async () => {
    await requestChange({ newEmail: "race@test.local", password: PASSWORD });
    await createUser({ email: "race@test.local" });
    expect((await confirm(tokenFrom("race@test.local", "/confirm-email"))).status).toBe(409);
  });

  it("only the newest link works", async () => {
    await requestChange({ newEmail: "first@test.local", password: PASSWORD });
    const first = tokenFrom("first@test.local", "/confirm-email");
    await requestChange({ newEmail: "second@test.local", password: PASSWORD });
    expect((await confirm(first)).status).toBe(400);
    expect((await confirm(tokenFrom("second@test.local", "/confirm-email"))).status).toBe(200);
  });
});

describe("DELETE /users/me", () => {
  const PDF = Buffer.from("%PDF-1.4\n%%EOF\n");

  it("deletes the account, its data and its stored files", async () => {
    await prisma.user.update({ where: { id: alice.user.id }, data: { emailVerifiedAt: new Date() } });
    const app = await request
      .post("/api/v1/applications")
      .set("Cookie", alice.cookie)
      .send({ company: "Stripe", jobTitle: "FE", employmentType: "REMOTE" });
    const upload = await request.post("/api/v1/documents").set("Cookie", alice.cookie).field("type", "CV").field("name", "CV").attach("file", PDF, "cv.pdf");
    expect(app.status).toBe(201);
    expect(upload.status).toBe(201);
    const { storageKey } = await prisma.document.findUnique({ where: { id: upload.body.data.document.id } });
    const file = path.join(env.UPLOAD_DIR, storageKey);
    expect(fs.existsSync(file)).toBe(true);

    const bob = await createUser();
    const res = await request.delete("/api/v1/users/me").set("Cookie", alice.cookie).send({ password: PASSWORD });
    expect(res.status).toBe(204);

    expect(await prisma.user.findUnique({ where: { id: alice.user.id } })).toBeNull();
    expect(await prisma.application.count({ where: { userId: alice.user.id } })).toBe(0);
    expect(fs.existsSync(file)).toBe(false);
    expect(fs.existsSync(path.dirname(file))).toBe(false); // the user's (now empty) folder is gone too
    expect(await prisma.user.findUnique({ where: { id: bob.user.id } })).not.toBeNull();
    expect((await request.get("/api/v1/users/me").set("Cookie", alice.cookie)).status).toBe(401);
  });

  it("requires the correct password", async () => {
    const res = await request.delete("/api/v1/users/me").set("Cookie", alice.cookie).send({ password: "wrong-one1" });
    expect(res.status).toBe(400);
    expect(await prisma.user.count({ where: { id: alice.user.id } })).toBe(1);
  });
});

describe("email-based flows (followed through the outbox)", () => {
  it("register → verification email → verify", async () => {
    const res = await request.post("/api/v1/auth/register").send({ name: "Neo", email: "neo@test.local", password: "secret123" });
    expect(res.status).toBe(201);
    const verified = await request.post("/api/v1/auth/verify-email").send({ token: tokenFrom("neo@test.local", "/verify-email") });
    expect(verified.body.data.user.emailVerified).toBe(true);
  });

  it("forgot password → reset link → new password works, other sessions end", async () => {
    expect((await request.post("/api/v1/auth/forgot-password").send({ email: "alice@test.local" })).status).toBe(204);
    const token = tokenFrom("alice@test.local", "/reset-password");
    expect((await request.post("/api/v1/auth/reset-password").send({ token, password: "brandnew99" })).status).toBe(204);
    expect((await credentials("alice@test.local", "brandnew99")).status).toBe(200);
    expect((await request.get("/api/v1/users/me").set("Cookie", alice.cookie)).status).toBe(401);
  });

  it("logout-all ends every session, and a fresh sign-in works again", async () => {
    expect((await request.post("/api/v1/auth/logout-all").set("Cookie", alice.cookie)).status).toBe(204);
    expect((await request.get("/api/v1/users/me").set("Cookie", alice.cookie)).status).toBe(401);
    const fresh = await sessionCookie(await prisma.user.findUnique({ where: { id: alice.user.id } }));
    expect((await request.get("/api/v1/users/me").set("Cookie", fresh)).status).toBe(200);
  });
});
