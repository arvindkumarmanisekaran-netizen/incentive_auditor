import { expect, test, type Page, type TestInfo } from "@playwright/test";

const USE_REAL_BACKEND = process.env.PERF_USE_BACKEND === "1";
const BACKEND_URL = process.env.PERF_BACKEND_URL ?? "http://127.0.0.1:8000";

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
  await expect(page.locator("main.dashboard")).toBeVisible({ timeout: 15_000 });
}

async function applyProjectThrottling(page: Page, browserName: string, testInfo: TestInfo) {
  const cpuThrottlingRate = Number(testInfo.project.metadata.cpuThrottlingRate ?? 1);
  const networkLatencyMs = Number(testInfo.project.metadata.networkLatencyMs ?? 0);

  if (browserName !== "chromium" || (cpuThrottlingRate <= 1 && networkLatencyMs <= 0)) return;

  const cdp = await page.context().newCDPSession(page);

  if (cpuThrottlingRate > 1) {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpuThrottlingRate });
  }

  if (networkLatencyMs > 0) {
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: networkLatencyMs,
      downloadThroughput: 4 * 1024 * 1024 / 8,
      uploadThroughput: 1.5 * 1024 * 1024 / 8,
      connectionType: "cellular4g",
    });
  }
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

test.beforeAll(async ({ request }) => {
  if (!USE_REAL_BACKEND) return;

  const response = await request.get(`${BACKEND_URL}/`);
  expect(response.ok(), `Backend is not available at ${BACKEND_URL}`).toBe(true);
});

test.beforeEach(async ({ page }) => {
  if (!USE_REAL_BACKEND) await mockApplicationApi(page);
});

test("development monitors and Web Vitals initialize", async ({ page, browserName }, testInfo) => {
  await page.goto("/?perf=1");
  await applyProjectThrottling(page, browserName, testInfo);

  await expect.poll(() => page.evaluate(() => window.__PERFORMANCE_TOOLS__)).toMatchObject({
    webVitals: true, stats: true, reactScan: true,
  });
  await expect(page.locator('[data-performance-monitor="stats"]')).toBeVisible();

  await expect.poll(() => page.evaluate(() => window.__WEB_VITALS__?.TTFB?.value)).toBeGreaterThanOrEqual(0);
  const vitals = await page.evaluate(() => window.__WEB_VITALS__);
  expect(vitals?.TTFB?.value ?? Infinity).toBeLessThanOrEqual(THRESHOLDS.ttfbMs);
  if (vitals?.FCP) expect(vitals.FCP.value).toBeLessThanOrEqual(THRESHOLDS.fcpMs);
});

test("login animation sustains responsive frame delivery", async ({ page, browserName }, testInfo) => {
  await page.goto("/");
  await applyProjectThrottling(page, browserName, testInfo);
  const report = await measureFrames(page);

  test.info().annotations.push({ type: "performance", description: JSON.stringify(report) });
  expect(report.frames).toBeGreaterThan(30);
  expect(report.averageFps).toBeGreaterThanOrEqual(THRESHOLDS.averageFps);
  expect(report.p95FrameTime).toBeLessThanOrEqual(THRESHOLDS.p95FrameTime);
  expect(report.slowFramePercentage).toBeLessThanOrEqual(THRESHOLDS.slowFramePercentage);
});

test("database tab responds quickly and remains smooth", async ({ page, browserName }, testInfo) => {
  await page.goto("/");
  await applyProjectThrottling(page, browserName, testInfo);
  await login(page);

  const started = Date.now();
  await page.getByRole("button", { name: "Data control" }).click();
  await expect(page.locator(".database-page")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".database-table-container")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".database-table-container")).not.toHaveClass(/is-loading/, { timeout: 15_000 });
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
