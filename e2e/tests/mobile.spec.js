import { expect, test } from "@playwright/test";
import { api, createApplication, createUser, login, ymdIn } from "../helpers.js";

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

/** Regressions from user feedback, on a touch phone. */
test("phone: board fits, long-press anywhere drags, empty states, calendar", async ({ page }) => {
  await login(page, createUser("feedback", { name: "Ubong Tester", verified: true }));
  await api(page, "/api/v1/users/me", { method: "PATCH", body: { timezone: "Africa/Lagos" } });
  const apps = {};
  for (const [company, status] of [["Sypo Fashion", "OFFER"], ["Acme", "APPLIED"], ["Globex", "INTERVIEW"], ["Initech", "SAVED"], ["Umbrella", "REJECTED"]]) {
    apps[company] = await createApplication(page, { company, status, jobTitle: "Product Designer", location: "Toronto" });
  }
  const day = ymdIn("Africa/Lagos", 2);
  for (const [company, t] of [["Globex", "09:00"], ["Acme", "13:30"], ["Initech", "16:00"]]) {
    await api(page, `/api/v1/applications/${apps[company].id}/interviews`, { method: "POST", body: { title: "Screen", type: "VIDEO", startsAt: `${day}T${t}:00+01:00` } });
  }

  // Board
  await page.goto("/board");
  await expect(page.getByRole("link", { name: "Acme" })).toBeVisible();
  const scroller = page.locator("[data-board-scroller]");
  await scroller.evaluate((el) => el.scrollBy({ left: 200 }));
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);

  // Long-press on the card's job-title text (not the ⋯) and drag to the next column → Applied
  await scroller.evaluate((el) => el.scrollTo({ left: 0 }));
  await page.waitForTimeout(500);
  const title = page.locator("li", { hasText: "Initech" }).getByText("Product Designer");
  const box = await title.boundingBox();
  const cdp = await page.context().newCDPSession(page);
  const pt = (x, y) => [{ x, y }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt(box.x + 20, box.y + 5) });
  await page.waitForTimeout(350);
  // Hold at the right edge until the board scrolls one column, then come back to the middle and drop.
  let x = box.x + 20, y = box.y + 5;
  const move = async (nx, ny) => { x = nx; y = ny; await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt(x, y) }); };
  for (let i = 1; i <= 10; i++) { await move(box.x + 20 + i * 16, box.y + 5 + i * 2); await page.waitForTimeout(30); }
  await move(380, y);
  await expect.poll(() => scroller.evaluate((el) => el.scrollLeft), { timeout: 8000, intervals: [50] }).toBeGreaterThan(250);
  await move(200, y + 40);
  await page.waitForTimeout(150);
  await move(200, y + 60);
  await page.waitForTimeout(300);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(page.getByRole("region", { name: /^Applied column/ }).getByRole("link", { name: "Initech" })).toBeVisible();
  await expect.poll(async () => (await api(page, `/api/v1/applications/${apps.Initech.id}`)).data.application.status).toBe("APPLIED");

  // Documents → Cover letters
  await page.goto("/documents?type=COVER_LETTER");
  await expect(page.getByRole("button", { name: "Upload your cover letter" })).toBeVisible();
  await page.getByRole("button", { name: "Upload your cover letter" }).click();
  await expect(page.locator("dialog[open]").getByRole("combobox", { name: "Type" })).toHaveValue("COVER_LETTER");

  // Calendar: a busy day is labelled with its count
  await page.goto(`/interviews?view=calendar&month=${day.slice(0, 7)}`);
  await expect(page.getByRole("button", { name: /3 interviews/ })).toBeVisible();
});
