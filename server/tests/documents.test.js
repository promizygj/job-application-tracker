import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "../src/config/env.js";
import { createUser, prisma, request, resetDb } from "./helpers.js";

// Minimal files that pass magic-byte detection.
const PDF = Buffer.from("%PDF-1.4\n1 0 obj << >> endobj\n%%EOF\n");
const DOCX = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("....[Content_Types].xml....word/document.xml....")]);
const DOC = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(64)]);
const EXE = Buffer.from("MZ\x90\x00 this is not a document");

let alice; // verified
let bob; // verified
let carol; // unverified

const upload = ({ file = PDF, fileName = "my-cv.pdf", type = "CV", name = "Frontend CV", notes, owner = alice } = {}) => {
  const req = request.post("/api/v1/documents").set("Cookie", owner.cookie);
  // null = leave the field out (undefined would fall back to the default value)
  if (type !== null) req.field("type", type);
  if (name !== null) req.field("name", name);
  if (notes !== undefined) req.field("notes", notes);
  if (file) req.attach("file", file, fileName);
  return req;
};
const uploaded = async (opts) => (await upload(opts)).body.data.document;
const storedPath = async (id) => path.join(env.UPLOAD_DIR, (await prisma.document.findUnique({ where: { id } })).storageKey);
const docs = (owner = alice, query = {}) => request.get("/api/v1/documents").query(query).set("Cookie", owner.cookie);

beforeEach(async () => {
  await resetDb();
  alice = await createUser({ emailVerifiedAt: new Date() });
  bob = await createUser({ emailVerifiedAt: new Date() });
  carol = await createUser();
});

afterAll(() => prisma.$disconnect());

describe("POST /documents (upload)", () => {
  it("stores a PDF as version 1, the default, without exposing the storage key", async () => {
    const res = await upload({ notes: "Tailored for frontend roles" });
    expect(res.status).toBe(201);
    const doc = res.body.data.document;
    expect(doc).toMatchObject({
      type: "CV",
      name: "Frontend CV",
      version: 1,
      isDefault: true,
      fileName: "my-cv.pdf",
      mimeType: "application/pdf",
      sizeBytes: PDF.length,
      notes: "Tailored for frontend roles",
      usedInCount: 0,
    });
    expect(doc).not.toHaveProperty("storageKey");
    expect(fs.readFileSync(await storedPath(doc.id))).toEqual(PDF);
  });

  it("detects DOCX and DOC by content and fixes a misleading extension", async () => {
    expect((await uploaded({ file: DOCX, fileName: "letter.docx", type: "COVER_LETTER", name: "Letter" })).mimeType).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    const doc = await uploaded({ file: DOC, fileName: "old.pdf", name: "Old CV" });
    expect(doc).toMatchObject({ mimeType: "application/msword", fileName: "old.doc" });
  });

  it("strips directories from the original filename", async () => {
    expect((await uploaded({ fileName: "../../etc/passwd.pdf" })).fileName).toBe("passwd.pdf");
  });

  it("makes each new upload with the same name the next version and the new default", async () => {
    const v1 = await uploaded();
    const v2 = await uploaded();
    await uploaded({ name: "Fullstack CV" });
    expect(v2).toMatchObject({ version: 2, isDefault: true });

    const list = (await docs(alice, { name: "Frontend CV" })).body.data;
    expect(list.map((d) => [d.version, d.isDefault])).toEqual([
      [2, true],
      [1, false],
    ]);
    expect(list[1].id).toBe(v1.id);
  });

  it("rejects files that are not PDF/DOC/DOCX, whatever their name", async () => {
    const res = await upload({ file: EXE, fileName: "cv.pdf" });
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe("UNSUPPORTED_FILE_TYPE");
    expect(await prisma.document.count()).toBe(0);
  });

  it("rejects files over 4 MB", async () => {
    const big = Buffer.concat([PDF, Buffer.alloc(4 * 1024 * 1024)]);
    const res = await upload({ file: big });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("FILE_TOO_LARGE");
  });

  it.each([
    ["no file", { file: null }, "file"],
    ["missing name", { name: null }, "name"],
    ["bad type", { type: "PHOTO" }, "type"],
  ])("rejects %s", async (_label, opts, field) => {
    const res = await upload(opts);
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.path)).toContain(field);
  });

  it("requires a verified email", async () => {
    const res = await upload({ owner: carol });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("EMAIL_NOT_VERIFIED");
  });
});

