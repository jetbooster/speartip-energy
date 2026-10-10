import { add } from 'date-fns';
import { formatToIsoNoMilliseconds, parseIsoNoMilliSeconds } from '../utils';
import type { RatesResponse } from './types';

// eslint-disable-next-line @stylistic/max-len
const OCTOPUS_RATES_URL = 'https://api.octopus.energy/v1/products/AGILE-24-10-01/electricity-tariffs/E-1R-AGILE-24-10-01-G/standard-unit-rates/';

let resultCache: { expireDate: Date; value: number } | null = null;

const { OCTOPUS_API_KEY } = process.env;

export const getRateNow = async (d = new Date()): Promise<number> => {
  if (resultCache && resultCache.expireDate > d) {
    return resultCache.value;
  }
  const url = new URL(OCTOPUS_RATES_URL);
  // should get exactly one result
  url.searchParams.append('period_from', formatToIsoNoMilliseconds(add(d, { hours: -1 })));
  url.searchParams.append('period_to', formatToIsoNoMilliseconds(d));
  url.search = decodeURIComponent(url.search);
  const result = await fetch(url.toString(), {
    headers: {
      Authorization: `Token ${OCTOPUS_API_KEY}`,
    },
    signal: AbortSignal.timeout(5000),
  });
  const parsed = await result.json() as RatesResponse;
  const val = parsed.results[0];
  if (!val) {
    throw new Error('Octopus returned no rate for the current period');
  }
  resultCache = {
    expireDate: parseIsoNoMilliSeconds(val.valid_to),
    value: val.value_inc_vat,
  };
  return val.value_inc_vat;
};
