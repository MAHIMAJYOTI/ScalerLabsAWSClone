import { expect, test, type Page } from "@playwright/test";

import { HOME, createZoneViaUi, login } from "./helpers";

test.describe.configure({ mode: "serial" });

const STAMP = Date.now();
const AAA_NAME = `aaa-e2e-${STAMP}.com`;
const ZZZ_NAME = `zzz-e2e-${STAMP}.com`;
const FILTER_PLACEHOLDER = "Filter hosted zones by property or value";

let zzzId = "";

async function readZonesCounter(page: Page): Promise<number> {
  const heading = page.getByRole("heading", { name: /Hosted zones \(\d+\)/ });
  await expect(heading).toBeVisible();
  const text = (await heading.textContent()) ?? "";
  return Number(/\((\d+)\)/.exec(text)?.[1] ?? "-1");
}

async function assertListFresh(page: Page, expectedTotal: number) {
  // (a) the counter reflects the new zones
  expect(await readZonesCounter(page)).toBe(expectedTotal);
  // (b) filtering by the exact name finds the new zone
  await page.getByPlaceholder(FILTER_PLACEHOLDER).fill(ZZZ_NAME);
  await expect(page.getByRole("link", { name: ZZZ_NAME })).toBeVisible();
  await page.getByPlaceholder(FILTER_PLACEHOLDER).fill("");
  // (c) the aaa- zone is on page 1 with the default name sort
  await expect(page.getByRole("link", { name: AAA_NAME })).toBeVisible();
  // (d) the zzz- zone is on the last page
  const lastPage = Math.ceil(expectedTotal / 10);
  await page
    .getByRole("button", { name: `Page ${lastPage} of all pages` })
    .click();
  await expect(page.getByRole("link", { name: ZZZ_NAME })).toBeVisible();
  // back to page 1 for the next return-path round
  await page.getByRole("button", { name: "Page 1 of all pages" }).click();
}

