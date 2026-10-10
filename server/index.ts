import path from 'path';
import type { ValuesResponse } from '../src/types/types';
import { getValues, getVariables } from './foxcloud';
import { getRateNow } from './octopus';

const distDir = path.join(import.meta.dir, '..', 'dist');

const getDashboardValues = async (): Promise<ValuesResponse> => {
  const [price, values] = await Promise.all([getRateNow(), getValues()]);
  return {
    solar: values.pvPower.value,
    usage: values.loadsPower.value,
    grid: values.meterPower.value,
    batteryCharge: values.SoC.value,
    batteryPower: values.batChargePower.value - values.batDischargePower.value,
    price,
  };
};

console.log('Speartip Api backend started');

Bun.serve({
  port: 29999,
  async fetch(req) {
    const url = new URL(req.url);
    switch (url.pathname) {
      case '/api/values': {
        try {
          return Response.json(await getDashboardValues());
        }
        catch (err) {
          console.error('Failed to fetch dashboard values', err);
          return Response.json({ error: 'Upstream request failed' }, { status: 502 });
        }
      }
      case '/api/variables': {
        return Response.json(await getVariables());
      }
      default: {
        if (url.pathname.startsWith('/api/')) {
          return new Response('Not Found', { status: 404 });
        }
        const requestedPath = path.join(distDir, url.pathname);
        if (requestedPath.startsWith(distDir + path.sep)) {
          const requested = Bun.file(requestedPath);
          if (await requested.exists()) {
            return new Response(requested);
          }
        }
        return new Response(Bun.file(path.join(distDir, 'index.html')));
      }
    }
  },
});
