import { type ValuesResponse } from '../src/types/types';
import { getValues, getVariables } from './foxcloud';
import { getRateNow } from './octopus';

Bun.serve({
  port: 29999,
  async fetch(req) {
    const url = new URL(req.url);
    console.log(url);
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
          price: octopusResult,
        } as ValuesResponse));
      }
      case '/api/variables': {
        return new Response(JSON.stringify(await getVariables()));
      }
      default: {
        return new Response('Not Found', {
          status: 404,
        });
      }
    }
  },
});
