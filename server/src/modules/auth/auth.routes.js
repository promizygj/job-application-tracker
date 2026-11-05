import { Router } from "express";
import { requireAuth, requireInternal } from "../../middleware/auth.js";
import { authLimiter, loginLimiter } from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";
import { AppError } from "../../utils/AppError.js";
import { toPublicUser } from "../users/users.presenter.js";
import * as schemas from "./auth.schemas.js";
import * as auth from "./auth.service.js";

export const authRouter = Router();

authRouter.post("/register", authLimiter, validate(schemas.registerSchema), async (req, res) => {
  const user = await auth.register(req.body);
  res.status(201).json({ data: { user: toPublicUser(user) } });
});

// Called only by the Next.js server (Auth.js Credentials provider `authorize`).
authRouter.post(
  "/credentials",
  requireInternal,
  loginLimiter,
  validate(schemas.credentialsSchema),
  async (req, res) => {
    const user = await auth.verifyCredentials(req.body);
    res.json({ data: { user: { ...toPublicUser(user), sessionVersion: user.sessionVersion } } });
  },
);

authRouter.post("/verify-email", authLimiter, validate(schemas.tokenSchema), async (req, res) => {
  const user = await auth.verifyEmail(req.body.token);
  res.json({ data: { user: toPublicUser(user) } });
});

authRouter.post("/resend-verification", authLimiter, requireAuth, async (req, res) => {
  if (req.user.emailVerifiedAt) throw new AppError(400, "ALREADY_VERIFIED", "Email is already verified");
  await auth.sendVerificationEmail(req.user);
  res.status(204).end();
});

authRouter.post("/forgot-password", authLimiter, validate(schemas.forgotPasswordSchema), async (req, res) => {
  await auth.forgotPassword(req.body.email);
  res.status(204).end();
});

authRouter.post("/reset-password", authLimiter, validate(schemas.resetPasswordSchema), async (req, res) => {
  await auth.resetPassword(req.body.token, req.body.password);
  res.status(204).end();
});

authRouter.post("/confirm-email-change", authLimiter, validate(schemas.tokenSchema), async (req, res) => {
  const user = await auth.confirmEmailChange(req.body.token);
  res.json({ data: { user: toPublicUser(user) } });
});

authRouter.post("/logout-all", requireAuth, async (req, res) => {
  await auth.logoutAll(req.user.id);
  res.status(204).end();
});
