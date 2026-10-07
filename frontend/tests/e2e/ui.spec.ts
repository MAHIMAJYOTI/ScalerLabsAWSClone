import { expect, test } from "@playwright/test";

import { login } from "./helpers";

test.describe("ui extras", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("dark mode persists across reload", async ({ page }) => {
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(
      page.getByRole("heading", { name: "Unified settings" }),
    ).toBeVisible();
    await page.getByRole("radio", { name: "Dark", exact: true }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.locator("body")).toHaveClass(/awsui-dark-mode/);

    await page.reload();
    await expect(page.locator("body")).toHaveClass(/awsui-dark-mode/);

    // Capture the dark zones list for the README while we're here.
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: "e2e-artifacts/zones-list-dark.png",
      fullPage: true,
    });
  });

  test("? opens the keyboard shortcuts modal", async ({ page }) => {
    await page.keyboard.press("?");
    await expect(
      page.getByRole("heading", { name: "Keyboard shortcuts" }),
    ).toBeVisible();
    await expect(page.getByText("Focus the table filter")).toBeVisible();
  });

  test("/ focuses the zones table filter", async ({ page }) => {
    await page.keyboard.press("/");
    await expect(
      page.getByPlaceholder("Filter hosted zones by property or value"),
    ).toBeFocused();
  });

  test("dashboard shows the live hosted zones count", async ({ page }) => {
    const response = await page.request.get("/api/v1/hostedzones?page_size=1");
    const { total } = (await response.json()) as { total: number };

    await page.goto("/route53/v2/dashboard");
    await expect(
      page.getByRole("heading", { name: "Route 53 Dashboard" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: String(total), exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Traffic policies").first()).toBeVisible();
    await expect(page.getByText("Health checks").first()).toBeVisible();
    await expect(page.getByText("Registered domains").first()).toBeVisible();
  });

  test("c on the zones list navigates to create", async ({ page }) => {
    await page.keyboard.press("c");
    await page.waitForURL("**/hostedzones/create");
    await expect(
      page.getByRole("heading", { name: "Create hosted zone" }),
    ).toBeVisible();
  });
});
