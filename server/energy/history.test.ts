import { freshImport, mockFetch, sent, silenceConsole } from '../test/setup';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { addDays, dayKey, londonDay } from '../calendar';

type History = typeof import('./history');

const REPORT = 'POST /op/v0/device/report/query';
const HISTORY_FILE = process.env.ENERGY_HISTORY_FILE as string;

// Every day: 2 kWh imported at 02:00 (cheap) and 1 kWh at 18:00 (expensive).
const report = () => Response.json({
  errno: 0,
  result: ['PVEnergyTotal', 'feedin', 'gridConsumption', 'chargeEnergyToTal', 'dischargeEnergyToTal'].map(variable => ({
    variable,
    unit: 'kWh',
    values: Array.from({ length: 24 }, (_, hour) => (variable === 'gridConsumption' ? { 2: 2, 18: 1 }[hour] ?? 0 : 0)),
  })),
});

const ONE_DAY = { cheapGrid: 2, solar: 0, expensiveGrid: 1 };

// The days FoxCloud was asked for, as YYYY-MM-DD.
const requestedDays = () => sent(REPORT).map((r) => {
  const { year, month, day } = JSON.parse(r.body ?? '{}') as { year: number; month: number; day: number };
  return dayKey({ year, month, day });
});

const stored = () => JSON.parse(readFileSync(HISTORY_FILE, 'utf8')) as Record<string, unknown>;

let history: History;

beforeEach(async () => {
  silenceConsole();
  rmSync(HISTORY_FILE, { force: true });
  history = await freshImport<History>('../energy/history');
});

afterEach(() => {
  mock.restore();
});

describe('getEnergyHistory', () => {
  const now = new Date();
  const today = londonDay(now);
  const pastDays = [6, 5, 4, 3, 2, 1].map(back => dayKey(addDays(today, -back)));

  test('returns the last seven days, oldest first, ending with today', async () => {
    mockFetch({ [REPORT]: report });
    const days = await history.getEnergyHistory(now);
    expect(days.map(d => d.date)).toEqual([...pastDays, dayKey(today)]);
    expect(days[0].sources).toEqual(ONE_DAY);
  });

  test('fetches each finished day once, then reads it from the file', async () => {
    mockFetch({ [REPORT]: report });
    await history.getEnergyHistory(now);
    expect(requestedDays()).toEqual(expect.arrayContaining(pastDays));
    expect(Object.keys(stored()).sort()).toEqual(pastDays);

    mockFetch({ [REPORT]: report });
    const again = await (await freshImport<History>('../energy/history')).getEnergyHistory(now);
    expect(requestedDays().filter(d => pastDays.includes(d))).toEqual([]);
    expect(again[0].sources).toEqual(ONE_DAY);
  });

  test('does not keep yesterday until FoxCloud has surely caught up', async () => {
    mockFetch({ [REPORT]: report });
    // 01:00 UK time in winter.
    const earlyMorning = new Date('2027-01-16T01:00:00Z');
    await history.getEnergyHistory(earlyMorning);
    expect(stored()).not.toHaveProperty('2027-01-15');
    expect(stored()).toHaveProperty('2027-01-14');
  });

  test('shows a failed day as missing and tries it again next time', async () => {
    const failing = dayKey(addDays(today, -3));
    mockFetch({ [REPORT]: (call) => {
      // Days are fetched oldest first, so the fourth request is three days back.
      return call === 3 ? Response.json({ errno: 40256 }) : report();
    } });
    const days = await history.getEnergyHistory(now);
    expect(days.find(d => d.date === failing)?.sources).toBeNull();
    expect(stored()).not.toHaveProperty(failing);

    mockFetch({ [REPORT]: report });
    await (await freshImport<History>('../energy/history')).getEnergyHistory(now);
    expect(requestedDays()).toContain(failing);
  });

  test('drops days older than a month', async () => {
    const old = dayKey(addDays(today, -40));
    writeFileSync(HISTORY_FILE, JSON.stringify({ [old]: ONE_DAY }));
    mockFetch({ [REPORT]: report });
    await history.getEnergyHistory(now);
    expect(stored()).not.toHaveProperty(old);
  });
});
