import nodemailer from "nodemailer";
import { env } from "../config/env.js";

// Without SMTP settings (local dev) emails are printed to the console instead of sent.
const transport = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    })
  : null;

/** In tests, emails are collected here instead of sent, so tests can follow the links in them. */
export const testOutbox = [];

export async function sendMail({ to, subject, text }) {
  if (env.NODE_ENV === "test") {
    testOutbox.push({ to, subject, text });
    return;
  }
  if (!transport) {
    console.log(`\n📧 [dev email] To: ${to}\n   Subject: ${subject}\n   ${text.replace(/\n/g, "\n   ")}\n`);
    return;
  }
  try {
    await transport.sendMail({ from: env.MAIL_FROM, to, subject, text });
  } catch (err) {
    // Don't fail the request because the email provider is down — the user can request a resend.
    console.error("Failed to send email:", err.message);
  }
}
