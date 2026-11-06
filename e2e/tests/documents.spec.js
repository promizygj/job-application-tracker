import fs from "node:fs";
import { expect, test } from "@playwright/test";
import { DOCX, DOCX_TYPE, PDF } from "../fixtures/files.js";
import { api, createApplication, createUser, dialog, expectNoHorizontalScroll, login } from "../helpers.js";

const group = (page, name) => page.locator(`section[aria-label="${name}"]`);
const row = (page, name, v) => group(page, name).locator("li", { hasText: new RegExp(`^v${v}`) });
const choose = (page, name, buffer, mimeType = "application/pdf") => dialog(page).locator('input[type="file"]').setInputFiles({ name, mimeType, buffer });

async function upload(page, { file = PDF, fileName = "cv.pdf", name, type, mimeType } = {}) {
  await page.getByRole("button", { name: "⬆ Upload" }).click();
  await choose(page, fileName, file, mimeType);
  if (type) await dialog(page).getByLabel("Type").selectOption(type);
  if (name) await dialog(page).getByLabel("Name *").fill(name);
  await dialog(page).getByRole("button", { name: "Upload" }).click();
}

test("unverified accounts can't upload, and are told why", async ({ page }) => {
  await login(page, createUser("docs-unverified"));
  await page.getByRole("link", { name: "Documents" }).click();
  await expect(page.getByText("Verify your email address to upload documents")).toBeVisible();
  await expect(page.getByRole("button", { name: "⬆ Upload" })).toBeDisabled();
});

