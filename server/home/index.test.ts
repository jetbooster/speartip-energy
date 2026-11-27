import { freshImport, mockFetch, sent, silenceConsole } from '../test/setup';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

type Home = typeof import('./index');

const ROUTE = 'GET /api/states';

const entity = (entity_id: string, state: string, attributes: Record<string, unknown> = {}) =>
  ({ entity_id, state, attributes });

const HOUSE = [
  entity('weather.home', 'cloudy', { temperature: 5.3, cloud_coverage: 100 }),
  entity('climate.living_room_living_room', 'heat', { current_temperature: 17.8, hvac_action: 'heating' }),
  entity('climate.entryway_entryway', 'heat', { current_temperature: 18.3, hvac_action: 'idle' }),
  entity('climate.lounge', 'heat'),
  entity('climate.bedroom', 'off'),
  entity('climate.guest_bedroom', 'heat'),
];

let home: Home;

beforeEach(async () => {
  silenceConsole();
  home = await freshImport<Home>('../home/index');
});

afterEach(() => {
  mock.restore();
});

describe('getHomeStatus', () => {
  test('reads the weather, thermostats and AC units from one request', async () => {
    mockFetch({ [ROUTE]: () => Response.json(HOUSE) });
    expect(await home.getHomeStatus()).toEqual({
      weather: { temperature: 5.3, cloudCover: 100, condition: 'cloudy' },
      heating: { indoorTemperature: 17.8, gasHeating: true, acUnitsHeating: 2 },
    });
    await home.getHomeStatus();
    expect(sent(ROUTE)).toHaveLength(1);
  });

  test('reports nothing rather than failing when Home Assistant is down, then retries', async () => {
    mockFetch({ [ROUTE]: call => call === 0 ? new Response('', { status: 502 }) : Response.json(HOUSE) });
    expect(await home.getHomeStatus()).toEqual({ weather: null, heating: null });
    expect((await home.getHomeStatus()).weather?.temperature).toBe(5.3);
  });

  test('copes with missing and unavailable entities', async () => {
    mockFetch({ [ROUTE]: () => Response.json([
      entity('weather.home', 'unavailable'),
      entity('climate.living_room_living_room', 'unavailable', { current_temperature: null }),
    ]) });
    expect(await home.getHomeStatus()).toEqual({
      weather: null,
      heating: { indoorTemperature: null, gasHeating: false, acUnitsHeating: 0 },
    });
  });
});
