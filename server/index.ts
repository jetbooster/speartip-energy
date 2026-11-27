import path from 'path';
import 'crypto';
import type { ValuesResponse } from '../src/types/types';
import { getChargingStatus } from './easee';
import { keepTokensFresh } from './easee/auth';
import { authoriseChargingHandler } from './easee/authorise';
import { energySources } from './energy';
import { getCachedEnergyHistory } from './energy/history';
import { getCachedTodayHourly, getCachedValues, getVariables } from './foxcloud';
import { startHeatingSchedule } from './heating';
import { getHomeStatus } from './home';
import { getStateOfCharge, webhookHandler } from './smartcar';

const distDir = path.join(import.meta.dir, '..', 'dist');

const getDashboardValues = async (): Promise<ValuesResponse> => {
  const [values, charger, home, todayHourly] = await Promise.all([
    getCachedValues(),
    getChargingStatus().catch((err: unknown) => {
      console.error('Failed to fetch Easee charging status', err);
      return null;
    }),
    getHomeStatus(),
    getCachedTodayHourly().catch((err: unknown) => {
      console.error('Failed to fetch FoxCloud hourly report', err);
      return null;
    }),
  ]);
  const stateOfCharge = getStateOfCharge();
  return {
    solar: values.pvPower.value,
    usage: values.loadsPower.value,
    grid: values.meterPower.value,
    batteryCharge: values.SoC.value,
    batteryPower: values.batChargePower.value - values.batDischargePower.value,
    carChargeLevel: stateOfCharge?.percent ?? null,
    carChargeLevelUpdatedAt: stateOfCharge?.updatedAt ?? null,
    charger,
    energySources: todayHourly && energySources(todayHourly),
    weather: home.weather,
    heating: home.heating,
  };
};

console.log('Speartip Api backend started');

keepTokensFresh();
startHeatingSchedule();

Bun.serve({
  hostname: '127.0.0.1',
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
      case '/api/energy/history': {
        return Response.json(await getCachedEnergyHistory());
      }
      case '/api/variables': {
        return Response.json(await getVariables());
      }
      case '/api/charging/authorise': {
        return authoriseChargingHandler(req);
      }
      case '/auth/smartcar/redirect': {
        return new Response('SmartCar redirect endpoint. This is not a real page, but you can use this URL to complete the OAuth flow.');
      }
      case '/webhook/smartcar/battery': {
        return webhookHandler(req).catch((err) => {
          console.error('Failed to handle SmartCar webhook', err);
          return Response.json({ error: 'Failed to handle webhook' }, { status: 500 });
        });
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
