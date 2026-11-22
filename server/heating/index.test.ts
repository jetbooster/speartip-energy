import { freshImport, mockFetch, sent, silenceConsole } from '../test/setup';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { rmSync } from 'node:fs';

type Heating = typeof import('./index');

const STATE_FILE = process.env.HEATING_STATE_FILE as string;

// January, so UK time is UTC.
const NIGHT = new Date('2027-01-15T23:30:05Z');
const DAY = new Date('2027-01-15T12:00:05Z');

const UNITS = ['climate.lounge', 'climate.bedroom', 'climate.guest_bedroom'];

interface Unit { state: string; temperature: number }
let house: Record<string, Unit>;
let battery: number | null;
let solar: number;

// A fake Home Assistant that applies the climate calls it receives, plus FoxCloud reporting `battery`.
const mockHouse = () => {
  const parse = (body: unknown) => JSON.parse(body as string) as Record<string, unknown>;
  const routes: Parameters<typeof mockFetch>[0] = {
    'POST /op/v0/device/real/query': () => battery === null
      ? Response.json({ errno: 40256 })
      : Response.json({ errno: 0, result: [{ datas: [
          { variable: 'SoC', value: battery },
          { variable: 'pvPower', value: solar },
        ] }] }),
  };
  for (const id of UNITS) {
    routes[`GET /api/states/${id}`] = () => Response.json({
      entity_id: id,
      state: house[id].state,
      attributes: { temperature: house[id].temperature },
    });
  }
  mockFetch(routes);
  // Service calls carry the entity in the body, so route them by hand.
  const fakeFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const res = await fakeFetch(input, init).catch(() => null);
    if (res) {
      return res;
    }
    const url = new URL(input.toString());
    const body = parse(init?.body);
    const unit = house[body.entity_id as string];
    if (url.pathname === '/api/services/climate/set_temperature') {
      unit.state = body.hvac_mode as string;
      unit.temperature = body.temperature as number;
    }
    else if (url.pathname === '/api/services/climate/turn_off') {
      unit.state = 'off';
    }
    else {
      throw new Error(`Unexpected network request in test: ${url.pathname}`);
    }
    return Response.json([]);
  }) as unknown as typeof fetch;
};

const states = () => Object.fromEntries(UNITS.map(id => [id, house[id].state]));

let heating: Heating;

beforeEach(async () => {
  silenceConsole();
  rmSync(STATE_FILE, { force: true });
  house = Object.fromEntries(UNITS.map(id => [id, { state: 'off', temperature: 21 }]));
  battery = 50;
  solar = 1.5;
  mockHouse();
  heating = await freshImport<Heating>('../heating/index');
});

afterEach(() => {
  mock.restore();
});

describe('isCheapRate', () => {
  test.each([
    ['2027-01-15T23:29:59Z', false],
    ['2027-01-15T23:30:00Z', true],
    ['2027-01-16T03:00:00Z', true],
    ['2027-01-16T05:29:59Z', true],
    ['2027-01-16T05:30:00Z', false],
    // British Summer Time: 22:30 UTC is 23:30 in the UK.
    ['2027-07-15T22:30:00Z', true],
    ['2027-07-16T04:30:00Z', false],
  ])('%s -> %p', (iso, expected) => {
    expect(heating.isCheapRate(new Date(iso))).toBe(expected);
  });
});

