import { execSync } from "node:child_process";
import fs from "node:fs";
import pg from "pg";
import { TEST_DATABASE_URL, TEST_UPLOAD_DIR } from "../vitest.config.js";

/** Creates the test database if needed and applies migrations (non-destructive). */
export default async function setup() {
  const url = new URL(TEST_DATABASE_URL);
  const dbName = url.pathname.slice(1);
  if (!dbName.endsWith("_test")) throw new Error(`Refusing to run tests against non-test database "${dbName}"`);

  // Connect to the default "postgres" database to create the test DB.
  const admin = new pg.Client({ connectionString: Object.assign(new URL(url), { pathname: "/postgres" }).toString() });
  await admin.connect();
  const { rowCount } = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  if (rowCount === 0) await admin.query(`CREATE DATABASE "${dbName}"`);
  await admin.end();

  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL, PRISMA_HIDE_UPDATE_MESSAGE: "1" },
    stdio: "pipe",
  });

  // Returned function runs after all tests: remove files uploaded by the document tests.
  return () => fs.rmSync(TEST_UPLOAD_DIR, { recursive: true, force: true });
}
