import { app } from "./app.js";
import { env } from "./config/env.js";
import { mailMode } from "./lib/mailer.js";
import { prisma } from "./lib/prisma.js";

const server = app.listen(env.PORT, () => {
  console.log(`🚀 API listening on http://localhost:${env.PORT}/api/v1`);
  const mailNote = { brevo: "Brevo HTTP API", smtp: `SMTP (${env.SMTP_HOST})`, console: "console only (no BREVO_API_KEY or SMTP_HOST set)" }[mailMode];
  console.log(`📧 Email delivery: ${mailNote}; from ${env.MAIL_FROM}`);
});

const shutdown = async () => {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