describe("GET /documents", () => {
  it("lists only the user's documents, filterable by type", async () => {
    await uploaded();
    await uploaded({ type: "COVER_LETTER", name: "Stripe letter" });
    await uploaded({ owner: bob, name: "Bob's CV" });

    expect((await docs()).body.data.map((d) => d.name)).toEqual(["Frontend CV", "Stripe letter"]);
    expect((await docs(alice, { type: "COVER_LETTER" })).body.data.map((d) => d.name)).toEqual(["Stripe letter"]);
  });

  it("returns 404 for another user's document", async () => {
    const doc = await uploaded();
    expect((await request.get(`/api/v1/documents/${doc.id}`).set("Cookie", bob.cookie)).status).toBe(404);
  });
});

describe("PATCH /documents/:id", () => {
  it("makes an older version the default", async () => {
    const v1 = await uploaded();
    await uploaded();
    const res = await request.patch(`/api/v1/documents/${v1.id}`).set("Cookie", alice.cookie).send({ isDefault: true });
    expect(res.body.data.document.isDefault).toBe(true);
    expect((await docs()).body.data.filter((d) => d.isDefault).map((d) => d.id)).toEqual([v1.id]);
  });

  it("does not allow un-setting the default", async () => {
    const v1 = await uploaded();
    expect((await request.patch(`/api/v1/documents/${v1.id}`).set("Cookie", alice.cookie).send({ isDefault: false })).status).toBe(400);
  });

  it("renaming moves it to the other group as its newest version and keeps one default per group", async () => {
    const a1 = await uploaded({ name: "A" });
    const a2 = await uploaded({ name: "A" }); // default of A
    await uploaded({ name: "B" }); // default of B

    const res = await request.patch(`/api/v1/documents/${a2.id}`).set("Cookie", alice.cookie).send({ name: "B" });
    expect(res.body.data.document).toMatchObject({ name: "B", version: 2, isDefault: false });

    const all = (await docs()).body.data;
    const defaults = Object.fromEntries(all.filter((d) => d.isDefault).map((d) => [d.name, d.id]));
    expect(defaults.A).toBe(a1.id); // A's remaining version was promoted
    expect(Object.keys(defaults).sort()).toEqual(["A", "B"]);
  });

  it("updates notes", async () => {
    const doc = await uploaded();
    const res = await request.patch(`/api/v1/documents/${doc.id}`).set("Cookie", alice.cookie).send({ notes: "Updated" });
    expect(res.body.data.document.notes).toBe("Updated");
  });
});

describe("downloads", () => {
  it("issues a short-lived signed URL that serves the file", async () => {
    const doc = await uploaded();
    const res = await request.get(`/api/v1/documents/${doc.id}/download`).set("Cookie", alice.cookie);
    expect(res.status).toBe(200);
    const { url, expiresAt } = res.body.data;
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());

    // No session cookie: the signature is the authorization.
    const file = await request.get(url).buffer(true).parse((r, cb) => {
      const chunks = [];
      r.on("data", (c) => chunks.push(c));
      r.on("end", () => cb(null, Buffer.concat(chunks)));
    });
    expect(file.status).toBe(200);
    expect(file.headers["content-disposition"]).toBe("attachment; filename*=UTF-8''my-cv.pdf");
    expect(file.body).toEqual(PDF);
  });

  it("supports inline viewing", async () => {
    const doc = await uploaded();
    const { url } = (await request.get(`/api/v1/documents/${doc.id}/download?inline=true`).set("Cookie", alice.cookie)).body.data;
    expect((await request.get(url)).headers["content-disposition"]).toMatch(/^inline;/);
  });

  it("rejects tampered and expired links", async () => {
    const doc = await uploaded();
    const { url } = (await request.get(`/api/v1/documents/${doc.id}/download`).set("Cookie", alice.cookie)).body.data;

    const tampered = url.replace(/name=[^&]+/, "name=evil.html");
    expect((await request.get(tampered)).status).toBe(403);

    const expired = url.replace(/exp=\d+/, "exp=1000");
    expect((await request.get(expired)).status).toBe(403);

    expect((await request.get("/api/v1/files/abc/..%2F..%2Fetc%2Fpasswd")).status).toBe(403);
  });

  it("does not issue links for another user's document", async () => {
    const doc = await uploaded();
    expect((await request.get(`/api/v1/documents/${doc.id}/download`).set("Cookie", bob.cookie)).status).toBe(404);
  });
});

