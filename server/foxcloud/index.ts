import { MD5 } from 'bun';
import type { DeviceQueryBody, DeviceQueryResponse, FoxCloudResponse } from './types';

const { FOXCLOUD_API_KEY, FOXCLOUD_SN } = process.env;

const API_ROOT = 'https://www.foxesscloud.com';

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

export const getVariables = async (): Promise<{ unit: string; name: Record<string, string> }[]> => {
  const res = await fetchAndSign('/op/v0/device/variable/get');
  const parsed = await res.json() as FoxCloudResponse<{ unit: string; name: Record<string, string> }[]>;
  return parsed.result;
};