test.describe("freshness", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("1. new zones appear via all four return paths", async ({ page }) => {
    const initialTotal = await readZonesCounter(page);
    await createZoneViaUi(page, AAA_NAME);
    const zzzUrl = await createZoneViaUi(page, ZZZ_NAME);
    zzzId = zzzUrl.split("/").pop() ?? "";
    const expectedTotal = initialTotal + 2;
    const detailsUrl = page.url();

    // 1. breadcrumb "Hosted zones"
    await page.getByRole("link", { name: "Hosted zones" }).first().click();
    await page.waitForURL(`**${HOME}`);
    await assertListFresh(page, expectedTotal);

    // 2. side nav "Hosted zones"
    await page.goto(detailsUrl);
    await page.getByRole("link", { name: "Hosted zones" }).last().click();
    await page.waitForURL(`**${HOME}`);
    await assertListFresh(page, expectedTotal);

    // 3. browser back (list -> details -> back)
    await page.getByPlaceholder(FILTER_PLACEHOLDER).fill(ZZZ_NAME);
    await page.getByRole("link", { name: ZZZ_NAME }).click();
    await page.waitForURL(/hostedzones\/Z/);
    await page.goBack();
    await page.waitForURL(`**${HOME}`);
    await page.getByPlaceholder(FILTER_PLACEHOLDER).fill("");
    await assertListFresh(page, expectedTotal);

    // 4. full page reload
    await page.reload();
    await assertListFresh(page, expectedTotal);
  });

  test("2. edited description shows in the list without a reload", async ({
    page,
  }) => {
    await page.getByPlaceholder(FILTER_PLACEHOLDER).fill(AAA_NAME);
    await page.getByRole("link", { name: AAA_NAME }).click();
    await page.waitForURL(/hostedzones\/Z/);
    await page.getByText("Hosted zone details", { exact: true }).click();
    await page.getByRole("button", { name: "Edit hosted zone" }).click();
    await page.waitForURL("**/edit");
    const description = `fresh-desc-${STAMP}`;
    await page.getByLabel(/Description/).fill(description);
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForURL(/hostedzones\/Z[A-Z0-9]+$/);

    // client-side navigation back to the list — no reload
    await page.getByRole("link", { name: "Hosted zones" }).last().click();
    await page.waitForURL(`**${HOME}`);
    await page.getByPlaceholder(FILTER_PLACEHOLDER).fill(AAA_NAME);
    await expect(page.getByText(description)).toBeVisible();
  });

  test("3. single + bulk delete update the list; old URL shows not-found", async ({
    page,
  }) => {
    const initialTotal = await readZonesCounter(page);

    // single delete of the aaa zone
    await page.getByPlaceholder(FILTER_PLACEHOLDER).fill(AAA_NAME);
    await page.getByRole("checkbox", { name: AAA_NAME }).check();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByPlaceholder("delete").fill("delete");
    await page
      .getByRole("button", { name: "Delete", exact: true })
      .last()
      .click();
    await expect(
      page.getByText(`Hosted zone ${AAA_NAME} was deleted.`),
    ).toBeVisible();
    await page.getByPlaceholder(FILTER_PLACEHOLDER).fill("");
    await expect.poll(() => readZonesCounter(page)).toBe(initialTotal - 1);

    // bulk delete: zzz + one more created through the real API
    const extra = `zzx-e2e-${STAMP}.com`;
    const created = await page.request.post("/api/v1/hostedzones", {
      data: { name: extra },
    });
    expect(created.status()).toBe(201);
    await page.getByPlaceholder(FILTER_PLACEHOLDER).fill(`e2e-${STAMP}`);
    await page.getByRole("checkbox", { name: ZZZ_NAME }).check();
    await page.getByRole("checkbox", { name: extra }).check();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Delete hosted zones?" }),
    ).toBeVisible();
    await page.getByPlaceholder("delete").fill("delete");
    await page
      .getByRole("button", { name: "Delete", exact: true })
      .last()
      .click();
    await expect(page.getByText("2 hosted zones deleted.")).toBeVisible();
    await page.getByPlaceholder(FILTER_PLACEHOLDER).fill("");
    await expect.poll(() => readZonesCounter(page)).toBe(initialTotal - 2);

    // visiting the deleted zone's URL shows the not-found state, not a crash
    await page.goto(`${HOME}/${zzzId}`);
    await expect(
      page.getByRole("heading", { name: "Hosted zone not found" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Back to hosted zones" }).click();
    await page.waitForURL(`**${HOME}`);
  });

  test("4. record create/delete updates all three count surfaces", async ({
    page,
  }) => {
    const zoneName = `cnt-e2e-${STAMP}.com`;
    await createZoneViaUi(page, zoneName);
    await expect(page.getByRole("tab", { name: "Records (2)" })).toBeVisible();

    // create 2 records in one atomic submit
    await page.getByRole("button", { name: "Create record" }).first().click();
    await page.waitForURL("**/records/create");
    await page.getByLabel("Record name").first().fill("www");
    await page.getByLabel("Value", { exact: true }).first().fill("192.0.2.1");
    await page.getByRole("button", { name: "Add another record" }).click();
    await page.getByLabel("Record name").nth(1).fill("mail");
    await page.getByLabel("Value", { exact: true }).nth(1).fill("192.0.2.2");
    await page.getByRole("button", { name: "Create records" }).click();
    await page.waitForURL(/hostedzones\/Z[A-Z0-9]+$/);

    // details tab label + records header counter, without a reload
    await expect(page.getByRole("tab", { name: "Records (4)" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Records (4)" }),
    ).toBeVisible();

    // zones list Record count column
    await page.getByRole("link", { name: "Hosted zones" }).last().click();
    await page.waitForURL(`**${HOME}`);
    await page.getByPlaceholder(FILTER_PLACEHOLDER).fill(zoneName);
    await expect(
      page
        .getByRole("row", { name: new RegExp(zoneName) })
        .getByRole("cell", { name: "4", exact: true }),
    ).toBeVisible();

    // delete one record → every surface shows 3
    await page.getByRole("link", { name: zoneName }).click();
    await page.waitForURL(/hostedzones\/Z/);
    await page
      .getByRole("row", { name: /www\./ })
      .getByRole("checkbox")
      .check();
    await page.getByRole("button", { name: "Delete record" }).first().click();
    await page
      .getByRole("button", { name: "Delete", exact: true })
      .last()
      .click();
    await expect(page.getByText("1 record(s) deleted.")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Records (3)" })).toBeVisible();
    await page.getByRole("link", { name: "Hosted zones" }).last().click();
    await page.getByPlaceholder(FILTER_PLACEHOLDER).fill(zoneName);
    await expect(
      page
        .getByRole("row", { name: new RegExp(zoneName) })
        .getByRole("cell", { name: "3", exact: true }),
    ).toBeVisible();
  });

  test("5. import updates every count surface", async ({ page }) => {
    const zoneName = `cnt-e2e-${STAMP}.com`;
    await page.getByPlaceholder(FILTER_PLACEHOLDER).fill(zoneName);
    await page.getByRole("link", { name: zoneName }).click();
    await page.waitForURL(/hostedzones\/Z/);
    await expect(page.getByRole("tab", { name: "Records (3)" })).toBeVisible();

    await page.getByRole("button", { name: "Import zone file" }).click();
    await page.waitForURL("**/import");
    await page.getByText("Load sample").click();
    await page.getByRole("button", { name: "Import", exact: true }).click();
    await page.waitForURL(/hostedzones\/Z[A-Z0-9]+$/);
    await expect(page.getByText(/Imported 7 records\. Skipped 0\./)).toBeVisible();
    await expect(page.getByRole("tab", { name: "Records (10)" })).toBeVisible();

    await page.getByRole("link", { name: "Hosted zones" }).last().click();
    await page.getByPlaceholder(FILTER_PLACEHOLDER).fill(zoneName);
    await expect(
      page
        .getByRole("row", { name: new RegExp(zoneName) })
        .getByRole("cell", { name: "10", exact: true }),
    ).toBeVisible();
  });

  test("6. page index clamps when deletes shrink the page count", async ({
    page,
  }) => {
    const prefix = `clamp-${STAMP}`;
    for (let i = 0; i < 11; i += 1) {
      const response = await page.request.post("/api/v1/hostedzones", {
        data: { name: `${prefix}-${String(i).padStart(2, "0")}.com` },
      });
      expect(response.status()).toBe(201);
    }
    await page.goto(HOME);
    await page.waitForLoadState("networkidle");
    await page.getByPlaceholder(FILTER_PLACEHOLDER).fill(prefix);
    await expect(page.getByText("11 matches").first()).toBeVisible();
    await page.getByRole("button", { name: "Page 2 of all pages" }).click();
    await expect(
      page.getByRole("link", { name: `${prefix}-10.com` }),
    ).toBeVisible();

    // delete the only row on page 2 → the table clamps back to page 1
    await page.getByRole("checkbox", { name: `${prefix}-10.com` }).check();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByPlaceholder("delete").fill("delete");
    await page
      .getByRole("button", { name: "Delete", exact: true })
      .last()
      .click();
    await expect(
      page.getByRole("link", { name: `${prefix}-00.com` }),
    ).toBeVisible();
    await expect(page.getByText("No matches")).toBeHidden();
  });

  test("7. second user sees their own identity and no demo zones", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Username").fill("demo2");
    await page.getByLabel("Password").fill("route53demo2");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(`**${HOME}`);

    const accountMenu = page.getByRole("button", { name: "Account menu" });
    await expect(accountMenu).toContainText("demo2-user @ 2109-8765-4321");

    expect(await readZonesCounter(page)).toBe(0);
    await expect(page.getByText("No hosted zones")).toBeVisible();
    await page.getByPlaceholder(FILTER_PLACEHOLDER).fill("example.com");
    await expect(page.getByText("No matches")).toBeVisible();
  });

  test("8. zones persist across a backend restart", async ({ page }) => {
    // Restarting uvicorn from inside the test wedges Playwright's exit (the
    // Next proxy stalls on the dead upstream during teardown), so the restart
    // is performed EXTERNALLY between two runs:
    //   1. full suite (this phase creates the zone and logs its name)
    //   2. restart the backend process from a shell
    //   3. PERSIST_CHECK_NAME=<name> npx playwright test freshness -g "persist"
    const checkName = process.env.PERSIST_CHECK_NAME;
    if (checkName) {
      // Phase B — the backend was restarted before this run.
      await page.goto(HOME);
      await page.waitForLoadState("networkidle");
      await page.getByPlaceholder(FILTER_PLACEHOLDER).fill(checkName);
      await expect(page.getByRole("link", { name: checkName })).toBeVisible();
      return;
    }
    // Phase A — create the zone that must survive the restart.
    const zoneName = `persist-e2e-${STAMP}.com`;
    await createZoneViaUi(page, zoneName);
    console.log(`PERSIST_ZONE=${zoneName}`);
    await page.getByRole("link", { name: "Hosted zones" }).last().click();
    await page.waitForURL(`**${HOME}`);
    await page.getByPlaceholder(FILTER_PLACEHOLDER).fill(zoneName);
    await expect(page.getByRole("link", { name: zoneName })).toBeVisible();
  });
});