test.describe("verified", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, createUser("docs", { verified: true }));
    await page.goto("/documents");
    await expect(page.getByText("No documents yet")).toBeVisible();
  });

  test("bad files are rejected before and after uploading", async ({ page }) => {
    await page.getByRole("button", { name: "⬆ Upload" }).click();
    await choose(page, "virus.exe", Buffer.from("MZ..."), "application/octet-stream");
    await expect(dialog(page).getByText("Only PDF, DOC and DOCX files can be uploaded.")).toBeVisible();
    await choose(page, "huge.pdf", Buffer.concat([PDF, Buffer.alloc(5 * 1024 * 1024)]));
    await expect(dialog(page).getByText(/The limit is 4 MB/)).toBeVisible();
    // Passes the browser's checks, but the server reads the bytes: not a PDF.
    await choose(page, "fake.pdf", Buffer.from("not really a pdf"));
    await dialog(page).getByLabel("Name *").fill("Fake");
    await dialog(page).getByRole("button", { name: "Upload" }).click();
    await expect(dialog(page).getByText("Only PDF, DOC and DOCX files are allowed")).toBeVisible();
  });

  test("drag-and-drop upload, versions and the default", async ({ page }) => {
    await page.getByRole("button", { name: "⬆ Upload" }).click();
    await page.evaluate((bytes) => {
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array(bytes)], "frontend-cv_nov.pdf", { type: "application/pdf" }));
      document.querySelector("dialog[open] label").dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
    }, [...PDF]);
    await expect(dialog(page).getByLabel("Name *")).toHaveValue("frontend cv nov"); // suggested from the filename
    await dialog(page).getByLabel("Name *").fill("Frontend CV");
    await dialog(page).getByRole("button", { name: "Upload" }).click();
    await expect(row(page, "Frontend CV", 1).getByText("★ Default")).toBeVisible();

    await group(page, "Frontend CV").getByRole("button", { name: "+ New version" }).click();
    await choose(page, "frontend-cv-dec.pdf", PDF);
    await dialog(page).getByRole("button", { name: "Upload" }).click();
    await expect(row(page, "Frontend CV", 2).getByText("★ Default")).toBeVisible();

    await row(page, "Frontend CV", 1).getByRole("button", { name: "Make default" }).click();
    await expect(row(page, "Frontend CV", 1).getByText("★ Default")).toBeVisible();
    await expect(group(page, "Frontend CV").getByText("★ Default")).toHaveCount(1);
  });

  test("download returns the exact file; preview opens the PDF in a new tab", async ({ page }) => {
    await upload(page, { fileName: "my-cv.pdf", name: "CV" });
    await upload(page, { file: DOCX, fileName: "letter.docx", mimeType: DOCX_TYPE, type: "COVER_LETTER", name: "Letter" });

    const [download] = await Promise.all([page.waitForEvent("download"), row(page, "CV", 1).getByRole("button", { name: "Download" }).click()]);
    expect(download.suggestedFilename()).toBe("my-cv.pdf");
    expect(fs.readFileSync(await download.path()).equals(PDF)).toBe(true);

    // The new tab loads the signed inline link. (Headless Chromium has no PDF viewer and treats the
    // PDF as a download, so check the response rather than what the tab displays.)
    const [response] = await Promise.all([
      page.context().waitForEvent("response", (r) => r.url().includes("/api/v1/files/") && r.url().includes("inline=1")),
      row(page, "CV", 1).getByRole("button", { name: "Preview" }).click(),
    ]);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/pdf");
    expect(response.headers()["content-disposition"]).toBe("inline; filename*=UTF-8''my-cv.pdf");
    await expect(row(page, "Letter", 1).getByRole("button", { name: "Preview" })).toHaveCount(0); // DOCX: download only
  });

  test("rename moves a version into another group", async ({ page }) => {
    await upload(page, { name: "Frontend CV" });
    await group(page, "Frontend CV").getByRole("button", { name: "+ New version" }).click();
    await choose(page, "v2.pdf", PDF);
    await dialog(page).getByRole("button", { name: "Upload" }).click();
    await expect(row(page, "Frontend CV", 2)).toBeVisible();

    await row(page, "Frontend CV", 2).getByRole("button", { name: "Rename" }).click();
    await dialog(page).getByLabel("Name").fill("Fullstack CV");
    await dialog(page).getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Moved to “Fullstack CV” as v1")).toBeVisible();
    await expect(row(page, "Fullstack CV", 1).getByText("★ Default")).toBeVisible();
    await expect(row(page, "Frontend CV", 1).getByText("★ Default")).toBeVisible();
  });

  test("attach, upload-and-attach, detach, and deleting an attached document", async ({ page }) => {
    await upload(page, { name: "Frontend CV" });
    const app = await createApplication(page, { company: "Stripe" });
    await page.goto(`/applications/${app.id}`);
    await page.getByRole("tab", { name: /Documents/ }).click();

    await page.getByLabel("Attach from your library").selectOption({ label: "Frontend CV v1 (default) · CV / résumé" });
    await page.getByRole("button", { name: "Attach", exact: true }).click();
    await expect(page.getByText("Attached Frontend CV v1")).toBeVisible();

    await page.getByRole("button", { name: "⬆ Upload & attach" }).click();
    await choose(page, "letter.pdf", PDF);
    await dialog(page).getByLabel("Type").selectOption("COVER_LETTER");
    await dialog(page).getByLabel("Name *").fill("Stripe letter");
    await dialog(page).getByRole("button", { name: "Upload" }).click();
    await expect(page.getByRole("tab", { name: "Documents (2)" })).toBeVisible();

    await page.getByRole("listitem").filter({ hasText: "Stripe letter" }).getByRole("button", { name: "Detach" }).click();
    await expect(page.getByRole("tab", { name: "Documents (1)" })).toBeVisible();

    await page.getByRole("link", { name: "Documents", exact: true }).click();
    await expect(row(page, "Frontend CV", 1).getByText("used in 1 application")).toBeVisible();
    await row(page, "Frontend CV", 1).getByRole("button", { name: "Delete" }).click();
    await dialog(page).getByRole("button", { name: "Delete", exact: true }).click();
    await expect(dialog(page).getByRole("heading", { name: "This document is in use" })).toBeVisible();
    await dialog(page).getByRole("button", { name: "Delete anyway" }).click();
    await expect(group(page, "Frontend CV")).toHaveCount(0);
    expect((await api(page, `/api/v1/applications/${app.id}`)).data.application.documents).toEqual([]);
  });

  test("type tabs and mobile layout", async ({ page }) => {
    await upload(page, { name: "Frontend CV" });
    await upload(page, { type: "COVER_LETTER", name: "Stripe letter" });
    await page.getByRole("tab", { name: "Cover letters" }).click();
    await expect(page).toHaveURL(/type=COVER_LETTER/);
    await expect(group(page, "Stripe letter")).toBeVisible();
    await expect(group(page, "Frontend CV")).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/documents");
    await expect(group(page, "Stripe letter")).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
