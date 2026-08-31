import { defineConfig, devices } from "@playwright/test";

const diagnosticsEnabled = process.env.PERF_DIAGNOSTICS === "1";

export default defineConfig({
  testDir: "./tests/e2e",
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
    baseURL: "http://127.0.0.1:5173",
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
    { name: "mobile-safari-iphone-13", use: { ...devices["iPhone 13"] } },
    { name: "mobile-safari-iphone-15", use: { ...devices["iPhone 15"] } },
  ],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
