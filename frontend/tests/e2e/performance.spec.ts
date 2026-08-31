import { expect, test, type Page } from "@playwright/test";

const THRESHOLDS = {
  averageFps: 45,
  p95FrameTime: 55,
  slowFramePercentage: 20,
  tabSwitchMs: 500,
  ttfbMs: 800,
  fcpMs: 1800,
} as const;

type FrameReport = {
  averageFps: number;
  p95FrameTime: number;
  slowFramePercentage: number;
  frames: number;
};

async function mockApplicationApi(page: Page) {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;

    // Vite serves application modules from paths such as
    // /src/api/workspace.ts. The broad route glob also matches those module
    // requests, so allow them through and mock only actual backend endpoints.
    if (!path.startsWith("/api/")) {
      await route.continue();
      return;
    }

    if (path === "/api/workspaces/login") {
      await route.fulfill({
        json: { username: "Performance Tester", workspace: "ws_performance", created: false },
      });
      return;
    }

    if (path === "/api/representatives/all") {
      await route.fulfill({
        json: [{
          representative_id: "R001", first_name: "Performance", last_name: "Tester",
          territory_id: "T001", joining_date: "2026-01-01", status: "Active",
        }],
      });
      return;
    }

    await route.fulfill({ json: { records: [], total: 0, limit: 50, offset: 0 } });
  });
}

async function login(page: Page) {
  await page.getByLabel("Enter your name").fill("Performance Tester");
  await page.getByRole("button", { name: "Open my workspace" }).click();
  await expect(page.getByText("Workspace owner")).toBeVisible();
}

async function measureFrames(page: Page, durationMs = 1800): Promise<FrameReport> {
  return page.evaluate(async (duration) => {
    const frameTimes: number[] = [];
    let previous = performance.now();
    const started = previous;

    await new Promise<void>((resolve) => {
      const sample = (time: number) => {
        if (time > previous) frameTimes.push(time - previous);
        previous = time;
        if (time - started >= duration) resolve();
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });

    const sorted = [...frameTimes].sort((left, right) => left - right);
    const averageFrameTime = frameTimes.reduce((sum, value) => sum + value, 0) / frameTimes.length;
    const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));

    return {
      averageFps: Number((1000 / averageFrameTime).toFixed(2)),
      p95FrameTime: Number(sorted[p95Index].toFixed(2)),
      slowFramePercentage: Number((frameTimes.filter((value) => value > 33.34).length / frameTimes.length * 100).toFixed(2)),
      frames: frameTimes.length,
    };
  }, durationMs);
}

test.beforeEach(async ({ page }) => mockApplicationApi(page));

test("development monitors and Web Vitals initialize", async ({ page }) => {
  await page.goto("/?perf=1");

  await expect.poll(() => page.evaluate(() => window.__PERFORMANCE_TOOLS__)).toMatchObject({
    webVitals: true, stats: true, reactScan: true,
  });
  await expect(page.locator('[data-performance-monitor="stats"]')).toBeVisible();

  await expect.poll(() => page.evaluate(() => window.__WEB_VITALS__?.TTFB?.value)).toBeGreaterThanOrEqual(0);
  const vitals = await page.evaluate(() => window.__WEB_VITALS__);
  expect(vitals?.TTFB?.value ?? Infinity).toBeLessThanOrEqual(THRESHOLDS.ttfbMs);
  if (vitals?.FCP) expect(vitals.FCP.value).toBeLessThanOrEqual(THRESHOLDS.fcpMs);
});

test("login animation sustains responsive frame delivery", async ({ page }) => {
  await page.goto("/");
  const report = await measureFrames(page);

  test.info().annotations.push({ type: "performance", description: JSON.stringify(report) });
  expect(report.frames).toBeGreaterThan(30);
  expect(report.averageFps).toBeGreaterThanOrEqual(THRESHOLDS.averageFps);
  expect(report.p95FrameTime).toBeLessThanOrEqual(THRESHOLDS.p95FrameTime);
  expect(report.slowFramePercentage).toBeLessThanOrEqual(THRESHOLDS.slowFramePercentage);
});

test("database tab responds quickly and remains smooth", async ({ page }) => {
  await page.goto("/");
  await login(page);

  const started = Date.now();
  await page.getByRole("button", { name: "Data control" }).click();
  await expect(page.locator(".database-page")).toBeVisible();
  await expect(page.locator(".database-table-container")).toBeVisible();
  await expect(page.locator(".database-table-container .error-message")).toHaveCount(0);
  const tabSwitchMs = Date.now() - started;
  const report = await measureFrames(page);

  test.info().annotations.push({
    type: "performance",
    description: JSON.stringify({ tabSwitchMs, ...report }),
  });
  expect(tabSwitchMs).toBeLessThanOrEqual(THRESHOLDS.tabSwitchMs);
  expect(report.averageFps).toBeGreaterThanOrEqual(THRESHOLDS.averageFps);
  expect(report.slowFramePercentage).toBeLessThanOrEqual(THRESHOLDS.slowFramePercentage);
});
