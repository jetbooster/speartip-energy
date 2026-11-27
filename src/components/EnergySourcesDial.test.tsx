import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import EnergySourcesDial from './EnergySourcesDial';
import { formatTotal, segmentAngles } from './energySegments';

const START = -Math.PI * 2 / 3;
const END = Math.PI * 2 / 3;
const CAP = 0.1;

test('segments run left to right in proportion, with each end inset for its rounding', () => {
  const segments = segmentAngles({ cheapGrid: 2, solar: 1, expensiveGrid: 1 }, START, END, CAP);
  expect(segments.map(s => s.source)).toEqual(['cheapGrid', 'solar', 'expensiveGrid']);
  expect(segments[0].start).toBeCloseTo(START + CAP);
  expect(segments[2].end).toBeCloseTo(END - CAP);
  // Cheap is twice solar, so its share of the arc (before insets) is twice as long.
  const share = (s: { start: number; end: number }) => s.end - s.start + 2 * CAP;
  expect(share(segments[0])).toBeCloseTo(2 * share(segments[1]));
  expect(segments[1].start).toBeGreaterThan(segments[0].end);
});

test('leaves out a source with nothing from it', () => {
  const segments = segmentAngles({ cheapGrid: 3, solar: 0, expensiveGrid: 1 }, START, END, CAP);
  expect(segments.map(s => s.source)).toEqual(['cheapGrid', 'expensiveGrid']);
});

test('shows a sliver too short for its rounded ends as a dot', () => {
  const [, tiny] = segmentAngles({ cheapGrid: 100, solar: 0.1, expensiveGrid: 100 }, START, END, CAP);
  expect(tiny.start).toBeCloseTo(tiny.end);
});

test('draws nothing before anything is used', () => {
  expect(segmentAngles({ cheapGrid: 0, solar: 0, expensiveGrid: 0 }, START, END, CAP)).toEqual([]);
});

test.each([
  [{ cheapGrid: 9.15, solar: 0.5, expensiveGrid: 0.95 }, '11 kWh'],
  [{ cheapGrid: 2, solar: 0.4, expensiveGrid: 0 }, '2.4 kWh'],
])('total %o -> %s', (sources, expected) => {
  expect(formatTotal(sources)).toBe(expected);
});

test('renders a segment per source and the total', async () => {
  const screen = await render(
    <EnergySourcesDial sources={{ cheapGrid: 4, solar: 3, expensiveGrid: 1 }} active={false} />,
  );
  await expect.element(screen.getByText('8.0 kWh')).toBeVisible();
  const drawn = [...screen.container.querySelectorAll('path[data-source]')].map(p => p.getAttribute('data-source'));
  expect(drawn).toEqual(['cheapGrid', 'solar', 'expensiveGrid']);
});

test('shows a dash without data', async () => {
  const screen = await render(<EnergySourcesDial sources={null} active={false} />);
  await expect.element(screen.getByText('—')).toBeVisible();
});
