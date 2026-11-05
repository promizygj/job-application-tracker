import { db } from "./helpers.js";

/** Delete every e2e-…@example.com account the run created (their uploaded files too). */
export default function globalTeardown() {
  const { deleted } = db("cleanup");
  console.log(`\nCleaned up ${deleted} e2e test account(s).`);
}
