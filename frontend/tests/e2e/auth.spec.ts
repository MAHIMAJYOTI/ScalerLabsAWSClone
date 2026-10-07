import { expect, test } from "@playwright/test";

import { HOME, login } from "./helpers";

test.describe("auth", () => {
  test("unauthenticated users are redirected to /login", async ({ page }) => {
    await page.goto(HOME);
    await page.waitForURL("**/login");
    await expect(
      page.getByRole("heading", { name: "Sign in to Route 53 Clone" }),
    ).toBeVisible();
  });

  test("login shows the connecting state while the backend warms up", async ({
    page,
  }) => {
    await page.route("**/api/v1/health", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3_000));
      await route.continue();
    });
    await page.goto("/login");
    await expect(page.getByText(/Connecting to server/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeDisabled();
    await expect(page.getByText(/Connecting to server/)).toBeHidden({
      timeout: 10_000,
    });
    await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
    await page.unroute("**/api/v1/health");
  });

  test("login with demo credentials reaches the console", async ({ page }) => {
    await login(page);
    const accountMenu = page.getByRole("button", { name: "Account menu" });
    await expect(accountMenu).toBeVisible();
    await expect(accountMenu).toContainText("demo-user @ 1234-5678-9012");
  });

  test("wrong password shows an inline error", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Username").fill("demo");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(
      page.getByText("Invalid username or password.", { exact: true }),
    ).toBeVisible();
  });

  test("logout clears the session and protects routes again", async ({
    page,
  }) => {
    await login(page);
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await page.waitForURL("**/login");
    await page.goto(HOME);
    await page.waitForURL("**/login");
  });
});
