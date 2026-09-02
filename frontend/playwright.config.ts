import { defineConfig, devices } from "@playwright/test";

const diagnosticsEnabled = process.env.PERF_DIAGNOSTICS === "1";
const demoRecordingEnabled = process.env.DEMO_RECORDING === "1";
const frontendPort = demoRecordingEnabled ? 5174 : 5173;
const frontendBaseUrl = `http://127.0.0.1:${frontendPort}`;

const androidUserAgent = (model: string) =>
  `Mozilla/5.0 (Linux; Android 14; ${model}) AppleWebKit/537.36 `
  + `(KHTML, like Gecko) Chrome/151.0.7922.34 Mobile Safari/537.36`;

const xiaomiProjects = [
  { name: "mobile-xiaomi-14", model: "Xiaomi 14", viewport: { width: 393, height: 852 }, scale: 3, cpu: 1.5, latency: 35, tabBudget: 500 },
  { name: "mobile-mi-11-lite", model: "M2101K9AG", viewport: { width: 393, height: 873 }, scale: 2.75, cpu: 2.5, latency: 55, tabBudget: 500 },
  { name: "mobile-redmi-note-13", model: "23129RA5FL", viewport: { width: 393, height: 873 }, scale: 2.75, cpu: 3, latency: 65, tabBudget: 500 },
  { name: "mobile-poco-m6-pro", model: "2312FPCA6G", viewport: { width: 393, height: 873 }, scale: 2.75, cpu: 3.5, latency: 75, tabBudget: 700 },
  { name: "mobile-redmi-13c", model: "23106RN0DA", viewport: { width: 360, height: 800 }, scale: 2, cpu: 4.5, latency: 95, tabBudget: 650 },
  { name: "mobile-redmi-a3", model: "23129RN51X", viewport: { width: 360, height: 800 }, scale: 2, cpu: 6, latency: 120, tabBudget: 1100 },
].map(({ name, model, viewport, scale, cpu, latency, tabBudget }) => ({
  name,
  metadata: { cpuThrottlingRate: cpu, networkLatencyMs: latency, tabSwitchBudgetMs: tabBudget },
  use: {
    userAgent: androidUserAgent(model),
    viewport,
    screen: viewport,
    deviceScaleFactor: scale,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: "chromium" as const,
  },
}));

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["json", { outputFile: "test-results/performance-results.json" }],
  ],
  use: {
    baseURL: frontendBaseUrl,
    // Trace screenshots and video encoding consume animation frames. Keep the
    // benchmark clean by default and enable recording only for diagnosis.
    trace: diagnosticsEnabled ? "retain-on-failure" : "off",
    screenshot: "only-on-failure",
    video: diagnosticsEnabled ? "retain-on-failure" : "off",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chrome-pixel-7", use: { ...devices["Pixel 7"] } },
    { name: "mobile-chrome-galaxy-s24", use: { ...devices["Galaxy S24"] } },
    { name: "mobile-chrome-galaxy-a55", use: { ...devices["Galaxy A55"] } },
    { name: "mobile-safari-iphone-13", metadata: { tabSwitchBudgetMs: 750 }, use: { ...devices["iPhone 13"] } },
    { name: "mobile-safari-iphone-15", metadata: { tabSwitchBudgetMs: 750 }, use: { ...devices["iPhone 15"] } },
    ...xiaomiProjects,
  ],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${frontendPort} --strictPort`,
    url: frontendBaseUrl,
    reuseExistingServer: demoRecordingEnabled ? false : !process.env.CI,
    timeout: 120_000,
  },
});
