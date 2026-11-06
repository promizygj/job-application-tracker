import { expect, test } from "@playwright/test";
import { api, createApplication, createUser, dialog, expectNoHorizontalScroll, login, visible } from "../helpers.js";

test.beforeEach(async ({ page }) => {
  await login(page, createUser("apps", { name: "Ada Apps" }));
});

test("add an application: validation, save, details page", async ({ page }) => {
  await expect(page.getByRole("heading", { name: /Welcome to JobTrack/ })).toBeVisible();
  await page.getByRole("link", { name: "Add application", exact: true }).click();
  await expect(page).toHaveURL(/\/applications\/new$/);

  await page.getByRole("button", { name: "Save application" }).click();
  await expect(page.getByText("Company is required")).toBeVisible();
  await expect(page.getByText("Choose Remote, Hybrid or On-site")).toBeVisible();

  await visible(page.getByLabel("Company *")).fill("Stripe");
  await visible(page.getByLabel("Job title *")).fill("Frontend Engineer");
  await page.getByText("Hybrid", { exact: true }).click();
  await visible(page.getByLabel("Currency")).fill("eur");
  await visible(page.getByLabel("Minimum")).fill("70000");
  await visible(page.getByLabel("Maximum")).fill("60000");
  await page.getByRole("button", { name: "Save application" }).click();
  await expect(page.getByText("Must be at least the minimum")).toBeVisible();

  await visible(page.getByLabel("Maximum")).fill("90,000");
  await visible(page.getByText("Applied", { exact: true })).click();
  await visible(page.getByLabel("Job description")).fill("Build payment UIs.");
  await page.getByRole("button", { name: "Save application" }).click();

  await expect(page).toHaveURL(/\/applications\/[a-z0-9]+$/);
  await expect(page.getByRole("heading", { name: /Stripe/ })).toBeVisible();
  const meta = visible(page.locator("header p").first());
  await expect(meta).toContainText("Hybrid");
  await expect(meta).toContainText("€70K–€90K / yr");
  await expect(meta).toContainText("Applied");
});

test("change status, see the timeline, edit, then delete", async ({ page }) => {
  const app = await createApplication(page, { company: "Monzo", status: "APPLIED" });
  await page.goto(`/applications/${app.id}`);

  await page.getByRole("combobox", { name: "Status" }).selectOption("INTERVIEW");
  await expect(page.locator("[aria-live=polite]").getByText("Moved to Interview")).toBeVisible();
  await page.getByRole("tab", { name: "Activity" }).click();
  await expect(page.getByRole("tabpanel").getByRole("listitem")).toHaveCount(2);

  await page.getByRole("tab", { name: "Overview" }).click();
  await page.getByRole("link", { name: "Edit" }).click();
  await expect(visible(page.getByLabel("Company *"))).toHaveValue("Monzo");
  await visible(page.getByLabel("Notes")).fill("Recruiter: Sam");
  await page.getByRole("button", { name: "Save changes" }).click();
  // Back on the details page, the Overview tab is shown again (not the Timeline tab from before).
  await expect(visible(page.getByText("Recruiter: Sam"))).toBeVisible();

  await page.getByRole("button", { name: "Delete" }).click();
  await dialog(page).getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/applications$/);
  await expect(page.getByText("No applications yet")).toBeVisible();
});

test("the new-application form starts empty after a previous save", async ({ page }) => {
  await page.goto("/applications/new");
  await visible(page.getByLabel("Company *")).fill("First Co");
  await visible(page.getByLabel("Job title *")).fill("Dev");
  await page.getByText("Remote", { exact: true }).click();
  await page.getByRole("button", { name: "Save application" }).click();
  await expect(page).toHaveURL(/\/applications\/[a-z0-9]+$/);

  await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Applications" }).click();
  await page.getByRole("link", { name: "New application" }).click();
  await expect(visible(page.getByLabel("Company *"))).toHaveValue("");
  await expect(page.getByRole("button", { name: "Save application" })).toBeEnabled();
});

test("search, filter and sort are kept in the URL", async ({ page }) => {
  await createApplication(page, { company: "Stripe", employmentType: "HYBRID" });
  await createApplication(page, { company: "Monzo", status: "APPLIED", appliedAt: "2026-10-01" });
  await createApplication(page, { company: "Vercel" });
  await page.goto("/applications");
  await expect(visible(page.getByText(/^3 applications? · |^3 applications?$/))).toBeVisible();

  await page.getByLabel("Search company or job title").fill("mon");
  await expect(page).toHaveURL(/\?q=mon$/);
  await expect(visible(page.getByText(/^1 applications? · |^1 applications?$/))).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(visible(page.getByText(/^3 applications? · |^3 applications?$/))).toBeVisible();

  await page.getByRole("button", { name: "Filters" }).click();
  await page.getByRole("button", { name: /^Type/ }).click();
  await visible(page.getByLabel("Remote")).click();
  await expect(visible(page.getByText(/^2 applications? · |^2 applications?$/))).toBeVisible();
  await expect(visible(page.getByLabel("Remote"))).toBeChecked();
  await page.keyboard.press("Escape");

  await page.getByLabel("Sort").selectOption("company");
  await expect(page).toHaveURL(/employmentType=REMOTE.*sort=company|sort=company.*employmentType=REMOTE/);
  await expect(page.locator("tbody tr td:first-child a")).toHaveText(["Monzo", "Vercel"]);

  // The URL alone reproduces the view.
  await page.reload();
  await expect(page.locator("tbody tr td:first-child a")).toHaveText(["Monzo", "Vercel"]);
});

test("dashboard reflects new applications", async ({ page }) => {
  const a = await createApplication(page, { company: "Stripe", status: "APPLIED" });
  await api(page, `/api/v1/applications/${a.id}`, { method: "PATCH", body: { status: "INTERVIEW" } });
  await createApplication(page, { company: "Monzo", status: "APPLIED" });
  await page.goto("/dashboard");
  await expect(page.getByText("Total applications")).toBeVisible();
  await expect(page.getByText("50%").first()).toBeVisible(); // 1 of 2 sent reached interview
});

test("mobile: card list without horizontal scrolling", async ({ page }) => {
  await createApplication(page, { company: "Stripe", status: "APPLIED", salaryMin: 50000, salaryMax: 70000, salaryCurrency: "USD" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/applications");
  await expect(page.getByRole("link", { name: /Stripe/ })).toBeVisible();
  await expectNoHorizontalScroll(page);
});
