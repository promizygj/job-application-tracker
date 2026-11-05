import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { AppError } from "../../utils/AppError.js";
import { timezone } from "../../utils/zod.js";
import { assertPassword, hashPassword, requestEmailChange } from "../auth/auth.service.js";
import { deleteAccountSchema, emailChangeSchema, password } from "../auth/auth.schemas.js";
import { deleteAccount } from "./users.service.js";
import { toPublicUser } from "./users.presenter.js";

export const usersRouter = Router();
usersRouter.use(requireAuth);

const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    headline: z.string().trim().max(160).nullable(),
    location: z.string().trim().max(100).nullable(),
    timezone,
  })
  .partial()
  .strict();

const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(72), newPassword: password });

usersRouter.get("/me", (req, res) => {
  res.json({ data: { user: toPublicUser(req.user) } });
});

usersRouter.patch("/me", validate(updateProfileSchema), async (req, res) => {
  const user = await prisma.user.update({ where: { id: req.user.id }, data: req.body });
  res.json({ data: { user: toPublicUser(user) } });
});

usersRouter.patch("/me/password", validate(changePasswordSchema), async (req, res) => {
  await assertPassword(req.user, req.body.currentPassword, "currentPassword");
  if (req.body.newPassword === req.body.currentPassword) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid input", [{ path: "newPassword", message: "Choose a different password from your current one" }]);
  }
  await prisma.user.update({
    where: { id: req.user.id },
    data: { passwordHash: await hashPassword(req.body.newPassword), sessionVersion: { increment: 1 } },
  });
  res.status(204).end(); // all sessions (including this one) must sign in again
});

// Sends a confirmation link to the new address; the email changes only once it's clicked.
usersRouter.post("/me/email", validate(emailChangeSchema), async (req, res) => {
  await requestEmailChange(req.user, req.body);
  res.status(204).end();
});

usersRouter.delete("/me", validate(deleteAccountSchema), async (req, res) => {
  await assertPassword(req.user, req.body.password);
  await deleteAccount(req.user.id);
  res.status(204).end();
});
