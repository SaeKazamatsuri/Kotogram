import { createRequire } from "node:module";
const require = createRequire(new URL("./.browser-tools/package.json", import.meta.url));
const { defineConfig } = require("@playwright/test");

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "test-artifacts/playwright-report" }]],
  use: {
    baseURL: process.env.BROWSER_SITE_BASE ?? "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium-desktop", use: { browserName: "chromium", viewport: { width: 1366, height: 768 } } },
    { name: "chromium-mobile", use: { browserName: "chromium", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