describe('runHeatingCheck', () => {
  test('overnight, heats every unit except the main bedroom to 19°C', async () => {
    await heating.runHeatingCheck(NIGHT);
    expect(states()).toEqual({ 'climate.lounge': 'heat', 'climate.bedroom': 'off', 'climate.guest_bedroom': 'heat' });
    expect(house['climate.lounge'].temperature).toBe(19);
    expect(sent('POST /api/services/climate/set_temperature')[0]?.headers.get('authorization'))
      .toBe('Bearer test-ha-token');
  });

  test('overnight with a full battery still leaves the main bedroom off', async () => {
    battery = 100;
    await heating.runHeatingCheck(NIGHT);
    expect(house['climate.bedroom'].state).toBe('off');
  });

  test('during the day, heats every unit once the battery reaches 90%', async () => {
    battery = 89;
    await heating.runHeatingCheck(DAY);
    expect(states()).toEqual({ 'climate.lounge': 'off', 'climate.bedroom': 'off', 'climate.guest_bedroom': 'off' });
    battery = 90;
    await heating.runHeatingCheck(DAY);
    expect(states()).toEqual({ 'climate.lounge': 'heat', 'climate.bedroom': 'heat', 'climate.guest_bedroom': 'heat' });
  });

  test('once heating from the battery, carries on until it drops below 80%', async () => {
    battery = 90;
    await heating.runHeatingCheck(DAY);
    battery = 80;
    await heating.runHeatingCheck(DAY);
    expect(Object.values(states())).toEqual(['heat', 'heat', 'heat']);
    battery = 79;
    await heating.runHeatingCheck(DAY);
    expect(Object.values(states())).toEqual(['off', 'off', 'off']);
    // Climbing back to 85% isn't enough to start again.
    battery = 85;
    await heating.runHeatingCheck(DAY);
    expect(Object.values(states())).toEqual(['off', 'off', 'off']);
  });

  test('a full battery alone does not start heating while the panels make 0.5 kW or less', async () => {
    battery = 100;
    solar = 0.5;
    await heating.runHeatingCheck(new Date('2027-01-16T05:30:05Z'));
    expect(Object.values(states())).toEqual(['off', 'off', 'off']);
    solar = 0.6;
    await heating.runHeatingCheck(new Date('2027-01-16T10:00:05Z'));
    expect(Object.values(states())).toEqual(['heat', 'heat', 'heat']);
  });

  test('once started, carries on when the solar fades, until the battery drops below 80%', async () => {
    battery = 95;
    await heating.runHeatingCheck(DAY);
    solar = 0;
    battery = 85;
    await heating.runHeatingCheck(DAY);
    expect(Object.values(states())).toEqual(['heat', 'heat', 'heat']);
  });

  test('the overnight rate resets the battery rule, so the morning needs 90% again', async () => {
    battery = 95;
    await heating.runHeatingCheck(new Date('2027-01-15T23:00:05Z'));
    await heating.runHeatingCheck(NIGHT);
    battery = 85;
    await heating.runHeatingCheck(new Date('2027-01-16T05:30:05Z'));
    expect(Object.values(states())).toEqual(['off', 'off', 'off']);
  });

  test('turns its units off again when the cheap rate ends', async () => {
    await heating.runHeatingCheck(NIGHT);
    await heating.runHeatingCheck(DAY);
    expect(Object.values(states())).toEqual(['off', 'off', 'off']);
  });

  test('turns the main bedroom off when the overnight rate starts', async () => {
    battery = 95;
    await heating.runHeatingCheck(new Date('2027-01-15T23:00:05Z'));
    expect(house['climate.bedroom'].state).toBe('heat');
    await heating.runHeatingCheck(NIGHT);
    expect(states()).toEqual({ 'climate.lounge': 'heat', 'climate.bedroom': 'off', 'climate.guest_bedroom': 'heat' });
  });

  test('never takes over or turns off a unit someone else switched on', async () => {
    house['climate.lounge'] = { state: 'heat', temperature: 22 };
    await heating.runHeatingCheck(NIGHT);
    await heating.runHeatingCheck(DAY);
    expect(house['climate.lounge']).toEqual({ state: 'heat', temperature: 22 });
  });

  test('leaves a unit alone for the rest of the period once it is changed by hand', async () => {
    await heating.runHeatingCheck(NIGHT);
    house['climate.lounge'].state = 'off';
    await heating.runHeatingCheck(new Date('2027-01-16T00:00:05Z'));
    expect(house['climate.lounge'].state).toBe('off');

    house['climate.guest_bedroom'].temperature = 21;
    await heating.runHeatingCheck(DAY);
    expect(house['climate.guest_bedroom']).toEqual({ state: 'heat', temperature: 21 });

    // The next night it's fair game again.
    await heating.runHeatingCheck(new Date('2027-01-16T23:30:05Z'));
    expect(house['climate.lounge'].state).toBe('heat');
  });

  test('remembers which units it owns across a restart', async () => {
    await heating.runHeatingCheck(NIGHT);
    heating = await freshImport<Heating>('../heating/index');
    await heating.runHeatingCheck(DAY);
    expect(Object.values(states())).toEqual(['off', 'off', 'off']);
  });

  test('changes nothing during the day if the battery reading fails', async () => {
    battery = 95;
    await heating.runHeatingCheck(DAY);
    battery = null;
    await heating.runHeatingCheck(DAY);
    expect(Object.values(states())).toEqual(['heat', 'heat', 'heat']);
  });

  test('still heats overnight if the battery reading fails', async () => {
    battery = null;
    await heating.runHeatingCheck(NIGHT);
    expect(house['climate.lounge'].state).toBe('heat');
  });
});

describe('msUntilNextCheck', () => {
  test('lands just after the next :00 or :30', () => {
    const now = Date.parse('2027-01-15T23:12:00Z');
    expect(new Date(now + heating.msUntilNextCheck(now)).toISOString()).toBe('2027-01-15T23:30:05.000Z');
  });
});
