import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { StorageNotFoundError } from "./errors.js";

/** Files on the local disk under `root` (development; Render's free disk is wiped on every restart). */
export function createLocalStorage({ root }) {
  const resolve = (key) => {
    const full = path.join(root, key);
    if (!full.startsWith(root + path.sep)) throw new Error("Path escapes upload directory");
    return full;
  };

  return {
    async put(key, buffer) {
      const full = resolve(key);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, buffer, { flag: "wx" });
    },

    async remove(key) {
      const full = resolve(key);
      await fs.rm(full, { force: true });
      await fs.rmdir(path.dirname(full)).catch(() => {}); // tidy up the user's folder once it's empty
    },

    async read(key) {
      const full = resolve(key);
      try {
        const { size } = await fs.stat(full);
        return { stream: createReadStream(full), size };
      } catch (err) {
        if (err.code === "ENOENT") throw new StorageNotFoundError(key);
        throw err;
      }
    },
  };
}
