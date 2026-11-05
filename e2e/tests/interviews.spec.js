import { expect, test } from "@playwright/test";
import { api, createApplication, createUser, dialog, expectNoHorizontalScroll, login, visible, ymdIn } from "../helpers.js";

let stripe;
let monzo;

const item = (page, title) => visible(page.locator("li", { hasText: title })).first();

test.beforeEach(async ({ page }) => {
  await login(page, createUser("interviews"));
  await api(page, "/api/v1/users/me", { method: "PATCH", body: { timezone: "Africa/Lagos" } });
  stripe = await createApplication(page, { company: "Stripe", jobTitle: "Frontend Engineer", status: "APPLIED" });
  monzo = await createApplication(page, { company: "Monzo", status: "INTERVIEW" });
  await page.reload(); // the profile changed behind the app's back
});

async function scheduleForStripe(page, { day, time = "14:00", timezone = "Europe/London" }) {
  await page.getByRole("button", { name: "+ Schedule interview" }).click();
  const d = dialog(page);
  await d.getByLabel("Search applications").fill("str");
  await expect(d.getByRole("combobox", { name: "Application" }).locator("option", { hasText: "Stripe" })).toHaveCount(1);
  await d.getByRole("combobox", { name: "Application" }).selectOption(stripe.id);
  await d.getByLabel("Title *").fill("Technical round 1");
  await d.getByLabel("Type *").selectOption("TECHNICAL");
  await d.getByLabel("Date *").fill(day);
  await d.getByLabel("Start time *").fill(time);
  await d.getByLabel("Time zone").selectOption(timezone);
  await d.getByLabel("Meeting link").fill("https://meet.example.com/abc");
  await d.getByLabel("Interviewer name").fill("Jane Doe");
  await d.getByRole("button", { name: "Schedule" }).click();
}

test("schedule with validation, time-zone conversion and the “Move to Interview?” prompt", async ({ page }) => {
  await page.getByRole("link", { name: "Interviews" }).click();
  await expect(page.getByText("Times shown in Africa/Lagos")).toBeVisible();

  await page.getByRole("button", { name: "+ Schedule interview" }).click();
  await dialog(page).getByRole("button", { name: "Schedule" }).click();
  for (const msg of ["Choose the application", "Give the interview a title", "Pick a date", "Pick a start time"]) {
    await expect(dialog(page).getByText(msg)).toBeVisible();
  }
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);

  const day = ymdIn("Europe/London", 2);
  await scheduleForStripe(page, { day });
  await expect(page.getByText("Interview scheduled with Stripe")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Move Stripe to Interview?" })).toBeVisible();
  await dialog(page).getByRole("button", { name: "Move to Interview" }).click();
  await expect(page.getByText("Moved Stripe to Interview")).toBeVisible();

  const app = (await api(page, `/api/v1/applications/${stripe.id}`)).data.application;
  expect(app.status).toBe("INTERVIEW");
  // London is on GMT in this test's date range only in winter; compute the expected UTC instant instead.
  const londonOffsetMin = -new Date(`${day}T12:00:00Z`).toLocaleString("en-US", { timeZone: "Europe/London", timeZoneName: "shortOffset" }).match(/GMT([+-]\d+)?/)[1] * 60 || 0;
  expect(app.interviews[0].startsAt).toBe(new Date(Date.parse(`${day}T14:00:00Z`) + londonOffsetMin * 60_000).toISOString());

  // Shown in the profile zone (Lagos = UTC+1), with the original zone noted.
  const times = await item(page, "Technical round 1").locator("div").first().innerText();
  expect(times).toContain("London");
});

test("no prompt when the application is already at Interview", async ({ page }) => {
  await page.goto("/interviews");
  await page.getByRole("button", { name: "+ Schedule interview" }).click();
  await dialog(page).getByRole("combobox", { name: "Application" }).selectOption(monzo.id);
  await dialog(page).getByLabel("Title *").fill("HR screen");
  await dialog(page).getByLabel("Date *").fill(ymdIn("Africa/Lagos", 5));
  await dialog(page).getByLabel("Start time *").fill("09:30");
  await dialog(page).getByRole("button", { name: "Schedule" }).click();
  await expect(page.getByText("Interview scheduled with Monzo")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Move Monzo/ })).toHaveCount(0);
});

