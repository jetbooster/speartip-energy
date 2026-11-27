// Fake FoxCloud, Easee and Home Assistant for `bun run dev:mock`, all on one port (their paths don't overlap).
// Nothing is checked: any token or signature is accepted.
//
// Change what they report while it runs, e.g.:
//   curl localhost:29990/_mock -d '{"soc": 95, "solar": 3.1}'
//   curl localhost:29990/_mock -d '{"chargerMode": 7}'            # car waiting for authorisation
//   curl localhost:29990/_mock -d '{"todaySolar": 6, "todayPeakImport": 0.5}'  # where today's usage came from
//   curl localhost:29990/_mock -d '{"gasHeating": false, "weather": "sunny", "cloudCover": 10}'
//   curl localhost:29990/_mock                                    # show the current state

export const MOCK_CHARGER_ID = 'MOCKCHARGER';

interface MockState {
  // FoxCloud, in kW and %.
  solar: number;
  usage: number;
  soc: number;
  // Positive charges the battery, negative discharges it. Grid is whatever balances the rest.
  batteryPower: number;
  // Today's usage so far by source, in kWh, for the energy sources dial. Reported as imports at 02:00 and
  // 18:00 and solar at noon, with no battery, so the dial shows exactly these.
  todayCheapImport: number;
  todaySolar: number;
  todayPeakImport: number;
  // Easee chargerOpMode: 1 Disconnected, 3 Charging, 4 Completed, 5 Error, 6 ReadyToCharge, 7 AwaitingAuthorization.
  chargerMode: number;
  chargerOnline: boolean;
  // Home Assistant.
  weather: string;
  outdoorTemperature: number;
  cloudCover: number;
  indoorTemperature: number;
  gasHeating: boolean;
}

const state: MockState = {
  solar: 2.4,
  usage: 0.85,
  soc: 64,
  batteryPower: 0.6,
  todayCheapImport: 9.15,
  todaySolar: 0.5,
  todayPeakImport: 0.95,
  chargerMode: 1,
  chargerOnline: true,
  weather: 'cloudy',
  outdoorTemperature: 5.3,
  cloudCover: 100,
  indoorTemperature: 17.8,
  gasHeating: true,
};

interface Entity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
}

// Climate entities the heating job controls. Service calls change them, as they would in Home Assistant.
const acUnits: Record<string, Entity> = Object.fromEntries(
  [['climate.lounge', 16.5], ['climate.bedroom', 18], ['climate.guest_bedroom', 17]].map(([id, current]) => [
    id,
    { entity_id: id as string, state: 'off', attributes: { temperature: 21, current_temperature: current } },
  ]),
);

const entities = (): Entity[] => [
  {
    entity_id: 'weather.home',
    state: state.weather,
    attributes: { temperature: state.outdoorTemperature, cloud_coverage: state.cloudCover },
  },
  {
    entity_id: 'climate.living_room_living_room',
    state: 'heat',
    attributes: {
      current_temperature: state.indoorTemperature,
      temperature: 18.5,
      hvac_action: state.gasHeating ? 'heating' : 'idle',
    },
  },
  {
    entity_id: 'climate.entryway_entryway',
    state: 'heat',
    attributes: { current_temperature: 18.3, temperature: 18.5, hvac_action: 'idle' },
  },
  ...Object.values(acUnits),
];

const foxcloudValues = () => {
  const grid = state.usage + state.batteryPower - state.solar;
  const datas = Object.entries({
    pvPower: state.solar,
    loadsPower: state.usage,
    meterPower: Number(grid.toFixed(3)),
    SoC: state.soc,
    batChargePower: Math.max(state.batteryPower, 0),
    batDischargePower: Math.max(-state.batteryPower, 0),
  }).map(([variable, value]) => ({ variable, value, unit: '', name: variable }));
  return { errno: 0, result: [{ deviceSN: 'MOCK', datas }] };
};

// Past days get made-up but steady totals that vary by date, so the history chart has something to show.
const pastDay = (day: number) => ({
  todayCheapImport: 6 + (day * 7) % 9,
  todaySolar: (day * 5) % 11,
  todayPeakImport: (day * 3) % 4,
});

