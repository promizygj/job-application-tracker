import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  CLIENT_URL: z.string().url().default("http://localhost:3000"),
  // Must be identical to AUTH_SECRET in client/.env.local — used to decrypt Auth.js session cookies.
  AUTH_SECRET: z.string().min(32),
  // Shared secret for server-to-server calls from the Next.js Auth.js config.
  INTERNAL_API_SECRET: z.string().min(32),
  // Email: BREVO_API_KEY (HTTP API, works on Render's free plan) or SMTP_* (hosts that allow SMTP).
  BREVO_API_KEY: z.string().min(10).optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default("JobTrack <no-reply@jobtrack.local>"),
  // File storage: "local" writes to UPLOAD_DIR (dev); "cloudinary" uses CLOUDINARY_URL (production).
  STORAGE_DRIVER: z.enum(["local", "cloudinary"]).default("local"),
  UPLOAD_DIR: z.string().default("uploads"),
  CLOUDINARY_URL: z.string().startsWith("cloudinary://", "CLOUDINARY_URL looks like cloudinary://<key>:<secret>@<cloud>").optional(),
  CLOUDINARY_FOLDER: z.string().default("jat"),
  // How many proxies sit in front of the API (sets Express "trust proxy", so rate limits see the visitor's IP).
  // 1 = only Render's load balancer; 2 = Vercel's rewrite proxy + Render (production).
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(1),
});

const parsed = schema
  .refine((e) => e.STORAGE_DRIVER !== "cloudinary" || e.CLOUDINARY_URL, {
    path: ["CLOUDINARY_URL"],
    message: "Required when STORAGE_DRIVER=cloudinary",
  })
  .safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Invalid environment variables:", z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
