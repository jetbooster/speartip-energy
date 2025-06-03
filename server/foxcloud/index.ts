import { MD5 } from 'bun';
import type { DeviceQueryBody, DeviceQueryResponse, FoxCloudResponse } from './types';

const { FOXCLOUD_API_KEY, FOXCLOUD_SN } = process.env;

const API_ROOT = 'https://www.foxesscloud.com';

const sign = (url: string) => {
  const timestamp = new Date().valueOf();

  const signature = MD5.hash(`${url}\\r\\n${FOXCLOUD_API_KEY}\\r\\n${timestamp.toString()}`, 'hex');
  return {
    'Content-Type': 'application/json',
    'token': FOXCLOUD_API_KEY as string,
    'Signature': signature,
    'Timestamp': timestamp.toString(),
    'lang': 'en',
  };
};

const fetchAndSign = (path: string, init?: RequestInit, params: Record<string, string> = {}) => {
  const url = new URL(`${API_ROOT}${path}`);
  if (params) {
    Object.entries(params).forEach(([key, val]) => {
      url.searchParams.append(key, val);
    });
  }
  return global.fetch(url, {
    ...init,
    headers: {
      ...init?.headers,
      ...sign(path),
    },
    signal: AbortSignal.timeout(5000),
  });
};

export const getValues = async (): Promise<Record<string, DeviceQueryBody['datas'][0]>> => {
  const res = await fetchAndSign('/op/v0/device/real/query', {
    method: 'POST',
    body: JSON.stringify({
      variables: ['pvPower', 'meterPower', 'SoC', 'loadsPower'],
      sn: FOXCLOUD_SN as string,
    }),
  });
  const parsed = await res.json() as DeviceQueryResponse;
  if (parsed.errno !== 0) {
    console.log(parsed);
  }
  const formattedResult = parsed.result[0].datas.reduce((acc, curr) => {
    acc[curr.variable] = curr;
    return acc;
  }, {} as Record<string, DeviceQueryBody['datas'][0]>);
  console.log(formattedResult);
  return formattedResult;
};

export const getVariables = async (): Promise<{ unit: string; name: Record<string, string> }[]> => {
  const res = await fetchAndSign('/op/v0/device/variable/get');
  const parsed = await res.json() as FoxCloudResponse<{ unit: string; name: Record<string, string> }[]>;
  console.log(parsed);
  return parsed.result;
};
