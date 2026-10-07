import { expect, test, type Page } from "@playwright/test";

import { HOME, login } from "./helpers";

const DIR = "e2e-artifacts";

async function shoot(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(400); // allow layout/animation to settle
  await page.screenshot({ path: `${DIR}/${name}.png`, fullPage: true });
}

interface ZoneItem {
  id: string;
  record_count: number;
}

test.describe("screenshots", () => {
  test("capture the required pages", async ({ page }) => {
    await login(page);

    // the seeded example.com zone with the most records
    const listResponse = await page.request.get(
      "/api/v1/hostedzones?q=example.com&sort_by=record_count&sort_order=desc",
    );
    const { items } = (await listResponse.json()) as { items: ZoneItem[] };
    const zoneId = items[0].id;

    // 1. zones list (alphabetical page 1 shows acme-staging.io first)
    await page.goto(HOME);
    await expect(
      page.getByRole("link", { name: "acme-staging.io" }),
    ).toBeVisible();
    await shoot(page, "zones-list");

    // 2. create zone (private selected)
    await page.goto(`${HOME}/create`);
    await page.waitForLoadState("networkidle");
    // Fill the name first so the autofocus blur doesn't shift the layout
    // under the tile click.
    await page.getByLabel("Domain name", { exact: false }).fill("shot.example");
    await page.getByText("Private hosted zone", { exact: true }).click();
    await expect(
      page.getByText("VPCs to associate with the hosted zone"),
    ).toBeVisible();
    await shoot(page, "create-zone-private");

    // 3. zone details, details section expanded
    await page.goto(`${HOME}/${zoneId}`);
    await page.getByText("Hosted zone details", { exact: true }).click();
    await expect(page.getByText("Name servers")).toBeVisible();
    await shoot(page, "zone-details-expanded");

    // 4. records tab with split panel open
    await page.getByRole("button", { name: "www.example.com" }).first().click();
    await expect(
      page.getByRole("heading", { name: "Record details" }),
    ).toBeVisible();
    await shoot(page, "records-split-panel");

    // 5. create record with 2 blocks
    await page.goto(`${HOME}/${zoneId}/records/create`);
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Record name").first().fill("shot-a");
    await page.getByLabel("Value", { exact: true }).first().fill("192.0.2.77");
    await page.getByRole("button", { name: "Add another record" }).click();
    await expect(page.getByText("Record 2")).toBeVisible();
    await shoot(page, "create-record-2-blocks");

    // 6. edit record (www.example.com A)
    const recordsResponse = await page.request.get(
      `/api/v1/hostedzones/${zoneId}/records?q=www`,
    );
    const records = (await recordsResponse.json()) as {
      items: { id: string }[];
    };
    await page.goto(
      `${HOME}/${zoneId}/records/${records.items[0].id}/edit`,
    );
    await expect(
      page.getByRole("heading", { name: "Edit record" }),
    ).toBeVisible();
    await shoot(page, "edit-record");

    // 7. delete modal
    await page.goto(`${HOME}/${zoneId}`);
    await page
      .getByRole("row", { name: /www\.example\.com/ })
      .first()
      .getByRole("checkbox")
      .check();
    await page.getByRole("button", { name: "Delete record" }).first().click();
    await expect(
      page.getByRole("heading", { name: "Delete records?" }),
    ).toBeVisible();
    await shoot(page, "delete-modal");
    await page.getByRole("button", { name: "Cancel" }).click();

    // 8. import page with the sample loaded
    await page.goto(`${HOME}/${zoneId}/import`);
    await page.waitForLoadState("networkidle");
    await page.getByText("Load sample").click();
    await expect(page.getByRole("textbox", { name: /Zone file/ })).toHaveValue(/\$ORIGIN/);
    await shoot(page, "import-page");
  });
});
