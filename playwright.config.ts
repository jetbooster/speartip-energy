import { defineConfig, devices } from '@playwright/test';

// Visual regression tests: the whole app on an emulated Pixel 7 in landscape, compared against committed screenshots.
// Unit and component tests use vitest (see vitest.config.ts).
export default defineConfig({
  testDir: './visual',
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:9000',
  },
  expect: {
    toHaveScreenshot: {
      // Any changed pixel fails: a dim status label can be under 100 pixels. Per-pixel colour
      // tolerance (threshold) stays at its default to absorb anti-aliasing.
      maxDiffPixels: 0,
    },
  },
  projects: [
    {
      name: 'pixel-7-landscape',
      use: { ...devices['Pixel 7 landscape'] },
    },
  ],
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:9000',
    reuseExistingServer: !process.env.CI,
  },
});
