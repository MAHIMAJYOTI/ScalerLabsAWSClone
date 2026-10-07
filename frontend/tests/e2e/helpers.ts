import { expect, type Page } from "@playwright/test";

export const HOME = "/route53/v2/hostedzones";

export async function login(page: Page): Promise<void> {
  await page.goto("/login");
  // Wait for hydration (the /auth/me probe) before typing, otherwise the
  // native form submit fires before React attaches its handlers.
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Username").fill("demo");
  await page.getByLabel("Password").fill("route53demo");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(`**${HOME}`);
  await expect(
    page.getByRole("heading", { name: /Hosted zones/ }),
  ).toBeVisible();
}

export function uniqueZoneName(prefix: string): string {
  return `${prefix}-${Date.now()}.io`;
}

/** Create a hosted zone through the UI; resolves to its details URL. */
export async function createZoneViaUi(
  page: Page,
  name: string,
  options: { privateZone?: boolean } = {},
): Promise<string> {
  await page.goto(`${HOME}/create`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Domain name", { exact: false }).fill(name);
  if (options.privateZone) {
    await page.getByText("Private hosted zone", { exact: true }).click();
    // The first VPC row is pre-filled with us-east-1 + the default VPC id;
    // just assert the section appeared.
    await expect(
      page.getByText("VPCs to associate with the hosted zone"),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Create hosted zone" }).last().click();
  await page.waitForURL(/\/route53\/v2\/hostedzones\/Z[A-Z0-9]+$/);
  return page.url();
}
