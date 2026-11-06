import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import WashingMachineTimer from './WashingMachineTimer';

const MINUTE_MS = 60 * 1000;
const CYCLE_MS = 210 * MINUTE_MS;
const BLINK_MS = 500;
// A whole even number of blinks, so the first tick of the blink cycle is predictable.
const START = 1_000_000_000_000;

const setup = async (active = false) => {
  const parentClick = vi.fn();
  const screen = await render(
    <div onClick={parentClick}>
      <WashingMachineTimer active={active} />
    </div>,
  );
  const meter = screen.getByRole('meter');
  const shows = (text: string | RegExp) => expect.poll(() => meter.element().textContent).toMatch(text);
  const lit = (expected: boolean) => expect
    .poll(() => getComputedStyle(meter.element()).filter.includes('brightness'))
    .toBe(expected);
  return { meter, parentClick, shows, lit };
};

// Moves the clock without firing timers, as when a sleeping device or throttled tab wakes up.
const jumpTo = (elapsedMs: number) => {
  vi.setSystemTime(START + elapsedMs);
  vi.advanceTimersByTime(BLINK_MS);
};

beforeEach(() => {
  // setTimeout stays real because expect.poll needs it.
  vi.useFakeTimers({ now: START, toFake: ['Date', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
});

test('idle: shows a steady 0:00, unlit, with no timer running', async () => {
  const { shows, lit } = await setup();
  await shows(/^0:00$/);
  await lit(false);
  expect(vi.getTimerCount()).toBe(0);
});

test('a click starts a 3:30 countdown that stays lit on an idle screen', async () => {
  const { meter, shows, lit } = await setup();
  await meter.click();
  await shows(/^3.30$/);
  await lit(true);
});

test('the separator blinks while counting', async () => {
  const { meter, shows } = await setup();
  await meter.click();
  await shows(/^3 30$/);
  vi.advanceTimersByTime(BLINK_MS);
  await shows(/^3:30$/);
  vi.advanceTimersByTime(BLINK_MS);
  await shows(/^3 30$/);
});

test('rounds part-minutes up, so it only shows 0:00 once finished', async () => {
  const { meter, shows } = await setup();
  await meter.click();
  vi.advanceTimersByTime(30 * 1000);
  await shows(/^3.30$/);
  vi.advanceTimersByTime(30 * 1000);
  await shows(/^3.29$/);
  jumpTo(CYCLE_MS - 1000);
  await shows(/^0.01$/);
});

test('follows the wall clock, so missed ticks do not make it drift', async () => {
  const { meter, shows } = await setup();
  await meter.click();
  jumpTo(60 * MINUTE_MS);
  await shows(/^2.30$/);
});

test('each further click takes off 30 minutes', async () => {
  const { meter, shows } = await setup();
  await meter.click();
  await meter.click();
  await shows(/^3.00$/);
  await meter.click();
  await shows(/^2.30$/);
});

test('a click with under 30 minutes left cancels, and stops the timer', async () => {
  const { meter, shows, lit } = await setup();
  await meter.click();
  jumpTo(CYCLE_MS - 20 * MINUTE_MS);
  await shows(/^0.20$/);

  await meter.click();
  await shows(/^0:00$/);
  await lit(false);
  expect(vi.getTimerCount()).toBe(0);
});

test('when finished, the dial and value flash on an idle screen', async () => {
  const { meter, shows, lit } = await setup();
  await meter.click();

  jumpTo(CYCLE_MS);
  await shows(/^0:00$/);
  await lit(true);

  vi.advanceTimersByTime(BLINK_MS);
  await shows(/^$/);
  await lit(false);

  vi.advanceTimersByTime(BLINK_MS);
  await shows(/^0:00$/);
  await lit(true);
});

test('when finished on a lit screen, the value still flashes', async () => {
  const { meter, shows, lit } = await setup(true);
  await meter.click();

  jumpTo(CYCLE_MS);
  await shows(/^0:00$/);
  vi.advanceTimersByTime(BLINK_MS);
  await shows(/^$/);
  await lit(true);
});

test('keeps flashing until dismissed, however long it is left', async () => {
  const { meter, shows } = await setup();
  await meter.click();
  jumpTo(CYCLE_MS + 5 * 60 * MINUTE_MS);
  await shows(/^0:00$/);
  vi.advanceTimersByTime(BLINK_MS);
  await shows(/^$/);
});

test('a click dismisses the alert, and the next click starts a new cycle', async () => {
  const { meter, shows, lit } = await setup();
  await meter.click();
  jumpTo(CYCLE_MS);
  await shows(/^0:00$/);

  await meter.click();
  await lit(false);
  expect(vi.getTimerCount()).toBe(0);
  vi.advanceTimersByTime(BLINK_MS);
  await shows(/^0:00$/);

  await meter.click();
  await shows(/^3.30$/);
});

test('clicks do not reach the page, which would wake the whole screen', async () => {
  const { meter, parentClick } = await setup();
  await meter.click();
  expect(parentClick).not.toHaveBeenCalled();
});
