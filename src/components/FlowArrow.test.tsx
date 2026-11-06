import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import FlowArrow from './FlowArrow';
import type { FlowAxis } from './FlowArrow';

const GREEN = '#2ecc40';
const RED = '#ff4136';

const renderArrow = (axis: FlowAxis, kw: number, inverted = false) => render(
  <FlowArrow axis={axis} kw={kw} inverted={inverted} left="0" top="0" />,
);

const parsePoint = (point: string | undefined) => (point as string).split(',').map(Number) as [number, number];

const chevrons = (container: Element) => [...container.querySelectorAll('polyline')].map((line) => {
  const [armA, tip, armB] = (line.getAttribute('points') as string).split(' ').map(parsePoint) as [
    [number, number], [number, number], [number, number],
  ];
  return { line, tip, back: [(armA[0] + armB[0]) / 2, (armA[1] + armB[1]) / 2] as const };
});

// SVG y grows downwards, so "up" is negative.
const DIRECTIONS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] } as const;

test.each([
  ['vertical', 2, false, 'up', GREEN],
  ['vertical', -2, false, 'down', RED],
  ['vertical', 2, true, 'down', RED],
  ['vertical', -2, true, 'up', GREEN],
  ['horizontal', 2, false, 'right', GREEN],
  ['horizontal', -2, false, 'left', RED],
  ['horizontal', 2, true, 'left', RED],
] as const)('%s axis, %p kW, inverted=%p points %s', async (axis, kw, inverted, direction, colour) => {
  const screen = await renderArrow(axis, kw, inverted);
  const [dx, dy] = DIRECTIONS[direction];
  const drawn = chevrons(screen.container);

  expect(drawn).toHaveLength(3);
  for (const { line, tip, back } of drawn) {
    // Each chevron's tip points the way the flow is going...
    expect(Math.sign(tip[0] - back[0])).toBe(dx);
    expect(Math.sign(tip[1] - back[1])).toBe(dy);
    expect(line.getAttribute('stroke')).toBe(colour);
  }
  // ...and each one that lights up later sits further along, so the animation travels that way.
  for (const [earlier, later] of [[0, 1], [1, 2]] as const) {
    const a = drawn[earlier];
    const b = drawn[later];
    expect(((b?.tip[0] ?? 0) - (a?.tip[0] ?? 0)) * dx + ((b?.tip[1] ?? 0) - (a?.tip[1] ?? 0)) * dy).toBeGreaterThan(0);
  }
  expect(drawn.map(({ line }) => getComputedStyle(line).animationDelay)).toEqual(['0s', '0.5s', '1s']);
});

test.each([0, 0.004, -0.004])('draws nothing for a negligible flow of %p kW', async (kw) => {
  const screen = await renderArrow('vertical', kw);
  expect(screen.container.textContent).toBe('');
  expect(chevrons(screen.container)).toHaveLength(0);
});

test.each([
  [0.005, '5 W'],
  [0.5, '500 W'],
  [-0.5, '500 W'],
  [0.999, '999 W'],
  [1, '1.0 kW'],
  [2.34, '2.3 kW'],
  [-2.34, '2.3 kW'],
])('labels %p kW as "%s", leaving direction to the arrow', async (kw, label) => {
  const screen = await renderArrow('vertical', kw);
  expect(screen.container.textContent).toBe(label);
});
