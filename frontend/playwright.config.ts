import { defineConfig, devices } from "@playwright/test";

// Live mode: set E2E_BASE_URL to run against a deployed instance — Playwright
// then skips managing the local frontend server entirely.
const liveBaseUrl = process.env.E2E_BASE_URL?.replace(/\/+$/, "");

// For local runs the FastAPI backend must already be running on :8000 with
// seed data (cd backend && ./start.sh equivalent).
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  retries: 0,
  workers: 1, // serial: specs share backend state
  reporter: [["list"]],
  use: {
    baseURL: liveBaseUrl ?? "http://localhost:3000",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: liveBaseUrl
    ? undefined
    : {
        command: "npm run start",
        url: "http://localhost:3000/login",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
