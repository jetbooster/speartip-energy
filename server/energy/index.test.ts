import { describe, expect, test } from 'bun:test';
import type { HourlyEnergy } from '../foxcloud';
import { energySources } from './index';

// Builds a day from the hours that had anything happen. Everything else is 0.
const day = (hours: Record<number, Partial<Record<keyof HourlyEnergy, number>>>): HourlyEnergy => {
  const series = (key: keyof HourlyEnergy) => Array.from({ length: 24 }, (_, hour) => hours[hour]?.[key] ?? 0);
  return {
    pv: series('pv'),
    feedin: series('feedin'),
    gridImport: series('gridImport'),
    batteryCharge: series('batteryCharge'),
    batteryDischarge: series('batteryDischarge'),
  };
};

const rounded = (hourly: HourlyEnergy) =>
  Object.fromEntries(Object.entries(energySources(hourly)).map(([k, v]) => [k, Math.round(v * 100) / 100]));

describe('energySources', () => {
  test('grid import counts as cheap or expensive by the hour it arrived', () => {
    expect(rounded(day({ 2: { gridImport: 1 }, 18: { gridImport: 2 } })))
      .toEqual({ cheapGrid: 1, solar: 0, expensiveGrid: 2 });
  });

  test('splits the hours the overnight rate starts and ends in', () => {
    expect(rounded(day({ 5: { gridImport: 1 }, 23: { gridImport: 1 } })))
      .toEqual({ cheapGrid: 1, solar: 0, expensiveGrid: 1 });
  });

  test('leaves out solar that was exported', () => {
    expect(rounded(day({ 12: { pv: 3, feedin: 1 } })))
      .toEqual({ cheapGrid: 0, solar: 2, expensiveGrid: 0 });
  });

  test('battery energy counts as whatever charged it', () => {
    expect(rounded(day({
      2: { gridImport: 4, batteryCharge: 4 },
      12: { pv: 2, batteryCharge: 2 },
      19: { batteryDischarge: 3 },
    }))).toEqual({ cheapGrid: 2, solar: 1, expensiveGrid: 0 });
  });

  test('solar fills the battery before the grid does', () => {
    // 1 kWh of solar and 1 kWh of import in the same hour, with 1 kWh going into the battery.
    expect(rounded(day({
      14: { pv: 1, gridImport: 1, batteryCharge: 1 },
      20: { batteryDischarge: 1 },
    }))).toEqual({ cheapGrid: 0, solar: 1, expensiveGrid: 1 });
  });

  test('what the battery held at midnight counts as cheap', () => {
    expect(rounded(day({ 8: { batteryDischarge: 2 } })))
      .toEqual({ cheapGrid: 2, solar: 0, expensiveGrid: 0 });
  });

  test('is all zero before anything is used', () => {
    expect(rounded(day({}))).toEqual({ cheapGrid: 0, solar: 0, expensiveGrid: 0 });
  });
});