// FoxCloud's hourly report for one day. Today comes from the three totals above.
const foxcloudReport = ({ year, month, day }: { year: number; month: number; day: number }) => {
  const now = new Date();
  const isToday = year === now.getFullYear() && month === now.getMonth() + 1 && day === now.getDate();
  const totals = isToday ? state : pastDay(day);
  const hours = (at: Record<number, number>) => Array.from({ length: 24 }, (_, hour) => at[hour] ?? 0);
  const series = {
    PVEnergyTotal: hours({ 12: totals.todaySolar }),
    feedin: hours({}),
    gridConsumption: hours({ 2: totals.todayCheapImport, 18: totals.todayPeakImport }),
    chargeEnergyToTal: hours({}),
    dischargeEnergyToTal: hours({}),
  };
  return {
    errno: 0,
    result: Object.entries(series).map(([variable, values]) => ({ variable, unit: 'kWh', values })),
  };
};

const chargerState = () => ({
  circuitStates: [{
    chargerStates: [{
      chargerID: MOCK_CHARGER_ID,
      chargerState: {
        chargerOpMode: state.chargerMode,
        isOnline: state.chargerOnline,
        outputCurrent: state.chargerMode === 3 ? 32 : 0,
        dynamicChargerCurrent: 32,
        totalPower: state.chargerMode === 3 ? 7.2 : 0,
        sessionEnergy: 0,
        cableLocked: state.chargerMode !== 1,
        reasonForNoCurrent: null,
      },
    }],
  }],
});

const tokens = () => Response.json({
  accessToken: 'mock-access',
  refreshToken: 'mock-refresh',
  expiresIn: 24 * 60 * 60,
  accessClaims: null,
  tokenType: 'Bearer',
});

const callClimateService = async (service: string, req: Request) => {
  const body = await req.json() as { entity_id: string; hvac_mode?: string; temperature?: number };
  const unit = acUnits[body.entity_id];
  if (!unit) {
    return new Response('Unknown entity', { status: 400 });
  }
  if (service === 'set_hvac_mode' && body.hvac_mode) {
    unit.state = body.hvac_mode;
  }
  else if (service === 'set_temperature' && body.temperature !== undefined) {
    unit.attributes.temperature = body.temperature;
  }
  else if (service === 'turn_off') {
    unit.state = 'off';
  }
  console.log(`[mock] ${service} ${body.entity_id}`);
  return Response.json([]);
};

const handle = async (req: Request): Promise<Response> => {
  const { pathname } = new URL(req.url);
  const route = `${req.method} ${pathname}`;

  if (pathname === '/_mock') {
    if (req.method === 'POST') {
      Object.assign(state, await req.json());
      console.log('[mock] state is now', state);
    }
    return Response.json(state);
  }

  // FoxCloud
  if (route === 'POST /op/v0/device/real/query') {
    return Response.json(foxcloudValues());
  }
  if (route === 'POST /op/v0/device/report/query') {
    return Response.json(foxcloudReport(await req.json() as { year: number; month: number; day: number }));
  }
  if (route === 'GET /op/v0/device/variable/get') {
    return Response.json({ errno: 0, result: [] });
  }

  // Easee
  if (route === 'POST /api/accounts/login' || route === 'POST /api/accounts/refresh_token') {
    return tokens();
  }
  if (/^GET \/api\/chargers\/[^/]+\/site$/.test(route)) {
    return Response.json({ id: 1 });
  }
  if (route === 'GET /api/sites/1/state') {
    return Response.json(chargerState());
  }
  const command = route.match(/^POST \/api\/chargers\/[^/]+\/commands\/(start|stop)_charging$/);
  if (command) {
    state.chargerMode = command[1] === 'start' ? 3 : 6;
    console.log(`[mock] ${command[1]}_charging, charger mode is now ${state.chargerMode}`);
    return new Response(null, { status: 202 });
  }

  // Home Assistant
  if (route === 'GET /api/states') {
    return Response.json(entities());
  }
  const single = route.match(/^GET \/api\/states\/(.+)$/);
  if (single) {
    const entity = entities().find(e => e.entity_id === single[1]);
    return entity ? Response.json(entity) : new Response('Not Found', { status: 404 });
  }
  const service = route.match(/^POST \/api\/services\/climate\/(\w+)$/);
  if (service) {
    return callClimateService(service[1], req);
  }

  console.warn(`[mock] no fake for ${route}`);
  return new Response('Not mocked', { status: 404 });
};

export const startMockUpstreams = (port: number) => Bun.serve({ hostname: '127.0.0.1', port, fetch: handle });
