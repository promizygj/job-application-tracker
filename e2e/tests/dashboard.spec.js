import { expect, test } from "@playwright/test";
import { api, createApplication, createUser, expectNoHorizontalScroll, login } from "../helpers.js";

const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const text = async (locator) => (await locator.innerText()).replace(/\s+/g, " ");

test.beforeEach(async ({ page }) => {
  await login(page, createUser("dashboard", { name: "Dana Dashboard" }));
  // 14 applications sent over ~10 weeks, some moved along, plus interviews and one saved job.
  const companies = ["Stripe", "Monzo", "Vercel", "Wise", "Revolut", "Figma", "Linear", "Notion", "Spotify", "Shopify", "GitLab", "Canva", "Atlassian", "Airbnb"];
  const ids = [];
  for (const [i, company] of companies.entries()) {
    ids.push((await createApplication(page, { company, status: "APPLIED", appliedAt: daysAgo(3 + i * 5) })).id);
  }
  await createApplication(page, { company: "Saved Co" });
  const move = (i, status) => api(page, `/api/v1/applications/${ids[i]}`, { method: "PATCH", body: { status } });
  for (const i of [0, 1, 2, 3]) await move(i, "INTERVIEW");
  await move(1, "OFFER");
  await move(2, "REJECTED");
  await move(4, "ASSESSMENT");
  for (const i of [5, 6, 7]) await move(i, "REJECTED");
  for (const [i, d] of [[0, -2], [1, -9], [2, -16], [0, 3]]) {
    await api(page, `/api/v1/applications/${ids[i]}/interviews`, {
      method: "POST",
      body: { title: "Round", type: "VIDEO", startsAt: new Date(Date.now() + d * 864e5).toISOString() },
    });
  }
  await page.reload();
  await expect(page.getByRole("heading", { name: "Activity" })).toBeVisible();
});

test("stat tiles, pipeline and status bars match the API", async ({ page }) => {
  const { data: s } = await api(page, "/api/v1/dashboard/summary");
  await expect(page.getByText(`${s.counts.offered} offer${s.counts.offered === 1 ? "" : "s"}`, { exact: true })).toBeVisible();

  const pipeline = await text(page.getByRole("list", { name: "Pipeline stages" }));
  expect(pipeline).toContain(`Applied ${s.counts.applied}`);
  expect(pipeline).toContain(`Interview ${s.counts.interviewed}`);
  expect(pipeline).toContain(`Offer ${s.counts.offered}`);

  const statusRows = page.getByRole("list", { name: "Applications by status" }).getByRole("link");
  await expect(statusRows).toHaveCount(7);
  await page.getByRole("link", { name: `Rejected: ${s.byStatus.REJECTED}` }).click();
  await expect(page).toHaveURL(/\/applications\?status=REJECTED$/);
  await expect(page.getByRole("heading", { name: `Applications (${s.byStatus.REJECTED})` })).toBeVisible();
});

test("status bar lengths are proportional to the counts", async ({ page }) => {
  const { data: s } = await api(page, "/api/v1/dashboard/summary");
  const bars = await page
    .getByRole("list", { name: "Applications by status" })
    .locator("li")
    .evaluateAll((lis) => lis.map((li) => li.querySelector("span[aria-hidden]")?.getBoundingClientRect().width ?? 0));
  const counts = ["SAVED", "APPLIED", "ASSESSMENT", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN"].map((k) => s.byStatus[k]);
  const max = Math.max(...counts);
  const widest = Math.max(...bars);
  counts.forEach((c, i) => expect(bars[i]).toBeCloseTo((c / max) * widest, 0));
});

test("activity chart: legend totals, hover tooltip and table view", async ({ page }) => {
  const { data: weeks } = await api(page, "/api/v1/dashboard/activity?weeks=12");
  const sent = weeks.reduce((n, w) => n + w.applied, 0);
  const interviews = weeks.reduce((n, w) => n + w.interviews, 0);
  const legend = await text(page.locator("figure ul").first());
  expect(legend).toContain(`Applications sent ${sent}`);
  expect(legend).toContain(`Interviews ${interviews}`);

  const busiest = weeks.reduce((a, w) => (w.applied + w.interviews > a.applied + a.interviews ? w : a));
  const plot = await page.locator(".recharts-cartesian-grid").boundingBox();
  await page.mouse.move(plot.x + (plot.width / weeks.length) * (weeks.indexOf(busiest) + 0.5), plot.y + plot.height / 2);
  const tooltip = page.locator(".recharts-tooltip-wrapper");
  await expect(tooltip).toContainText("Week of");
  expect(await text(tooltip)).toContain(`${busiest.applied} Applications sent ${busiest.interviews} Interviews`);

  await page.getByRole("button", { name: "Show table" }).click();
  await expect(page.locator("figure table tbody tr")).toHaveCount(12);
  await page.getByRole("button", { name: "Show chart" }).click();
  await expect(page.locator(".recharts-bar-rectangle").first()).toBeVisible();
});

test("mobile dashboard", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.locator(".recharts-bar-rectangle").first()).toBeVisible();
  await expectNoHorizontalScroll(page);
});
