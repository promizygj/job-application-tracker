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
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default("JobTrack <no-reply@jobtrack.local>"),
  // File storage. "local" writes to UPLOAD_DIR (relative to the server folder); cloudinary/s3 come later.
  STORAGE_DRIVER: z.enum(["local"]).default("local"),
  UPLOAD_DIR: z.string().default("uploads"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Invalid environment variables:", z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
