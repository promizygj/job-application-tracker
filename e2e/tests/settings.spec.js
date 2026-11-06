import { expect, test } from "@playwright/test";
import { createUser, db, dialog, expectNoHorizontalScroll, login, testEmail, visible } from "../helpers.js";

test("profile: save name and time zone; the change shows everywhere", async ({ page }) => {
  await login(page, createUser("settings-profile", { name: "Sam Settings" }));
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings\/profile$/);
  const save = page.getByRole("button", { name: "Save changes" });
  await expect(save).toBeDisabled();

  await visible(page.getByLabel("Name *")).fill("Samantha Settings");
  await visible(page.getByLabel("Headline")).fill("Frontend developer");
  await visible(page.getByLabel("Time zone")).selectOption("Asia/Tokyo");
  await save.click();
  await expect(page.getByText("Profile saved")).toBeVisible();
  await expect(page.locator("header").getByText("Samantha")).toBeVisible();

  await page.getByRole("link", { name: "Interviews" }).click();
  await expect(page.getByText("Times shown in Asia/Tokyo")).toBeVisible();
});

test("email change: password required, confirmation link switches it", async ({ page }) => {
  const user = createUser("settings-email");
  const newEmail = testEmail("settings-new");
  await login(page, user);
  await page.goto("/settings/profile");

  await page.getByRole("button", { name: "Change email" }).click();
  await visible(page.getByLabel("New email")).fill(newEmail);
  await visible(page.getByLabel("Current password")).fill("wrong-one1");
  await page.getByRole("button", { name: "Send confirmation link" }).click();
  await expect(visible(page.getByText("Password is incorrect"))).toBeVisible();
  await visible(page.getByLabel("Current password")).fill(user.password);
  await page.getByRole("button", { name: "Send confirmation link" }).click();
  await expect(visible(page.getByText(/We sent a confirmation link to/))).toBeVisible();

  // The link from the email (printed to the server console in dev).
  const { token } = db("email-change-token", user.email, newEmail);
  await page.goto(`/confirm-email?token=${token}`);
  await expect(page.getByText(`Your JobTrack email is now ${newEmail}`)).toBeVisible();
  await page.getByRole("link", { name: "Go to settings" }).click();
  await expect(visible(page.getByText(newEmail, { exact: true }))).toBeVisible();
  await expect(visible(page.getByText("Verified", { exact: true }))).toBeVisible();
  await expect(visible(page.getByText(/We sent a confirmation link/))).toHaveCount(0);
});

test("password change keeps this device signed in and signs out the others", async ({ page, browser }) => {
  const user = createUser("settings-password", { name: "Pat Word" });
  await login(page, user);
  const other = await (await browser.newContext()).newPage();
  await login(other, user);

  await page.goto("/settings/security");
  await visible(page.getByLabel("Current password")).fill(user.password);
  await visible(page.getByLabel("New password", { exact: true })).fill("newpass456");
  await visible(page.getByLabel("Confirm new password")).fill("different1");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(visible(page.getByText("Passwords don't match"))).toBeVisible();
  await visible(page.getByLabel("Confirm new password")).fill("newpass456");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Password changed. Other devices have been signed out.")).toBeVisible();

  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByRole("heading", { name: "Welcome to JobTrack, Pat" })).toBeVisible();
  await other.goto("/dashboard");
  await expect(other).toHaveURL(/\/login/);
  await other.close();
});

test("sign out everywhere", async ({ page }) => {
  await login(page, createUser("settings-signout"));
  await page.goto("/settings/security");
  await page.getByRole("button", { name: "Sign out everywhere" }).click();
  await dialog(page).getByRole("button", { name: "Sign out everywhere" }).click();
  await expect(page).toHaveURL(/\/login\?signedout=all$/);
  await expect(page.getByText("You've been signed out on every device.")).toBeVisible();
});

test("delete account: needs the typed email and the right password", async ({ page }) => {
  const user = createUser("settings-delete");
  await login(page, user);
  await page.goto("/settings/security");
  const del = page.getByRole("button", { name: "Delete my account" });
  await expect(del).toBeDisabled();

  await visible(page.getByLabel(`Type ${user.email} to confirm`)).fill(user.email);
  await visible(page.getByLabel("Your password")).fill("wrong-one1");
  await del.click();
  await dialog(page).getByRole("button", { name: "Yes, delete everything" }).click();
  await expect(visible(page.getByText("Password is incorrect"))).toBeVisible();
  expect(db("user-exists", user.email).exists).toBe(true);

  await visible(page.getByLabel("Your password")).fill(user.password);
  await del.click();
  await dialog(page).getByRole("button", { name: "Yes, delete everything" }).click();
  await expect(page).toHaveURL(/\/login\?deleted=1$/);
  await expect(page.getByText("Your account and all its data have been deleted.")).toBeVisible();
  expect(db("user-exists", user.email).exists).toBe(false);
});

test("mobile settings layout", async ({ page }) => {
  await login(page, createUser("settings-mobile"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/settings/profile");
  await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible();
  await expectNoHorizontalScroll(page);
});
