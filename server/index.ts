import path from 'path';
import { type ValuesResponse } from '../src/types/types';
import { getValues, getVariables } from './foxcloud';
import { getRateNow } from './octopus';

const distDir = path.join(import.meta.dir, '..', 'dist');

console.log("Speartip Api backend started")

Bun.serve({
  port: 29999,
  async fetch(req) {
    const url = new URL(req.url);
    switch (url.pathname) {
      case '/api/values': {
        const octopusPromise = getRateNow();
        const foxcloudPromise = getValues();
        const [octopusResult, foxcloudResult] = await Promise.all([octopusPromise, foxcloudPromise]);

        return new Response(JSON.stringify({
          solar: foxcloudResult['pvPower'].value,
          usage: foxcloudResult['loadsPower'].value,
          grid: foxcloudResult['meterPower'].value,
          batteryCharge: foxcloudResult['SoC'].value,
          batteryPower: foxcloudResult['batChargePower'].value - foxcloudResult['batDischargePower'].value,
          price: octopusResult,
        } as ValuesResponse));
      }
      case '/api/variables': {
        return new Response(JSON.stringify(await getVariables()));
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
