import crypto from "node:crypto";
import path from "node:path";
import { env } from "../../config/env.js";
import { createCloudinaryStorage } from "./cloudinary.js";
import { createLocalStorage } from "./local.js";

export { StorageNotFoundError } from "./errors.js";

/**
 * One interface, two drivers (STORAGE_DRIVER):
 *   save(buffer, { userId, ext }) → storageKey   remove(storageKey)   read(storageKey) → { stream, size? }
 * Keys look like "<userId>/<32 hex>.<ext>". Anything else is rejected, which rules out path tricks.
 */
const KEY_PATTERN = /^[a-z0-9]+\/[a-f0-9]{32}\.(pdf|docx|doc)$/;
export const isStorageKey = (key) => KEY_PATTERN.test(key);

function assertKey(key) {
  if (!isStorageKey(key)) throw new Error(`Invalid storage key: ${key}`);
}

const driver =
  env.STORAGE_DRIVER === "cloudinary"
    ? createCloudinaryStorage({ folder: env.CLOUDINARY_FOLDER })
    : createLocalStorage({ root: path.resolve(process.cwd(), env.UPLOAD_DIR) });

export const storage = {
  async save(buffer, { userId, ext }) {
    const key = `${userId}/${crypto.randomBytes(16).toString("hex")}.${ext}`;
    assertKey(key);
    await driver.put(key, buffer);
    return key;
  },
  remove(key) {
    assertKey(key);
    return driver.remove(key);
  },
  read(key) {
    assertKey(key);
    return driver.read(key);
  },
};
