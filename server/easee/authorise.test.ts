import {
  easeeRoutes, freshImport, HOUR_MS, mockFetch, requests, sent, silenceConsole, writeTokens,
} from '../test/setup';
import { afterEach, beforeEach, describe, expect, mock, setSystemTime, test } from 'bun:test';

type Authorise = typeof import('./authorise');

const START = 'POST /api/chargers/TESTCHARGER/commands/start_charging';
const COOLDOWN_MS = 30 * 1000;
const KEY = 'test-charge-key';

const request = (headers: Record<string, string> = { 'x-charge-key': KEY }, method = 'POST') =>
  new Request('http://localhost/api/charging/authorise', { method, headers });

const charger = (mode: number) => mockFetch({
  ...easeeRoutes(mode),
  [START]: () => new Response(null, { status: 202 }),
});

let handler: Authorise['authoriseChargingHandler'];

beforeEach(async () => {
  silenceConsole();
  await writeTokens(HOUR_MS);
  charger(7);
  // The cooldown lives in the module, so each test needs its own instance.
  handler = (await freshImport<Authorise>('../easee/authorise')).authoriseChargingHandler;
});

afterEach(() => {
  setSystemTime();
  mock.restore();
});

describe('refuses without touching the charger', () => {
  test.each([
    ['a missing key', {}],
    ['a wrong key', { 'x-charge-key': 'wrong' }],
    ['a key of a different length', { 'x-charge-key': `${KEY}-and-more` }],
    ['the right key sent from another website', { 'x-charge-key': KEY, 'sec-fetch-site': 'cross-site' }],
  ])('%s', async (_name, headers) => {
    expect((await handler(request(headers))).status).toBe(403);
    expect(requests).toHaveLength(0);
  });

  test('non-POST requests', async () => {
    expect((await handler(request(undefined, 'GET'))).status).toBe(405);
    expect(requests).toHaveLength(0);
  });

  test('any request when no key is configured', async () => {
    const saved = process.env.CHARGE_START_KEY;
    delete process.env.CHARGE_START_KEY;
    const disabled = await freshImport<Authorise>('../easee/authorise');
    process.env.CHARGE_START_KEY = saved;
    expect((await disabled.authoriseChargingHandler(request())).status).toBe(404);
    expect(requests).toHaveLength(0);
  });
});

describe('with a valid key', () => {
  test('starts charging when the car is awaiting authorisation', async () => {
    expect((await handler(request())).status).toBe(200);
    expect(sent(START)).toHaveLength(1);
  });

  test.each([1, 2, 3, 4, 5, 6])('mode %p returns 409 and sends no start command', async (mode) => {
    charger(mode);
    expect((await handler(request())).status).toBe(409);
    expect(sent(START)).toHaveLength(0);
  });

  test('returns 502 when Easee cannot be reached', async () => {
    mockFetch();
    expect((await handler(request())).status).toBe(502);
  });

  test('returns 502 when the start command fails', async () => {
    mockFetch({ ...easeeRoutes(7), [START]: () => new Response('nope', { status: 500 }) });
    expect((await handler(request())).status).toBe(502);
  });
});

describe('repeat taps', () => {
  test('a double tap sends one start command', async () => {
    const statuses = (await Promise.all([handler(request()), handler(request())])).map(r => r.status).sort();
    expect(statuses).toEqual([200, 429]);
    expect(sent(START)).toHaveLength(1);
  });

  test('blocks further attempts until the cooldown ends', async () => {
    const start = Date.now();
    setSystemTime(new Date(start));
    await handler(request());

    setSystemTime(new Date(start + COOLDOWN_MS - 1));
    expect((await handler(request())).status).toBe(429);
    expect(sent(START)).toHaveLength(1);

    setSystemTime(new Date(start + COOLDOWN_MS));
    expect((await handler(request())).status).toBe(200);
    expect(sent(START)).toHaveLength(2);
  });

  test('an attempt still running when the cooldown ends blocks a second one', async () => {
    const start = Date.now();
    setSystemTime(new Date(start));
    let finish = () => {};
    const held = new Promise<Response>((resolve) => {
      finish = () => resolve(new Response(null, { status: 202 }));
    });
    mockFetch({ ...easeeRoutes(7), [START]: () => held });

    const first = handler(request());
    while (sent(START).length === 0) {
      await Bun.sleep(1);
    }
    setSystemTime(new Date(start + COOLDOWN_MS));
    expect((await handler(request())).status).toBe(429);

    finish();
    expect((await first).status).toBe(200);
    expect(sent(START)).toHaveLength(1);
  });

  test('a failed attempt also starts the cooldown', async () => {
    mockFetch();
    await handler(request());
    charger(7);
    expect((await handler(request())).status).toBe(429);
    expect(sent(START)).toHaveLength(0);
  });

  test('a wrong key does not start the cooldown, so it cannot lock out the display', async () => {
    await handler(request({ 'x-charge-key': 'wrong' }));
    expect((await handler(request())).status).toBe(200);
  });
});
