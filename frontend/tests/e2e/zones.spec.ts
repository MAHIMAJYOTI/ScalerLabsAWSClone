import { expect, test } from "@playwright/test";

import { HOME, createZoneViaUi, login, uniqueZoneName } from "./helpers";

test.describe("hosted zones", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("text filter and type filter work server-side", async ({ page }) => {
    await page
      .getByPlaceholder("Filter hosted zones by property or value")
      .fill("internal");
    await expect(page.getByText(/\d+ matches/).first()).toBeVisible();
    await expect(
      page.getByRole("link", { name: "internal.corp" }),
    ).toBeVisible();

    await page
      .getByPlaceholder("Filter hosted zones by property or value")
      .fill("");
    await page
      .getByRole("button", { name: /Filter by hosted zone type/ })
      .click();
    await page.getByRole("option", { name: "Private" }).click();
    await expect(
      page.getByRole("link", { name: "internal.corp" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "acme-staging.io" })).toBeHidden();
  });

  test("page size preference persists after reload", async ({ page }) => {
    await page.getByRole("button", { name: "Preferences" }).click();
    await page.getByText("25 hosted zones").click();
    await page.getByRole("button", { name: "Confirm" }).click();
    // 24+ seeded zones: >11 checkboxes (select-all + rows) proves page size.
    await expect
      .poll(async () => page.getByRole("checkbox").count())
      .toBeGreaterThan(11);

    await page.reload();
    await expect
      .poll(async () => page.getByRole("checkbox").count())
      .toBeGreaterThan(11);
  });

  test("create a public hosted zone", async ({ page }) => {
    const name = uniqueZoneName("e2e-public");
    await createZoneViaUi(page, name);
    await expect(
      page.getByText(`${name} was successfully created.`),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name })).toBeVisible();
  });

  test("create a private hosted zone with a VPC", async ({ page }) => {
    const name = uniqueZoneName("e2e-private");
    await createZoneViaUi(page, name, { privateZone: true });
    await page.getByText("Hosted zone details", { exact: true }).click();
    await expect(page.getByText("Private hosted zone").first()).toBeVisible();
    await expect(page.getByText(/vpc-0a1b2c3d4e5f6a7b8/).first()).toBeVisible();
  });

  test("edit the zone description", async ({ page }) => {
    const name = uniqueZoneName("e2e-edit");
    const detailsUrl = await createZoneViaUi(page, name);
    await page.getByText("Hosted zone details", { exact: true }).click();
    await page.getByRole("button", { name: "Edit hosted zone" }).click();
    await page.waitForURL("**/edit");
    await page
      .getByLabel(/Description/)
      .fill("updated from the e2e suite");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForURL(detailsUrl);
    await expect(
      page.getByText(`Hosted zone ${name} was updated.`),
    ).toBeVisible();
  });

  test("deleting a non-empty zone shows the NS/SOA error", async ({ page }) => {
    await page
      .getByPlaceholder("Filter hosted zones by property or value")
      .fill("example.com");
    await expect(page.getByText(/\d+ matches/).first()).toBeVisible();
    await page.getByRole("checkbox", { name: "example.com" }).first().check();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Delete hosted zone?" }),
    ).toBeVisible();
    await page.getByPlaceholder("delete").fill("delete");
    await page
      .getByRole("button", { name: "Delete", exact: true })
      .last()
      .click();
    await expect(
      page.getByText(
        /You can't delete a hosted zone that contains records other than the default NS and SOA records/,
      ),
    ).toBeVisible();
  });

  test("type-delete modal deletes an empty zone and flashes", async ({
    page,
  }) => {
    const name = uniqueZoneName("e2e-delete");
    await createZoneViaUi(page, name);
    await page.getByRole("button", { name: "Delete zone" }).click();
    await page.getByPlaceholder("delete").fill("delete");
    await page
      .getByRole("button", { name: "Delete", exact: true })
      .last()
      .click();
    await page.waitForURL(`**${HOME}`);
    await expect(
      page.getByText(`Hosted zone ${name} was deleted.`),
    ).toBeVisible();
  });

  test("bulk delete shows mixed results for empty + non-empty zones", async ({
    page,
  }) => {
    const emptyName = uniqueZoneName("e2e-bulk-empty");
    const fullName = uniqueZoneName("e2e-bulk-full");
    await createZoneViaUi(page, emptyName);
    const fullUrl = await createZoneViaUi(page, fullName);
    const fullId = fullUrl.split("/").pop() ?? "";
    // Make the second zone non-empty through the real API.
    const created = await page.request.post(
      `/api/v1/hostedzones/${fullId}/records`,
      { data: { name: "www", type: "A", values: ["192.0.2.1"] } },
    );
    expect(created.status()).toBe(201);

    await page.goto(HOME);
    await page
      .getByPlaceholder("Filter hosted zones by property or value")
      .fill("e2e-bulk");
    await expect(page.getByRole("link", { name: emptyName })).toBeVisible();
    await page.getByRole("checkbox", { name: emptyName }).check();
    await page.getByRole("checkbox", { name: fullName }).check();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Delete hosted zones?" }),
    ).toBeVisible();
    await page.getByPlaceholder("delete").fill("delete");
    await page
      .getByRole("button", { name: "Delete", exact: true })
      .last()
      .click();

    // stacked flashbar collapses to the newest item — expand it first
    await expect(
      page.getByText("Some hosted zones couldn't be deleted"),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "View all notifications" })
      .click();
    await expect(page.getByText("1 hosted zones deleted.")).toBeVisible();
    await expect(page.getByText(new RegExp(`${fullName}:`))).toBeVisible();
  });
});
