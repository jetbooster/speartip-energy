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
  energySources: { cheapGrid: 9.15, solar: 0.5, expensiveGrid: 0.95 },
  weather: { temperature: 5.3, cloudCover: 100, condition: 'cloudy' },
  heating: { indoorTemperature: 17.8, gasHeating: true, acUnitsHeating: 0 },
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

test('scrolled down to the weather and heating row', async ({ page }) => {
  await showDashboard(page, values());
  await page.mouse.move(400, 200);
  await page.mouse.wheel(0, 2000);
  await expect(page.getByTestId('LocalFireDepartmentIcon')).toBeInViewport();
  await expect(page).toHaveScreenshot('lower-row.png');
});

test('heating with the ACs on a sunny day', async ({ page }) => {
  await showDashboard(page, values({
    weather: { temperature: 11.6, cloudCover: 20, condition: 'sunny' },
    heating: { indoorTemperature: 19.2, gasHeating: false, acUnitsHeating: 3 },
    energySources: { cheapGrid: 3.2, solar: 6.8, expensiveGrid: 1.4 },
  }));
  await page.mouse.move(400, 200);
  await page.mouse.wheel(0, 2000);
  await expect(page.getByTestId('HeatPumpIcon')).toBeInViewport();
  await expect(page).toHaveScreenshot('lower-row-ac-heating.png');
});

test('scrolls back to the top once the display goes idle', async ({ page }) => {
  await showDashboard(page, values());
  await page.mouse.move(400, 200);
  await page.mouse.wheel(0, 2000);
  await expect(page.getByTestId('LocalFireDepartmentIcon')).toBeInViewport();
  // The display stays active for 3 minutes after the last swipe or tap.
  await page.clock.runFor(3 * 60 * 1000 + 1000);
  await expect(page.getByTestId('SolarPowerIcon')).toBeInViewport();
  await expect(page.getByTestId('LocalFireDepartmentIcon')).not.toBeInViewport();
});

// A real touch swipe, starting on a dial. The mouse wheel ignores touch-action, so it can't catch a dial
// that swallows swipes, which is what x-charts' gauges do unless gaugeFrame overrides it.
test('swiping up on a dial scrolls to the lower row', async ({ page }) => {
  await showDashboard(page, values());
  const dial = (await page.getByTestId('SolarPowerIcon').boundingBox())!;
  const x = Math.round(dial.x + dial.width / 2);
  const from = Math.round(dial.y + dial.height / 2) + 100;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: from }] });
  for (let step = 1; step <= 10; step++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: from - step * 25 }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.getByTestId('LocalFireDepartmentIcon')).toBeInViewport();
});
