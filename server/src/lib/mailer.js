import nodemailer from "nodemailer";
import { env } from "../config/env.js";

/**
 * Email delivery, first match wins:
 *   1. tests            → collected in `testOutbox`
 *   2. BREVO_API_KEY    → Brevo's HTTP API (HTTPS, port 443). Use this on Render's free plan, which
 *                         blocks outbound SMTP ports 25/465/587.
 *   3. SMTP_HOST        → SMTP via Nodemailer (hosts that allow SMTP)
 *   4. nothing set      → printed to the console (local development)
 * Sending never throws: a mail outage must not break registration or password resets. Every send
 * is time-limited so a slow provider can't hold a request open.
 */

const SEND_TIMEOUT_MS = 10_000;

/** In tests, emails are collected here instead of sent, so tests can follow the links in them. */
export const testOutbox = [];

const smtp = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      connectionTimeout: SEND_TIMEOUT_MS,
      greetingTimeout: SEND_TIMEOUT_MS,
      socketTimeout: SEND_TIMEOUT_MS,
    })
  : null;

/** "JobTrack <me@example.com>" → { name: "JobTrack", email: "me@example.com" } */
export function parseAddress(value) {
  const match = value.match(/^\s*"?([^"<]*?)"?\s*<\s*([^>\s]+)\s*>\s*$/);
  return match ? { ...(match[1] && { name: match[1] }), email: match[2] } : { email: value.trim() };
}

const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Plain-text email → simple HTML (escaped, links clickable, line breaks kept). */
export function textToHtml(text) {
  const body = escapeHtml(text)
    .replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}">${url}</a>`)
    .replace(/\n/g, "<br>\n");
  return `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.5">${body}</div>`;
}

/** Sends one email through Brevo's transactional API. Throws on failure (callers decide what to do). */
export async function sendViaBrevo({ to, subject, text }, { apiKey = env.BREVO_API_KEY, from = env.MAIL_FROM, fetchImpl = fetch } = {}) {
  const res = await fetchImpl("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: parseAddress(from),
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: textToHtml(text),
    }),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Brevo API ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

export async function sendMail({ to, subject, text }) {
  if (env.NODE_ENV === "test") {
    testOutbox.push({ to, subject, text });
    return;
  }
  try {
    if (env.BREVO_API_KEY) return await sendViaBrevo({ to, subject, text });
    if (smtp) return await smtp.sendMail({ from: env.MAIL_FROM, to, subject, text });
    console.log(`\n📧 [dev email] To: ${to}\n   Subject: ${subject}\n   ${text.replace(/\n/g, "\n   ")}\n`);
  } catch (err) {
    // Don't fail the request because the email provider is down: the user can request a resend.
    console.error(`Failed to send email "${subject}" to ${to}:`, err.message);
  }
}
