import { expect, test } from "@playwright/test";
import { api, createApplication, createUser, expectNoHorizontalScroll, login, visible } from "../helpers.js";

const card = (page, company) => visible(page.locator(`[aria-roledescription="draggable card"][aria-label^="${company},"]`));
const column = (page, label) => visible(page.locator(`section[aria-label^="${label} column"]`));

/** Board as { STATUS: [company…] } from the API. */
async function board(page) {
  const { data } = await api(page, "/api/v1/board");
  return Object.fromEntries(Object.entries(data.columns).map(([s, cards]) => [s, cards.map((c) => c.company)]));
}

/** Mouse drag. `reaim` re-targets after auto-scroll settles (for drops on a whole column near the edge). */
async function drag(page, from, to, { where = "top", reaim = false } = {}) {
  const a = await from.boundingBox();
  const target = async () => {
    const b = await to.boundingBox();
    return { x: b.x + b.width / 2, y: where === "top" ? b.y + 8 : b.y + b.height / 2 };
  };
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 10, { steps: 3 });
  let t = await target();
  await page.mouse.move(t.x, t.y, { steps: 15 });
  if (reaim) {
    await page.waitForTimeout(600);
    t = await target();
    await page.mouse.move(t.x, t.y, { steps: 5 });
  }
  await page.waitForTimeout(150);
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await login(page, createUser("board"));
  await createApplication(page, { company: "Alpha" });
  await createApplication(page, { company: "Bravo" });
  await createApplication(page, { company: "Charlie", status: "APPLIED", employmentType: "HYBRID", priority: "HIGH" });
  await createApplication(page, { company: "Delta", status: "APPLIED" });
  await page.getByRole("link", { name: "Board", exact: true }).click();
  await expect(card(page, "Alpha")).toBeVisible();
});

test("columns render; Rejected and Withdrawn start collapsed", async ({ page }) => {
  await expect(column(page, "Rejected")).toHaveAttribute("aria-label", /collapsed/);
  await expect(column(page, "Withdrawn")).toHaveAttribute("aria-label", /collapsed/);
  await expect(column(page, "Saved")).toHaveAttribute("aria-label", "Saved column, 2 applications");
});

test("drag between columns and within a column", async ({ page }) => {
  await drag(page, card(page, "Alpha"), card(page, "Delta"));
  await expect.poll(async () => (await board(page)).APPLIED).toEqual(["Charlie", "Alpha", "Delta"]);

  await drag(page, card(page, "Delta"), card(page, "Charlie"));
  await expect.poll(async () => (await board(page)).APPLIED).toEqual(["Delta", "Charlie", "Alpha"]);
});

// Regression: Bravo has a card (Alpha) above it. A tilted drag preview once made ArrowRight move it UP
// within its own column, because the tilt pushed the preview's left edge past the neighbouring card's.
test("keyboard: Space, arrow, Space moves a card and is announced", async ({ page }) => {
  // Each step waits for its screen-reader announcement, like a keyboard user hearing it.
  await card(page, "Bravo").focus();
  await page.keyboard.press("Space");
  // (The live region keeps only the latest message: "Picked up…" is replaced by "…is over Saved." at once.)
  await expect(page.getByText("Bravo is over Saved.")).toBeAttached();
  // dnd-kit measures the columns just after pick-up; give it a beat (a person never presses this fast).
  await page.waitForTimeout(300);
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("Bravo is over Applied.")).toBeAttached();
  await page.keyboard.press("Space");
  await expect.poll(async () => (await board(page)).APPLIED).toContain("Bravo");
  await expect(page.getByText("Bravo dropped in Applied.")).toBeAttached();
});

test("drop onto a collapsed column", async ({ page }) => {
  await drag(page, card(page, "Charlie"), column(page, "Rejected"), { where: "middle", reaim: true });
  await expect.poll(async () => (await board(page)).REJECTED).toEqual(["Charlie"]);
});

test("a failed move snaps back and shows an error", async ({ page }) => {
  await page.route("**/api/v1/applications/*/move", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "Something went wrong." } }) }),
  );
  await drag(page, card(page, "Delta"), column(page, "Offer"), { where: "middle", reaim: true });
  await expect(visible(page.getByText(/Couldn't move Delta/))).toBeVisible();
  await expect(column(page, "Applied").locator('[aria-roledescription="draggable card"]', { hasText: "Delta" })).toBeVisible();
});

test("clicking a card's name opens the application", async ({ page }) => {
  await card(page, "Bravo").getByRole("link", { name: "Bravo" }).click();
  await expect(page).toHaveURL(/\/applications\/[a-z0-9]+$/);
});

test("type filter and “+ Add” with a preset status", async ({ page }) => {
  await page.getByRole("button", { name: /^Type/ }).click();
  await visible(page.getByLabel("Hybrid")).click();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/employmentType=HYBRID/);
  await expect(card(page, "Charlie")).toBeVisible();
  await expect(card(page, "Alpha")).toHaveCount(0);
  await page.getByRole("button", { name: "✕ Clear" }).click();

  await column(page, "Interview").getByRole("link", { name: "+ Add" }).click();
  await expect(page).toHaveURL(/\/applications\/new\?status=INTERVIEW$/);
  await expect(visible(page.getByLabel("Status", { exact: true }))).toHaveValue("INTERVIEW");
});

test("mobile: “Move to” works without dragging", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/board");
  await card(page, "Alpha").getByLabel("Move to").selectOption("OFFER");
  await expect.poll(async () => (await board(page)).OFFER).toEqual(["Alpha"]);
  await expectNoHorizontalScroll(page);
});
