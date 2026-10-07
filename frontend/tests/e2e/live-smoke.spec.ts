import {
  expect,
  request as playwrightRequest,
  test,
} from "@playwright/test";

import { HOME, createZoneViaUi, login } from "./helpers";

const STAMP = Date.now();
const ZONE_NAME = `live-smoke-${STAMP}.com`;
const BASE =
  process.env.E2E_BASE_URL?.replace(/\/+$/, "") ?? "http://localhost:3000";

// Guaranteed cleanup: a fresh API session for the same demo user removes any
// zone this spec created, even if the UI flow failed halfway through.
test.afterAll(async () => {
  const api = await playwrightRequest.newContext({ baseURL: BASE });
  try {
    const loginResponse = await api.post("/api/v1/auth/login", {
      data: { username: "demo", password: "route53demo" },
    });
    if (!loginResponse.ok()) return;
    const list = await api.get(
      `/api/v1/hostedzones?q=${ZONE_NAME}&page_size=100`,
    );
    if (!list.ok()) return;
    const { items } = (await list.json()) as { items: { id: string }[] };
    for (const zone of items) {
      const records = (await (
        await api.get(`/api/v1/hostedzones/${zone.id}/records?page_size=300`)
      ).json()) as { items: { id: string; protected: boolean }[] };
      const deletable = records.items
        .filter((record) => !record.protected)
        .map((record) => record.id);
      if (deletable.length > 0) {
        await api.post(`/api/v1/hostedzones/${zone.id}/records/batch-delete`, {
          data: { ids: deletable },
        });
      }
      await api.delete(`/api/v1/hostedzones/${zone.id}`);
    }
  } finally {
    await api.dispose();
  }
});

test("live smoke: full zone and record lifecycle", async ({ page }) => {
  test.setTimeout(120_000);

  // login → list loads
  await login(page);
  await expect(
    page.getByRole("heading", { name: /Hosted zones \(\d+\)/ }),
  ).toBeVisible();

  // create a uniquely named public zone
  const zoneUrl = await createZoneViaUi(page, ZONE_NAME);

  // create A + TXT in one atomic submit
  await page.getByRole("button", { name: "Create record" }).first().click();
  await page.waitForURL("**/records/create");
  await page.getByLabel("Record name").first().fill("www");
  await page.getByLabel("Value", { exact: true }).first().fill("192.0.2.1");
  await page.getByRole("button", { name: "Add another record" }).click();
  await page.getByLabel("Record name").nth(1).fill("note");
  await page.getByRole("button", { name: /Record type/ }).nth(1).click();
  await page.getByRole("option", { name: /TXT/ }).click();
  await page.getByLabel("Value", { exact: true }).nth(1).fill("live smoke");
  await page.getByRole("button", { name: "Create records" }).click();
  await page.waitForURL(zoneUrl);
  await expect(
    page.getByText("2 records were successfully created."),
  ).toBeVisible();

  // edit the A record's TTL
  await page.getByRole("button", { name: `www.${ZONE_NAME}` }).click();
  await page.getByRole("button", { name: "Edit record" }).click();
  await page.waitForURL("**/edit");
  await page.getByLabel("TTL in seconds").fill("600");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForURL(zoneUrl);
  await expect(
    page.getByText(`Record for www.${ZONE_NAME} was successfully updated.`),
  ).toBeVisible();

  // delete both records
  await page
    .getByRole("row", { name: /www\./ })
    .getByRole("checkbox")
    .check();
  await page
    .getByRole("row", { name: /note\./ })
    .getByRole("checkbox")
    .check();
  await page.getByRole("button", { name: "Delete record" }).first().click();
  await page
    .getByRole("button", { name: "Delete", exact: true })
    .last()
    .click();
  await expect(page.getByText("2 record(s) deleted.")).toBeVisible();

  // delete the zone (type-to-confirm)
  await page.getByRole("button", { name: "Delete zone" }).click();
  await page.getByPlaceholder("delete").fill("delete");
  await page
    .getByRole("button", { name: "Delete", exact: true })
    .last()
    .click();
  await page.waitForURL(`**${HOME}`);
  await expect(
    page.getByText(`Hosted zone ${ZONE_NAME} was deleted.`),
  ).toBeVisible();

  // logout
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.waitForURL("**/login");
});
