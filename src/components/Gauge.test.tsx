import { gaugeClasses } from '@mui/x-charts/Gauge';
import type { ComponentProps } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import Gauge from './Gauge';

type GaugeProps = ComponentProps<typeof Gauge>;

const renderGauge = (props: Partial<GaugeProps>) => render(
  <Gauge val={0} max={100} icon={<span />} {...props} />,
);

const percentShown = (element: Element) => Number(element.getAttribute('aria-valuenow'));

const POWER = { normal: 'kW', milli: 'W' };
// Longer than the 1 second animation, which is also expect.poll's default timeout.
const SETTLED = { timeout: 3000 };

test('smoke: renders a gauge with real layout in a real browser', async () => {
  const screen = await renderGauge({ val: 42, units: { normal: '%', noSpace: true } });
  const value = screen.getByText('42%');

  await expect.element(value).toBeVisible();
  expect(navigator.userAgent).toContain('Chrome');
  // jsdom has no layout engine and always reports 0 here, so this only passes in a real browser.
  expect(value.element().getBoundingClientRect().width).toBeGreaterThan(0);
});

test.each<[string, Partial<GaugeProps>, string]>([
  ['switches to watts below 1 kW', { val: 0.29, units: POWER }, '290 W'],
  ['shows zero in watts', { val: 0, units: POWER }, '0 W'],
  ['shows exports as negative watts', { val: -0.29, units: POWER }, '-290 W'],
  ['stays in kW from 1 kW', { val: 1, units: POWER }, '1 kW'],
  ['shows negative kW', { val: -3.7, units: POWER }, '-3.7 kW'],
  ['leaves out the space when asked', { val: 42, units: { normal: '%', noSpace: true } }, '42%'],
  ['converts minutes to hours and minutes', { val: 65, units: { normal: ':', convertMinsToHrMins: true } }, '1:05'],
  ['uses the blink separator', { val: 210, units: { normal: ' ', convertMinsToHrMins: true } }, '3 30'],
  ['hides the time in the alert blink', { val: 0, units: { normal: ':', kilo: '.', convertMinsToHrMins: true } }, ''],
  ['lets text replace the value', { val: 42, units: POWER, text: '—' }, '—'],
  ['lets empty text blank the value', { val: 42, units: POWER, text: '' }, ''],
])('%s', async (_name, props, expected) => {
  const screen = await renderGauge(props);
  expect(screen.getByRole('meter').element().textContent).toBe(expected);
});

test('exponential scaling makes small values easier to see', async () => {
  const screen = await renderGauge({ val: 1, max: 10, exponential: true });
  // (1 / 10) ^ 0.3 is about 50%, where a linear gauge would show 10%.
  expect(percentShown(screen.getByRole('meter').element())).toBeCloseTo(50.12, 1);
});

// Deliberate: the grid dial reads negative while exporting. Math.pow makes that NaN, which the chart
// draws as an empty dial, so at a glance exporting can't be mistaken for importing. The text still shows it.
test('exponential gauge stays empty for a negative value, while still showing it as text', async () => {
  const screen = await renderGauge({ val: -0.5, max: 10, exponential: true, units: POWER });
  const meter = screen.getByRole('meter').element();
  const arc = meter.querySelector<SVGGraphicsElement>(`.${gaugeClasses.valueArc} path, path.${gaugeClasses.valueArc}`);

  expect(arc?.getBBox().width ?? 0).toBe(0);
  expect(meter.textContent).toBe('-500 W');
});

test('animates to a new value instead of jumping', async () => {
  const screen = await renderGauge({ val: 0 });
  const meter = screen.getByRole('meter').element();
  expect(percentShown(meter)).toBe(0);

  await screen.rerender(<Gauge val={100} max={100} icon={<span />} />);
  await expect.poll(() => percentShown(meter), { interval: 10 }).toBeGreaterThan(0);
  expect(percentShown(meter)).toBeLessThan(100);
  await expect.poll(() => percentShown(meter), SETTLED).toBe(100);
});

test('a new value mid-animation carries on from where the dial is', async () => {
  const screen = await renderGauge({ val: 0 });
  const meter = screen.getByRole('meter').element();

  await screen.rerender(<Gauge val={100} max={100} icon={<span />} />);
  await expect.poll(() => percentShown(meter), { interval: 10 }).toBeGreaterThan(5);

  const position = percentShown(meter);
  const seen: number[] = [];
  let sampling = true;
  const sample = () => {
    seen.push(percentShown(meter));
    if (sampling) {
      requestAnimationFrame(sample);
    }
  };
  await screen.rerender(<Gauge val={0} max={100} icon={<span />} />);
  sample();
  await expect.poll(() => percentShown(meter), SETTLED).toBe(0);
  sampling = false;

  // Falls from its current position, rather than jumping, finishing the old animation or restarting.
  expect(seen.some(value => value > 0 && value < position)).toBe(true);
  expect(Math.max(...seen)).toBeLessThan(100);
  expect(seen.every((value, i) => i === 0 || value <= (seen[i - 1] as number))).toBe(true);
});

test('active brightens the dial', async () => {
  const screen = await renderGauge({ active: true });
  expect(getComputedStyle(screen.getByRole('meter').element()).filter).toContain('brightness');
});
