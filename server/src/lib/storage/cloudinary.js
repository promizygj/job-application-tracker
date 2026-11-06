import { Readable } from "node:stream";
import { v2 as cloudinarySdk } from "cloudinary";
import { StorageNotFoundError } from "./errors.js";

/**
 * Files in Cloudinary as private "raw" assets: never publicly reachable. The API downloads them
 * with a short-lived signed Cloudinary link and streams them to the browser itself, so it controls
 * the file name and inline/attachment behaviour (and PDF preview works).
 * The SDK reads credentials from the CLOUDINARY_URL environment variable.
 */
export function createCloudinaryStorage({ folder, client = cloudinarySdk, fetchImpl = fetch }) {
  // Raw assets keep their extension in the public id: "<folder>/<userId>/<random>.pdf".
  const publicId = (key) => `${folder}/${key}`;
  const asset = { resource_type: "raw", type: "private" };

  return {
    put(key, buffer) {
      return new Promise((resolve, reject) => {
        const upload = client.uploader.upload_stream({ ...asset, public_id: publicId(key), overwrite: false }, (err, result) =>
          err ? reject(err) : resolve(result),
        );
        upload.end(buffer);
      });
    },

    async remove(key) {
      const { result } = await client.uploader.destroy(publicId(key), { ...asset, invalidate: true });
      if (result !== "ok" && result !== "not found") throw new Error(`Cloudinary could not delete ${key}: ${result}`);
    },

    async read(key) {
      const url = client.utils.private_download_url(publicId(key), undefined, {
        ...asset,
        expires_at: Math.floor(Date.now() / 1000) + 60,
      });
      const res = await fetchImpl(url);
      if (res.status === 404) throw new StorageNotFoundError(key);
      if (!res.ok || !res.body) throw new Error(`Cloudinary download failed (${res.status}) for ${key}`);
      const size = Number(res.headers.get("content-length"));
      return { stream: Readable.fromWeb(res.body), size: Number.isFinite(size) && size > 0 ? size : undefined };
    },
  };
}
