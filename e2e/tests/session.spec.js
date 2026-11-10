import { expect, test } from "@playwright/test";
import { createUser, login } from "../helpers.js";

const sessionCookie = async (page) =>
  (await page.context().cookies()).find((c) => c.name.endsWith("authjs.session-token"));

test("the session cookie expires an hour after the last activity, not after 30 days", async ({ page }) => {
  await login(page, createUser("session-cookie"));
  const secondsLeft = (await sessionCookie(page)).expires - Date.now() / 1000;
  expect(secondsLeft).toBeGreaterThan(55 * 60);
  expect(secondsLeft).toBeLessThanOrEqual(60 * 60 + 5);
});

test("an idle tab is signed out after an hour and sent back to log in", async ({ page }) => {
  await page.clock.install();
  const user = createUser("session-idle");
  await login(page, user);
  await page.goto("/board");
  await expect(page.getByRole("heading", { name: "Board" })).toBeVisible();

  await page.clock.fastForward("59:00");
  await expect(page).toHaveURL(/\/board$/);

  await page.clock.fastForward("02:00");
  await expect(page).toHaveURL(/\/login\?expired=1/);
  await expect(page.getByText("You were signed out after 1 hour of inactivity.")).toBeVisible();
  expect(await sessionCookie(page)).toBeUndefined();

  // Logging back in returns to the page they were on.
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/board$/);
});

test("activity keeps you signed in; coming back after an hour away does not", async ({ page }) => {
  await page.clock.install();
  await login(page, createUser("session-active"));

  // 80 minutes in total, but active in the middle: still signed in.
  await page.clock.fastForward("40:00");
  await page.mouse.move(200, 200);
  await page.mouse.move(260, 240);
  await page.clock.fastForward("40:00");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // The laptop slept for two hours (no timers ran): the first click signs out instead of reviving.
  const pageNow = await page.evaluate(() => Date.now());
  await page.clock.setSystemTime(pageNow + 2 * 60 * 60 * 1000);
  await page.mouse.click(300, 300);
  await expect(page).toHaveURL(/\/login\?expired=1/);
});
