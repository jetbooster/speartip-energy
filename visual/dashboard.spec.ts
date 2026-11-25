import { expect, test, type Page } from '@playwright/test';
import type { ChargerStatus, ValuesResponse } from '../src/types/types';

// A fixed moment, so anything time-based renders the same on every run.
const NOW = new Date('2026-11-25T01:00:00Z');

const charger = (overrides: Partial<ChargerStatus> = {}): ChargerStatus => ({
  carConnected: false,
  carAwaitingAuthorization: false,
  isOnline: true,
  chargerOpMode: 1,
  outputCurrent: 0,
  dynamicChargerCurrent: 0,
  totalPower: 0,
  ...overrides,
});

const values = (overrides: Partial<ValuesResponse> = {}): ValuesResponse => ({
  solar: 2.4,
  usage: 0.85,
  grid: -1.2,
  batteryCharge: 64,
  batteryPower: 0.6,
  carChargeLevel: 52,
  carChargeLevelUpdatedAt: NOW.toISOString(),
  charger: charger(),
  ...overrides,
});

// Serves fixed values in place of the server and freezes the clock, so blinking and timers hold still.
const showDashboard = async (page: Page, response: ValuesResponse) => {
  await page.clock.install({ time: NOW });
  await page.clock.pauseAt(NOW.getTime() + 1);
  await page.route('/api/values', route => route.fulfill({ json: response }));
  await page.goto('/');
  await expect(page.getByTestId('ElectricCarIcon')).toBeVisible();
};

test('daytime with the car unplugged', async ({ page }) => {
  await showDashboard(page, values());
  await expect(page).toHaveScreenshot('unplugged.png');
});

test('car charging overnight', async ({ page }) => {
  await showDashboard(page, values({
    solar: 0,
    usage: 7.6,
    grid: 7.4,
    batteryCharge: 88,
    batteryPower: -0.2,
    carChargeLevel: 71,
    charger: charger({
      carConnected: true,
      chargerOpMode: 3,
      outputCurrent: 32,
      dynamicChargerCurrent: 32,
      totalPower: 7.2,
    }),
  }));
  await expect(page).toHaveScreenshot('charging.png');
});

test('car waiting for charging to be authorised', async ({ page }) => {
  await showDashboard(page, values({
    charger: charger({ carConnected: true, carAwaitingAuthorization: true, chargerOpMode: 7 }),
  }));
  await expect(page).toHaveScreenshot('awaiting-authorisation.png');
  // Half a blink later the charge level gives way to the prompt.
  await page.clock.runFor(500);
  await expect(page).toHaveScreenshot('awaiting-authorisation-prompt.png');
});

test('no reading from the charger', async ({ page }) => {
  await showDashboard(page, values({ charger: null, carChargeLevel: null }));
  await expect(page).toHaveScreenshot('no-charger-data.png');
});
