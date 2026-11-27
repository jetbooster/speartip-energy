import { MD5 } from 'bun';
import { cached } from '../cache';
import { type CalendarDay, londonDay } from '../calendar';
import type { DeviceQueryBody, DeviceQueryResponse, FoxCloudResponse, ReportQueryResponse } from './types';

const { FOXCLOUD_API_KEY, FOXCLOUD_SN } = process.env;

// Overridable so `bun run dev:mock` can point it at fake upstreams.
const API_ROOT = process.env.FOXCLOUD_API_ROOT ?? 'https://www.foxesscloud.com';

type Datum = DeviceQueryBody['datas'][number];

const sign = (path: string) => {
  const timestamp = Date.now().toString();

  // FoxCloud's signing scheme uses a literal backslash-r-backslash-n, not a newline.
  const signature = MD5.hash(`${path}\\r\\n${FOXCLOUD_API_KEY}\\r\\n${timestamp}`, 'hex');
  return {
    'Content-Type': 'application/json',
    'token': FOXCLOUD_API_KEY as string,
    'Signature': signature,
    'Timestamp': timestamp,
    'lang': 'en',
  };
};

const fetchAndSign = (path: string, init?: RequestInit) => fetch(`${API_ROOT}${path}`, {
  ...init,
  headers: {
    ...init?.headers,
    ...sign(path),
  },
  signal: AbortSignal.timeout(5000),
});

export const getValues = async (): Promise<Record<string, Datum>> => {
  const res = await fetchAndSign('/op/v0/device/real/query', {
    method: 'POST',
    body: JSON.stringify({
      variables: ['pvPower', 'meterPower', 'SoC', 'loadsPower', 'batChargePower', 'batDischargePower'],
      sn: FOXCLOUD_SN as string,
    }),
  });
  const parsed = await res.json() as DeviceQueryResponse;
  if (parsed.errno !== 0) {
    throw new Error(`FoxCloud returned errno ${parsed.errno}`);
  }
  return Object.fromEntries(parsed.result[0].datas.map(datum => [datum.variable, datum]));
};

// FoxCloud only refreshes its readings every ~90s and limits calls per key each day, so the dashboard
// shares one recent response between displays and reloads.
export const getCachedValues = cached(getValues, 60 * 1000);

// Hour by hour for one day, in kWh. Index 0 is 00:00-01:00 UK time.
export interface HourlyEnergy {
  // Solar generated. FoxCloud's 'generation' is the inverter's whole output, battery discharge included, so it
  // isn't used.
  pv: number[];
  feedin: number[];
  gridImport: number[];
  batteryCharge: number[];
  batteryDischarge: number[];
}

const REPORT_VARIABLES: Record<keyof HourlyEnergy, string> = {
  pv: 'PVEnergyTotal',
  feedin: 'feedin',
  gridImport: 'gridConsumption',
  batteryCharge: 'chargeEnergyToTal',
  batteryDischarge: 'dischargeEnergyToTal',
};

// One day's hourly report. For today, hours still to come are 0.
export const getHourly = async ({ year, month, day }: CalendarDay): Promise<HourlyEnergy> => {
  const res = await fetchAndSign('/op/v0/device/report/query', {
    method: 'POST',
    body: JSON.stringify({
      sn: FOXCLOUD_SN as string,
      year,
      month,
      day,
      dimension: 'day',
      variables: Object.values(REPORT_VARIABLES),
    }),
  });
  const parsed = await res.json() as ReportQueryResponse;
  if (parsed.errno !== 0) {
    throw new Error(`FoxCloud returned errno ${parsed.errno}`);
  }
  const series = (variable: string) => {
    const values = parsed.result.find(r => r.variable === variable)?.values;
    if (!values) {
      throw new Error(`FoxCloud report has no ${variable}`);
    }
    return values;
  };
  return Object.fromEntries(
    Object.entries(REPORT_VARIABLES).map(([key, variable]) => [key, series(variable)]),
  ) as unknown as HourlyEnergy;
};

export const getTodayHourly = (now = new Date()) => getHourly(londonDay(now));

// Hourly totals move slowly, and every call counts against FoxCloud's daily limit.
export const getCachedTodayHourly = cached(() => getTodayHourly(), 10 * 60 * 1000);

export const getVariables = async (): Promise<{ unit: string; name: Record<string, string> }[]> => {
  const res = await fetchAndSign('/op/v0/device/variable/get');
  const parsed = await res.json() as FoxCloudResponse<{ unit: string; name: Record<string, string> }[]>;
  return parsed.result;
};
