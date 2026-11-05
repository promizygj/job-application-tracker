import os from "node:os";
import path from "node:path";
import { defineConfig } from "vitest/config";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://jat:jat_dev_password@localhost:5432/job_tracker_test?schema=public";

export const TEST_UPLOAD_DIR = path.join(os.tmpdir(), "jat-test-uploads");

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./tests/globalSetup.js"],
    env: { NODE_ENV: "test", DATABASE_URL: TEST_DATABASE_URL, SMTP_HOST: "", UPLOAD_DIR: TEST_UPLOAD_DIR },
    // Test files share one database, so run them one at a time.
    fileParallelism: false,
  },
});
