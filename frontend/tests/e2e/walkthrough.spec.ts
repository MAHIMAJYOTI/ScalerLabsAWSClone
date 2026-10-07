import { expect, test, type Page } from "@playwright/test";

import { HOME, createZoneViaUi, login } from "./helpers";

const DIR = "e2e-artifacts/walkthrough";
const STAMP = Date.now();
const PUBLIC_ZONE = `walk-pub-${STAMP}.com`;
const PRIVATE_ZONE = `walk-priv-${STAMP}.corp`;

let step = 0;

async function shoot(page: Page, name: string): Promise<void> {
  step += 1;
  await page.waitForTimeout(350);
  await page.screenshot({
    path: `${DIR}/${String(step).padStart(2, "0")}-${name}.png`,
    fullPage: true,
  });
}

test("full user walkthrough with screenshots", async ({ page }) => {
  test.setTimeout(240_000);

  // login
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await shoot(page, "login");
  await login(page);

  // zones list
  await expect(page.getByRole("link", { name: "acme-staging.io" })).toBeVisible();
  await shoot(page, "zones-list");

  // create public zone
  await page.goto(`${HOME}/create`);
  await page.waitForLoadState("networkidle");
  await shoot(page, "create-zone-form");
  await createZoneViaUi(page, PUBLIC_ZONE);
  await shoot(page, "zone-created-details");

  // create private zone
  await createZoneViaUi(page, PRIVATE_ZONE, { privateZone: true });
  await page.getByText("Hosted zone details", { exact: true }).click();
  await expect(page.getByText("Private hosted zone").first()).toBeVisible();
  await shoot(page, "private-zone-details");

  // edit description
  await page.getByRole("button", { name: "Edit hosted zone" }).click();
  await page.waitForURL("**/edit");
  await page.getByLabel(/Description/).fill("walkthrough description");
  await shoot(page, "edit-zone");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.waitForURL(/hostedzones\/Z[A-Z0-9]+$/);

  // create 3 records on the public zone
  await page.goto(HOME);
  await page.waitForLoadState("networkidle");
  await page
    .getByPlaceholder("Filter hosted zones by property or value")
    .fill(PUBLIC_ZONE);
  await page.getByRole("link", { name: PUBLIC_ZONE }).click();
  await page.waitForURL(/hostedzones\/Z/);
  const zoneUrl = page.url();
  await page.getByRole("button", { name: "Create record" }).first().click();
  await page.waitForURL("**/records/create");
  await page.getByLabel("Record name").first().fill("www");
  await page.getByLabel("Value", { exact: true }).first().fill("192.0.2.1");
  await page.getByRole("button", { name: "Add another record" }).click();
  await page.getByLabel("Record name").nth(1).fill("mx");
  await page.getByRole("button", { name: /Record type/ }).nth(1).click();
  await page.getByRole("option", { name: /MX/ }).click();
  await page
    .getByLabel("Value", { exact: true })
    .nth(1)
    .fill(`10 mail.${PUBLIC_ZONE}`);
  await page.getByRole("button", { name: "Add another record" }).click();
  await page.getByLabel("Record name").nth(2).fill("note");
  await page.getByRole("button", { name: /Record type/ }).nth(2).click();
  await page.getByRole("option", { name: /TXT/ }).click();
  await page.getByLabel("Value", { exact: true }).nth(2).fill("walkthrough txt");
  await shoot(page, "create-records-3-blocks");
  await page.getByRole("button", { name: "Create records" }).click();
  await page.waitForURL(zoneUrl);
  await expect(
    page.getByText("3 records were successfully created."),
  ).toBeVisible();
  await shoot(page, "records-created-flash");

  // split panel
  await page.getByRole("button", { name: `www.${PUBLIC_ZONE}` }).click();
  await expect(
    page.getByRole("heading", { name: "Record details" }),
  ).toBeVisible();
  await shoot(page, "split-panel");

  // edit record
  await page.getByRole("button", { name: "Edit record" }).click();
  await page.waitForURL("**/edit");
  await page.getByLabel("TTL in seconds").fill("600");
  await shoot(page, "edit-record");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForURL(zoneUrl);

  // view status
  await page.getByRole("button", { name: "View status" }).click();
  await expect(
    page.getByRole("heading", { name: "Change status" }),
  ).toBeVisible();
  await shoot(page, "view-status");
  await page.getByRole("button", { name: "Close", exact: true }).click();

  // filters
  await page.getByRole("button", { name: /Filter by record type/ }).click();
  await page.getByRole("option", { name: "MX", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByText(`10 mail.${PUBLIC_ZONE}`)).toBeVisible();
  await shoot(page, "records-filtered");
  // deselect the MX type filter again
  await page.getByRole("button", { name: /Filter by record type/ }).click();
  await page.getByRole("option", { name: "MX", exact: true }).click();
  await page.keyboard.press("Escape");

  // import
  await page.getByRole("button", { name: "Import zone file" }).click();
  await page.waitForURL("**/import");
  await page.getByText("Load sample").click();
  await shoot(page, "import-page");
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.waitForURL(zoneUrl);
  await expect(page.getByText(/Imported 7 records/)).toBeVisible();
  await shoot(page, "import-done");

  // export both formats (same-origin, cookie rides along)
  const bind = await page.request.get(
    `/api/v1${zoneUrl.split("/v2")[1] ? "" : ""}/hostedzones/${zoneUrl.split("/").pop()}/export?format=bind`,
  );
  expect(bind.status()).toBe(200);
  const json = await page.request.get(
    `/api/v1/hostedzones/${zoneUrl.split("/").pop()}/export?format=json`,
  );
  expect(json.status()).toBe(200);

  // records multi-delete
  await page
    .getByRole("row", { name: /mx\.walk-pub/ })
    .getByRole("checkbox")
    .check();
  await page
    .getByRole("row", { name: /note\.walk-pub/ })
    .getByRole("checkbox")
    .check();
  await page.getByRole("button", { name: "Delete record" }).first().click();
  await shoot(page, "records-delete-modal");
  await page.getByRole("button", { name: "Delete", exact: true }).last().click();
  await expect(page.getByText("2 record(s) deleted.")).toBeVisible();

  // bulk zone delete (public zone is non-empty → mixed result with private)
  await page.goto(HOME);
  await page.waitForLoadState("networkidle");
  await page
    .getByPlaceholder("Filter hosted zones by property or value")
    .fill(String(STAMP));
  await page.getByRole("checkbox", { name: PUBLIC_ZONE }).check();
  await page.getByRole("checkbox", { name: PRIVATE_ZONE }).check();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByPlaceholder("delete").fill("delete");
  await shoot(page, "bulk-delete-modal");
  await page.getByRole("button", { name: "Delete", exact: true }).last().click();
  await expect(
    page.getByText("Some hosted zones couldn't be deleted"),
  ).toBeVisible();
  await shoot(page, "bulk-delete-mixed-result");

  // dark mode
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("radio", { name: "Dark", exact: true }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.locator("body")).toHaveClass(/awsui-dark-mode/);
  await page.getByPlaceholder("Filter hosted zones by property or value").fill("");
  await shoot(page, "dark-mode-zones");

  // keyboard shortcuts modal (blur the filter input first — typing targets
  // inside inputs are intentionally ignored by the shortcut handler)
  await page.getByRole("heading", { name: /Hosted zones/ }).click();
  await page.keyboard.press("?");
  await expect(
    page.getByRole("heading", { name: "Keyboard shortcuts" }),
  ).toBeVisible();
  await shoot(page, "shortcuts-modal");
  await page.getByRole("button", { name: "Close", exact: true }).click();

  // logout
  await page.getByRole("button", { name: "Account menu" }).click();
  await shoot(page, "account-menu");
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.waitForURL("**/login");
  await shoot(page, "logged-out");
});
