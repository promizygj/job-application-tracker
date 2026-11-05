import { z } from "zod";

export const email = z.string().trim().toLowerCase().email("Enter a valid email").max(254);

export const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters") // bcrypt limit
  .regex(/[A-Za-z]/, "Password must contain a letter")
  .regex(/[0-9]/, "Password must contain a number");

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email,
  password,
});

export const credentialsSchema = z.object({ email, password: z.string().min(1).max(72) });
export const tokenSchema = z.object({ token: z.string().min(10).max(200) });
export const forgotPasswordSchema = z.object({ email });
export const emailChangeSchema = z.object({ newEmail: email, password: z.string().min(1).max(72) }).strict();
export const deleteAccountSchema = z.object({ password: z.string().min(1).max(72) }).strict();
export const resetPasswordSchema = z.object({ token: z.string().min(10).max(200), password });
