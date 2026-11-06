import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import Gauge from './Gauge';

test('smoke: renders a gauge with real layout in a real browser', async () => {
  const screen = await render(
    <Gauge val={42} max={100} icon={<span>icon</span>} units={{ normal: '%', noSpace: true }} />,
  );
  const value = screen.getByText('42%');

  await expect.element(value).toBeVisible();
  expect(navigator.userAgent).toContain('Chrome');
  // jsdom has no layout engine and always reports 0 here, so this only passes in a real browser.
  expect(value.element().getBoundingClientRect().width).toBeGreaterThan(0);
});
