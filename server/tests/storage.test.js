import { Readable } from "node:stream";
import { v2 as cloudinary } from "cloudinary";
import { describe, expect, it } from "vitest";
import { createCloudinaryStorage } from "../src/lib/storage/cloudinary.js";
import { StorageNotFoundError } from "../src/lib/storage/errors.js";

const KEY = "cmabc123/0123456789abcdef0123456789abcdef.pdf";

/** Real SDK (for URL signing) with a fake uploader that records calls instead of hitting the network. */
function fakeClient({ destroyResult = "ok" } = {}) {
  const calls = { upload: [], destroy: [] };
  cloudinary.config({ cloud_name: "demo-cloud", api_key: "123456", api_secret: "test-secret" });
  const client = {
    utils: cloudinary.utils,
    uploader: {
      upload_stream(options, callback) {
        const chunks = [];
        return {
          end(buffer) {
            chunks.push(buffer);
            calls.upload.push({ options, bytes: Buffer.concat(chunks) });
            callback(null, { public_id: options.public_id });
          },
        };
      },
      async destroy(publicId, options) {
        calls.destroy.push({ publicId, options });
        return { result: destroyResult };
      },
    },
  };
  return { client, calls };
}

describe("Cloudinary storage driver", () => {
  it("uploads as a private raw asset under the folder, never overwriting", async () => {
    const { client, calls } = fakeClient();
    const storage = createCloudinaryStorage({ folder: "jat", client });
    await storage.put(KEY, Buffer.from("%PDF-1.4"));
    expect(calls.upload).toHaveLength(1);
    expect(calls.upload[0].options).toEqual({ resource_type: "raw", type: "private", public_id: `jat/${KEY}`, overwrite: false });
    expect(calls.upload[0].bytes.toString()).toBe("%PDF-1.4");
  });

  it("deletes, treating an already-missing file as done, but surfacing other failures", async () => {
    const ok = fakeClient();
    await createCloudinaryStorage({ folder: "jat", client: ok.client }).remove(KEY);
    expect(ok.calls.destroy[0]).toEqual({ publicId: `jat/${KEY}`, options: { resource_type: "raw", type: "private", invalidate: true } });

    const missing = fakeClient({ destroyResult: "not found" });
    await expect(createCloudinaryStorage({ folder: "jat", client: missing.client }).remove(KEY)).resolves.toBeUndefined();

    const broken = fakeClient({ destroyResult: "error" });
    await expect(createCloudinaryStorage({ folder: "jat", client: broken.client }).remove(KEY)).rejects.toThrow(/could not delete/);
  });

  it("reads through a signed, short-lived private download link and streams the bytes", async () => {
    const { client } = fakeClient();
    let requested;
    const fetchImpl = async (url) => {
      requested = new URL(url);
      return new Response("%PDF-1.4 bytes", { status: 200, headers: { "content-length": "14" } });
    };
    const file = await createCloudinaryStorage({ folder: "jat", client, fetchImpl }).read(KEY);

    expect(requested.origin + requested.pathname).toBe("https://api.cloudinary.com/v1_1/demo-cloud/raw/download");
    expect(requested.searchParams.get("public_id")).toBe(`jat/${KEY}`);
    expect(requested.searchParams.get("type")).toBe("private");
    expect(requested.searchParams.has("format")).toBe(false); // raw files keep the extension in the id
    expect(requested.searchParams.get("signature")).toMatch(/^[a-f0-9]{40,64}$/);
    const expiresIn = Number(requested.searchParams.get("expires_at")) - Date.now() / 1000;
    expect(expiresIn).toBeGreaterThan(30);
    expect(expiresIn).toBeLessThanOrEqual(60);

    expect(file.size).toBe(14);
    expect(file.stream).toBeInstanceOf(Readable);
    expect(Buffer.concat(await file.stream.toArray()).toString()).toBe("%PDF-1.4 bytes");
  });

  it("maps a 404 from Cloudinary to StorageNotFoundError, other errors to a plain error", async () => {
    const { client } = fakeClient();
    const notFound = createCloudinaryStorage({ folder: "jat", client, fetchImpl: async () => new Response("", { status: 404 }) });
    await expect(notFound.read(KEY)).rejects.toBeInstanceOf(StorageNotFoundError);
    const failing = createCloudinaryStorage({ folder: "jat", client, fetchImpl: async () => new Response("", { status: 500 }) });
    await expect(failing.read(KEY)).rejects.toThrow(/download failed \(500\)/);
  });
});
