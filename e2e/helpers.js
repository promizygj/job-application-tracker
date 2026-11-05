import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect } from "@playwright/test";

const SERVER_DIR = path.resolve(import.meta.dirname, "../server");
export const PASSWORD = "secret123";

/** Runs a command of server/scripts/e2e-db.js (test accounts only) and returns its JSON output. */
export function db(...args) {
  const out = execFileSync("node", ["scripts/e2e-db.js", ...args], { cwd: SERVER_DIR, encoding: "utf8" });
  return JSON.parse(out.trim().split("\n").at(-1));
}

export function testEmail(tag) {
  return `e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
}

/** Creates a test account directly in the database (the register endpoint is rate-limited). */
export function createUser(tag, { name = "E2E Tester", verified = false } = {}) {
  const email = testEmail(tag);
  db("create-user", email, PASSWORD, name, verified ? "verified" : "unverified");
  return { email, password: PASSWORD, name };
}

export async function login(page, { email, password = PASSWORD }) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** fetch() from inside the page, so the session cookie is sent. Returns the parsed JSON (null for 204). */
export function api(page, url, { method = "GET", body } = {}) {
  return page.evaluate(
    async ([u, m, b]) => {
      const res = await fetch(u, { method: m, headers: b ? { "content-type": "application/json" } : {}, body: b ? JSON.stringify(b) : undefined });
      if (!res.ok) throw new Error(`${m} ${u} → ${res.status}`);
      return res.status === 204 ? null : res.json();
    },
    [url, method, body],
  );
}

export const createApplication = async (page, body) =>
  (await api(page, "/api/v1/applications", { method: "POST", body: { jobTitle: "Engineer", employmentType: "REMOTE", ...body } })).data.application;

/**
 * Next.js keeps recently visited pages mounted but hidden (React <Activity>), so text and label
 * lookups can match a hidden copy. Role lookups already skip hidden elements; use this for the rest.
 */
export const visible = (locator) => locator.filter({ visible: true });

export const dialog = (page) => page.locator("dialog[open]");

/** YYYY-MM-DD for today + `days` in a time zone. */
export const ymdIn = (timeZone, days = 0) => new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date(Date.now() + days * 864e5));

export async function expectNoHorizontalScroll(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
}