describe("attach / detach", () => {
  let app;
  let doc;
  beforeEach(async () => {
    app = (
      await request
        .post("/api/v1/applications")
        .set("Cookie", alice.cookie)
        .send({ company: "Stripe", jobTitle: "FE", employmentType: "REMOTE" })
    ).body.data.application;
    doc = await uploaded();
  });

  const attach = (documentId = doc.id, owner = alice, applicationId = app.id) =>
    request.post(`/api/v1/applications/${applicationId}/documents`).set("Cookie", owner.cookie).send({ documentId });

  it("attaches (idempotently), shows usage and appears on the application", async () => {
    expect((await attach()).status).toBe(201);
    const again = await attach();
    expect(again.status).toBe(201);
    expect(again.body.data.document.usedInCount).toBe(1);

    const listed = await request.get(`/api/v1/applications/${app.id}/documents`).set("Cookie", alice.cookie);
    expect(listed.body.data.map((d) => d.id)).toEqual([doc.id]);
    expect(listed.body.data[0]).toHaveProperty("attachedAt");

    const detail = await request.get(`/api/v1/applications/${app.id}`).set("Cookie", alice.cookie);
    expect(detail.body.data.application.documents.map((d) => d.id)).toEqual([doc.id]);
    expect(detail.body.data.application.documents[0]).not.toHaveProperty("storageKey");
  });

  it("cannot attach another user's document or to another user's application", async () => {
    const bobDoc = await uploaded({ owner: bob });
    expect((await attach(bobDoc.id)).status).toBe(404);
    expect((await attach(doc.id, bob, app.id)).status).toBe(404);
  });

  it("detaches without deleting the document", async () => {
    await attach();
    expect((await request.delete(`/api/v1/applications/${app.id}/documents/${doc.id}`).set("Cookie", alice.cookie)).status).toBe(204);
    expect((await request.delete(`/api/v1/applications/${app.id}/documents/${doc.id}`).set("Cookie", alice.cookie)).status).toBe(404);
    expect((await request.get(`/api/v1/documents/${doc.id}`).set("Cookie", alice.cookie)).status).toBe(200);
  });

  it("asks for confirmation before deleting an attached document, then deletes the file too", async () => {
    await attach();
    const file = await storedPath(doc.id);

    const blocked = await request.delete(`/api/v1/documents/${doc.id}`).set("Cookie", alice.cookie);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("DOCUMENT_IN_USE");

    expect((await request.delete(`/api/v1/documents/${doc.id}?force=true`).set("Cookie", alice.cookie)).status).toBe(204);
    expect(fs.existsSync(file)).toBe(false);
    expect(await prisma.applicationDocument.count()).toBe(0);
  });
});

describe("DELETE /documents/:id", () => {
  it("promotes the newest remaining version when the default is deleted", async () => {
    const v1 = await uploaded();
    const v2 = await uploaded();
    await uploaded(); // v3, default
    const v3 = (await docs()).body.data[0];
    await request.delete(`/api/v1/documents/${v3.id}`).set("Cookie", alice.cookie);

    const remaining = (await docs()).body.data;
    expect(remaining.map((d) => [d.id, d.isDefault])).toEqual([
      [v2.id, true],
      [v1.id, false],
    ]);
  });

  it("cannot delete another user's document", async () => {
    const doc = await uploaded();
    expect((await request.delete(`/api/v1/documents/${doc.id}`).set("Cookie", bob.cookie)).status).toBe(404);
  });
});
