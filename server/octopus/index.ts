import { add, addDays, startOfDay } from 'date-fns';
import { formatToIsoNoMilliseconds, parseIsoNoMilliSeconds } from '../utils';
import { FullRate, RatesResponse } from './types';

// eslint-disable-next-line @stylistic/max-len
const OCTOPUS_RATES_URL = 'https://api.octopus.energy/v1/products/AGILE-24-10-01/electricity-tariffs/E-1R-AGILE-24-10-01-G/standard-unit-rates/';

let resultCache: { expireDate: Date; value: number } | null = null;

const { OCTOPUS_API_KEY } = process.env;

export const getDayRates = async (d: Date): Promise<FullRate[]> => {
  const url = new URL(OCTOPUS_RATES_URL);
  url.searchParams.append('period_from', `${startOfDay(d).toISOString().slice(0, 16)}Z`);
  url.searchParams.append('period_to', `${startOfDay(addDays(d, 1)).toISOString().slice(0, 16)}Z`);
  url.search = decodeURIComponent(url.search);
  const result = await fetch(url.toString(), {
    headers: {
      Authorization: `Token ${OCTOPUS_API_KEY}`,
    },
    signal: AbortSignal.timeout(5000),
  });
  const parsed = await result.json() as RatesResponse;
  return parsed.results;
};

export const getRateNow = async (d = new Date()): Promise<number> => {
  const dateNoMillis = formatToIsoNoMilliseconds(d);
  if (resultCache && resultCache.expireDate > d) {
    return resultCache.value;
  }
  const url = new URL(OCTOPUS_RATES_URL);
  // should get exactly one result
  url.searchParams.append('period_from', formatToIsoNoMilliseconds(add(d, { hours: -1 })));
  url.searchParams.append('period_to', dateNoMillis);
  url.search = decodeURIComponent(url.search);
  const result = await fetch(url.toString(), {
    headers: {
      Authorization: `Token ${OCTOPUS_API_KEY}`,
    },
    signal: AbortSignal.timeout(5000),
  });
  const parsed = await result.json() as RatesResponse;
  const val = parsed.results[0];
  resultCache = {
    expireDate: parseIsoNoMilliSeconds(val.valid_to),
    value: val.value_inc_vat,
  };
  return val.value_inc_vat;
};
