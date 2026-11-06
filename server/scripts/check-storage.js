// Live check of the configured storage driver: upload a tiny PDF, read it back, delete it.
// Run from the server folder, e.g.:
//   STORAGE_DRIVER=cloudinary CLOUDINARY_URL='cloudinary://…' node scripts/check-storage.js
import { storage } from "../src/lib/storage/index.js";
import { env } from "../src/config/env.js";

const pdf = Buffer.from("%PDF-1.4\n% JobTrack storage check\n%%EOF\n");
let key;
try {
  console.log(`Driver: ${env.STORAGE_DRIVER}`);
  key = await storage.save(pdf, { userId: "storagecheck", ext: "pdf" });
  console.log(`✔ uploaded   ${key}`);
  const { stream, size } = await storage.read(key);
  const back = Buffer.concat(await stream.toArray());
  if (!back.equals(pdf)) throw new Error(`downloaded bytes differ (${back.length} vs ${pdf.length})`);
  console.log(`✔ downloaded ${back.length} bytes, identical${size ? ` (reported size ${size})` : ""}`);
  await storage.remove(key);
  key = null;
  console.log("✔ deleted");
  console.log("Storage works.");
} catch (err) {
  console.error(`✘ ${err.message}`);
  if (key) await storage.remove(key).catch(() => {});
  process.exitCode = 1;
}
