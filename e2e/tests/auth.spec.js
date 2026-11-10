import { expect, test } from "@playwright/test";
import { createUser, login, testEmail } from "../helpers.js";

test("register through the form lands on the dashboard with a verify-email banner", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Name").fill("Reg Ister");
  await page.getByLabel("Email").fill(testEmail("register"));
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Password must be at least 8 characters")).toBeVisible();

  await page.getByLabel("Password").fill("secret123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Welcome to JobTrack, Reg" })).toBeVisible();
  await expect(page.getByText(/Verify .* to unlock document uploads/)).toBeVisible();
});

test("empty or malformed login is caught in the browser without calling the server", async ({ page }) => {
  await page.goto("/login");
  let signInRequests = 0;
  page.on("request", (r) => r.url().includes("/api/auth/callback/credentials") && signInRequests++);

  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Enter your email")).toBeVisible();
  await expect(page.getByText("Enter your password")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeFocused();
  await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");

  await page.getByLabel("Email").fill("not-an-email");
  await page.getByLabel("Password").fill("whatever1");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Enter a valid email")).toBeVisible();
  await expect(page.getByText("Enter your password")).toBeHidden();
  await expect(page.getByText("Invalid email or password.")).toBeHidden();
  expect(signInRequests).toBe(0);
});

test("wrong password shows a generic error", async ({ page }) => {
  const user = createUser("wrongpw");
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill("not-the-password1");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Invalid email or password.")).toBeVisible();
});

test("signed-out visitors are sent to login and returned to the page they wanted", async ({ page }) => {
  const user = createUser("redirect");
  await page.goto("/board");
  await expect(page).toHaveURL(/\/login\?callbackUrl=/);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/board$/);
});

test("log out from the user menu", async ({ page }) => {
  const user = createUser("logout", { name: "Lou Gout" });
  await login(page, user);
  await page.getByRole("button", { name: "Lou Gout" }).click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?callbackUrl=/);
});
