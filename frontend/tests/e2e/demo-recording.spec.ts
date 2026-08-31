import { expect, test } from "@playwright/test";

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test.use({
  video: "on",
  viewport: { width: 1440, height: 900 },
});

test.setTimeout(240_000);

test("record Incentive Auditor hackathon demo", async ({ page }) => {
  await page.goto("/");
  await pause(1800);

  await page.getByLabel("Enter your name").fill("Performance Tester");
  await pause(900);
  await page.getByRole("button", { name: "Open my workspace" }).click();

  await expect(page.locator("main.dashboard")).toBeVisible({ timeout: 60_000 });
  await pause(2200);

  const representativeSelect = page.locator("select.form-input");
  await expect(representativeSelect).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => representativeSelect.locator("option").count(), {
    timeout: 30_000,
  }).toBeGreaterThan(1);

  const representativeValue = await representativeSelect.locator("option").nth(1).getAttribute("value");
  if (representativeValue) {
    await representativeSelect.selectOption(representativeValue);
  }
  await pause(1500);

  await page.getByRole("button", { name: "Run Investigation" }).click();
  await pause(2500);

  // Keep the workflow visible long enough for viewers to see the agents progress.
  const workflow = page.locator("text=Starting investigation...").first();
  if (await workflow.isVisible().catch(() => false)) {
    await workflow.scrollIntoViewIfNeeded();
  }
  await pause(5000);

  await expect(page.getByText("Investigation completed.", { exact: true })).toBeVisible({
    timeout: 150_000,
  });
  await pause(2500);

  // Walk through the investigation output without racing animations/charts.
  const sections = [
    "Overall Risk",
    "Sales / Prescription",
    "Payout Analysis",
    "Peer",
  ];

  for (const label of sections) {
    const target = page.getByText(label, { exact: false }).first();
    if (await target.isVisible().catch(() => false)) {
      await target.scrollIntoViewIfNeeded();
      await pause(2200);
    }
  }

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await pause(1600);

  await page.getByRole("button", { name: "Data control" }).click();
  await expect(page.locator(".database-page")).toBeVisible({ timeout: 30_000 });
  await pause(2500);

  const databaseTable = page.locator(".database-table-container").first();
  if (await databaseTable.isVisible().catch(() => false)) {
    await databaseTable.scrollIntoViewIfNeeded();
  }
  await pause(3000);

  await page.getByRole("button", { name: "Analysis" }).click();
  await expect(page.locator("main.dashboard")).toBeVisible();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await pause(2500);
});