test("past interviews: set outcome inline and add feedback", async ({ page }) => {
  await api(page, `/api/v1/applications/${monzo.id}/interviews`, {
    method: "POST",
    body: { title: "Recruiter call", type: "PHONE", startsAt: new Date(Date.now() - 2 * 864e5).toISOString() },
  });
  await page.goto("/interviews?view=past");
  await item(page, "Recruiter call").getByLabel("Outcome").selectOption("PASSED");
  await expect(page.getByText("Outcome saved")).toBeVisible();
  await item(page, "Recruiter call").getByRole("button", { name: "Add feedback" }).click();
  await dialog(page).getByLabel("Feedback / how it went").fill("Next step is a take-home");
  await dialog(page).getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Interview updated")).toBeVisible();
  const [past] = (await api(page, "/api/v1/interviews?when=past")).data;
  expect(past).toMatchObject({ outcome: "PASSED", feedbackNotes: "Next step is a take-home" });
});

test("calendar, editing in the interview's own zone, board and dashboard times", async ({ page }) => {
  const day = ymdIn("Europe/London", 2);
  await page.goto("/interviews");
  await scheduleForStripe(page, { day });
  await dialog(page).getByRole("button", { name: "Not now" }).click();

  await page.getByRole("tab", { name: "Calendar" }).click();
  if (day.slice(0, 7) !== ymdIn("Africa/Lagos").slice(0, 7)) await page.getByRole("button", { name: "Next month" }).click();
  const label = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
  await page.getByRole("button", { name: new RegExp(`^${label}, 1 interview`) }).click();
  await expect(item(page, "Technical round 1")).toBeVisible();

  await page.getByRole("tab", { name: "Upcoming" }).click();
  await item(page, "Technical round 1").getByRole("button", { name: "Edit" }).click();
  await expect(dialog(page).getByLabel("Start time *")).toHaveValue("14:00");
  await dialog(page).getByLabel("Start time *").fill("16:00");
  await dialog(page).getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Interview updated")).toBeVisible();

  const [interview] = (await api(page, `/api/v1/applications/${stripe.id}`)).data.application.interviews;
  const lagos = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }).format(new Date(interview.startsAt));
  await page.goto("/board");
  await expect(visible(page.locator('[aria-label^="Stripe,"]')).getByText(`📅`)).toContainText(lagos);
  await page.goto("/dashboard");
  await expect(page.locator("section", { hasText: "Upcoming interviews" })).toContainText(lagos);
});

test("schedule and delete from the application page", async ({ page }) => {
  await page.goto(`/applications/${stripe.id}`);
  await page.getByRole("tab", { name: /Interviews/ }).click();
  await page.getByRole("button", { name: "+ Schedule interview" }).click();
  await expect(dialog(page).getByLabel("Search applications")).toHaveCount(0);
  await expect(dialog(page).getByText("For Stripe")).toBeVisible();
  await dialog(page).getByLabel("Title *").fill("Final round");
  await dialog(page).getByLabel("Date *").fill(ymdIn("Africa/Lagos", 9));
  await dialog(page).getByLabel("Start time *").fill("11:00");
  await dialog(page).getByRole("button", { name: "Schedule" }).click();
  await expect(item(page, "Final round")).toBeVisible();
  await dialog(page).getByRole("button", { name: "Not now" }).click();

  await item(page, "Final round").getByRole("button", { name: "Delete" }).click();
  await dialog(page).getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Interview deleted")).toBeVisible();
  await expect(item(page, "Final round")).toHaveCount(0);
});

test("mobile: list and calendar without horizontal scrolling", async ({ page }) => {
  await api(page, `/api/v1/applications/${stripe.id}/interviews`, {
    method: "POST",
    body: { title: "Phone screen", type: "PHONE", startsAt: new Date(Date.now() + 864e5).toISOString() },
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/interviews");
  await expect(item(page, "Phone screen")).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.getByRole("tab", { name: "Calendar" }).click();
  await expectNoHorizontalScroll(page);
});
