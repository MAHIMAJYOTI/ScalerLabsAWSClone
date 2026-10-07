import { expect, test, type Page } from "@playwright/test";

import { createZoneViaUi, login, uniqueZoneName } from "./helpers";

// Serial: the suite builds up state in one dedicated zone.
test.describe.configure({ mode: "serial" });

const zoneName = uniqueZoneName("e2e-records");
let zoneUrl = "";
let zoneId = "";

async function gotoRecordsTab(page: Page): Promise<void> {
  await page.goto(zoneUrl);
  await expect(
    page.getByRole("heading", { name: /^Records/ }).first(),
  ).toBeVisible();
}

test.describe("records", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("create 3 records in one atomic submit (A + MX + TXT)", async ({
    page,
  }) => {
    zoneUrl = await createZoneViaUi(page, zoneName);
    zoneId = zoneUrl.split("/").pop() ?? "";

    await page.getByRole("button", { name: "Create record" }).first().click();
    await page.waitForURL("**/records/create");

    // Block 1: www A
    await page.getByLabel("Record name").first().fill("www");
    await page.getByLabel("Value", { exact: true }).first().fill("192.0.2.10");

    // Block 2: MX at the apex
    await page.getByRole("button", { name: "Add another record" }).click();
    await page.getByRole("button", { name: /Record type/ }).nth(1).click();
    await page.getByRole("option", { name: /MX/ }).click();
    await page
      .getByLabel("Value", { exact: true })
      .nth(1)
      .fill(`10 mail.${zoneName}`);

    // Block 3: TXT
    await page.getByRole("button", { name: "Add another record" }).click();
    await page.getByRole("button", { name: /Record type/ }).nth(2).click();
    await page.getByRole("option", { name: /TXT/ }).click();
    await page.getByLabel("Value", { exact: true }).nth(2).fill("hello e2e world");

    await page.getByRole("button", { name: "Create records" }).click();
    await page.waitForURL(zoneUrl);
    await expect(
      page.getByText("3 records were successfully created."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: `www.${zoneName}` }),
    ).toBeVisible();
  });

  test("server-side duplicate error is mapped onto block 2", async ({
    page,
  }) => {
    await gotoRecordsTab(page);
    await page.getByRole("button", { name: "Create record" }).first().click();
    await page.waitForURL("**/records/create");

    await page.getByLabel("Record name").first().fill("fresh");
    await page.getByLabel("Value", { exact: true }).first().fill("192.0.2.50");

    await page.getByRole("button", { name: "Add another record" }).click();
    await page.getByLabel("Record name").nth(1).fill("www"); // duplicate of existing www A
    await page.getByLabel("Value", { exact: true }).nth(1).fill("192.0.2.51");

    await page.getByRole("button", { name: "Create records" }).click();
    await expect(page.getByText(/but it already exists/)).toBeVisible();

    // atomic: the valid block-1 record was not created either
    await gotoRecordsTab(page);
    await page
      .getByPlaceholder("Filter records by property or value")
      .fill("fresh");
    await expect(page.getByText("No matches")).toBeVisible();
  });

  test("filter records by type", async ({ page }) => {
    await gotoRecordsTab(page);
    await page.getByRole("button", { name: /Filter by record type/ }).click();
    await page.getByRole("option", { name: "MX", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByText(`10 mail.${zoneName}`)).toBeVisible();
    await expect(
      page.getByRole("button", { name: `www.${zoneName}` }),
    ).toBeHidden();
  });

  test("record name link opens the split panel with details", async ({
    page,
  }) => {
    await gotoRecordsTab(page);
    await page.getByRole("button", { name: `www.${zoneName}` }).click();
    await expect(
      page.getByRole("heading", { name: "Record details" }),
    ).toBeVisible();
    await expect(page.getByText("Record type").first()).toBeVisible();
    await expect(page.getByText("Simple").first()).toBeVisible();
  });

  test("edit TTL from the split panel and view change status", async ({
    page,
  }) => {
    await gotoRecordsTab(page);
    await page.getByRole("button", { name: `www.${zoneName}` }).click();
    await page.getByRole("button", { name: "Edit record" }).click();
    await page.waitForURL("**/edit");
    await page.getByLabel("TTL in seconds").fill("600");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.waitForURL(zoneUrl);
    await expect(
      page.getByText(`Record for www.${zoneName} was successfully updated.`),
    ).toBeVisible();

    await page.getByRole("button", { name: "View status" }).click();
    await expect(
      page.getByRole("heading", { name: "Change status" }),
    ).toBeVisible();
    await expect(page.getByText(/Pending|In sync/)).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();
  });

  test("SOA selection blocks deletion with an explanation", async ({
    page,
  }) => {
    await gotoRecordsTab(page);
    await page
      .getByRole("row", { name: /SOA/ })
      .getByRole("checkbox")
      .check();
    await page.getByRole("button", { name: "Delete record" }).first().click();
    await expect(
      page.getByText(
        "You can't delete the SOA record or the NS record for the root domain of the hosted zone.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Delete", exact: true }).last(),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Cancel" }).click();
  });

  test("multi-select delete removes two records", async ({ page }) => {
    await gotoRecordsTab(page);
    await page
      .getByRole("row", { name: /MX/ })
      .getByRole("checkbox")
      .check();
    await page
      .getByRole("row", { name: /TXT/ })
      .getByRole("checkbox")
      .check();
    await page.getByRole("button", { name: "Delete record" }).first().click();
    await expect(
      page.getByText("Are you sure you want to delete the following records?"),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Delete", exact: true })
      .last()
      .click();
    await expect(page.getByText("2 record(s) deleted.")).toBeVisible();
  });

  test("import the sample zone file", async ({ page }) => {
    await gotoRecordsTab(page);
    await page.getByRole("button", { name: "Import zone file" }).click();
    await page.waitForURL("**/import");
    await page.getByText("Load sample").click();
    await expect(page.getByRole("textbox", { name: /Zone file/ })).toHaveValue(/\$ORIGIN/);
    await page.getByRole("button", { name: "Import", exact: true }).click();
    await page.waitForURL(zoneUrl);
    await expect(page.getByText(/Imported \d+ records\. Skipped \d+\./)).toBeVisible();
  });

  test("export returns a downloadable file", async ({ page }) => {
    const response = await page.request.get(
      `/api/v1/hostedzones/${zoneId}/export?format=bind`,
    );
    expect(response.status()).toBe(200);
    expect(response.headers()["content-disposition"] ?? "").toContain(
      "attachment",
    );
  });
});
