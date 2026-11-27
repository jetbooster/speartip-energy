import { freshImport, mockFetch, sent } from '../test/setup';
import { afterEach, describe, expect, setSystemTime, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { getTodayHourly, getValues } from './index';

const PATH = '/op/v0/device/real/query';
const ROUTE = `POST ${PATH}`;

describe('getValues', () => {
  test('signs with literal backslash-r-backslash-n separators, not real newlines', async () => {
    mockFetch({ [ROUTE]: () => Response.json({ errno: 0, result: [{ datas: [] }] }) });
    await getValues();
    const headers = sent(ROUTE)[0]?.headers;
    const timestamp = headers?.get('timestamp');
    const signed = String.raw`${PATH}\r\ntest-fox-key\r\n${timestamp}`;
    expect(headers?.get('signature')).toBe(createHash('md5').update(signed).digest('hex'));
  });

  test('returns readings keyed by variable name', async () => {
    const solar = { variable: 'pvPower', value: 1.5 };
    mockFetch({ [ROUTE]: () => Response.json({ errno: 0, result: [{ datas: [solar] }] }) });
    expect((await getValues()).pvPower).toEqual(solar as never);
  });

  test('throws on a FoxCloud error, which still arrives as HTTP 200', async () => {
    mockFetch({ [ROUTE]: () => Response.json({ errno: 40256 }) });
    await expect(getValues()).rejects.toThrow('40256');
  });
});

describe('getCachedValues', () => {
  type FoxCloud = typeof import('./index');
  const reply = (value: number) => Response.json({ errno: 0, result: [{ datas: [{ variable: 'SoC', value }] }] });

  afterEach(() => {
    setSystemTime();
  });

  test('reuses a response for up to a minute, then fetches again', async () => {
    const { getCachedValues } = await freshImport<FoxCloud>('../foxcloud/index');
    mockFetch({ [ROUTE]: call => reply(call) });
    setSystemTime(new Date('2027-01-15T12:00:00Z'));
    expect((await getCachedValues()).SoC.value).toBe(0);
    setSystemTime(new Date('2027-01-15T12:00:59Z'));
    expect((await getCachedValues()).SoC.value).toBe(0);
    setSystemTime(new Date('2027-01-15T12:01:00Z'));
    expect((await getCachedValues()).SoC.value).toBe(1);
    expect(sent(ROUTE)).toHaveLength(2);
  });

  test('shares one request between callers that arrive together', async () => {
    const { getCachedValues } = await freshImport<FoxCloud>('../foxcloud/index');
    mockFetch({ [ROUTE]: call => reply(call) });
    await Promise.all([getCachedValues(), getCachedValues(), getCachedValues()]);
    expect(sent(ROUTE)).toHaveLength(1);
  });

  test('does not cache a failure', async () => {
    const { getCachedValues } = await freshImport<FoxCloud>('../foxcloud/index');
    mockFetch({ [ROUTE]: call => call === 0 ? Response.json({ errno: 40256 }) : reply(42) });
    await expect(getCachedValues()).rejects.toThrow('40256');
    expect((await getCachedValues()).SoC.value).toBe(42);
  });
});

describe('getTodayHourly', () => {
  const REPORT = 'POST /op/v0/device/report/query';
  const VARIABLES = ['PVEnergyTotal', 'feedin', 'gridConsumption', 'chargeEnergyToTal', 'dischargeEnergyToTal'];
  // Variable v reports v * 100 + hour, so each series is recognisable.
  const report = () => Response.json({
    errno: 0,
    result: VARIABLES.map((variable, v) => ({
      variable,
      unit: 'kWh',
      values: Array.from({ length: 24 }, (_, hour) => v * 100 + hour),
    })),
  });

  test('asks for the UK date by hour and maps each series', async () => {
    mockFetch({ [REPORT]: report });
    // 23:30 UTC in July is already the 16th in London.
    const hourly = await getTodayHourly(new Date('2027-07-15T23:30:00Z'));
    const body = JSON.parse(sent(REPORT)[0]?.body ?? '{}') as unknown;
    expect(body).toMatchObject({ year: 2027, month: 7, day: 16, dimension: 'day', variables: VARIABLES });
    expect(hourly.pv[3]).toBe(3);
    expect(hourly.feedin[3]).toBe(103);
    expect(hourly.gridImport[3]).toBe(203);
    expect(hourly.batteryCharge[3]).toBe(303);
    expect(hourly.batteryDischarge[3]).toBe(403);
  });

  test('throws on a FoxCloud error', async () => {
    mockFetch({ [REPORT]: () => Response.json({ errno: 40256 }) });
    await expect(getTodayHourly()).rejects.toThrow('40256');
  });

  test('throws when a series is missing', async () => {
    mockFetch({ [REPORT]: () => Response.json({ errno: 0, result: [] }) });
    await expect(getTodayHourly()).rejects.toThrow('PVEnergyTotal');
  });
});
