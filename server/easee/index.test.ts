import { easeeRoutes, freshImport, HOUR_MS, mockFetch, sent, writeTokens } from '../test/setup';
import { beforeEach, describe, expect, test } from 'bun:test';

type Easee = typeof import('./index');

const STATE = 'GET /api/sites/1/state';
const SITE = 'GET /api/chargers/TESTCHARGER/site';
const REFRESH = 'POST /api/accounts/refresh_token';

let easee: Easee;

beforeEach(async () => {
  await writeTokens(HOUR_MS);
  mockFetch();
  // The site ID is cached per module instance.
  easee = await freshImport<Easee>('../easee/index');
});

describe('getChargingStatus', () => {
  test.each([
    [1, false, false], // Disconnected
    [2, true, false], // AwaitingStart
    [3, true, false], // Charging
    [4, true, false], // Completed
    [5, false, false], // Error, which may not mean a car is connected
    [6, true, false], // ReadyToCharge: already authorised, waiting for the car or IOG
    [7, true, true], // AwaitingAuthorization: the only mode that makes the gauge flash
    [null, false, false],
  ])('mode %p: connected=%p awaiting=%p', async (mode, connected, awaiting) => {
    mockFetch(easeeRoutes(mode));
    const status = await easee.getChargingStatus();
    expect(status.carConnected).toBe(connected);
    expect(status.carAwaitingAuthorization).toBe(awaiting);
  });

  test('looks up the site once, then reuses it', async () => {
    mockFetch(easeeRoutes(3));
    await easee.getChargingStatus();
    await easee.getChargingStatus();
    expect(sent(SITE)).toHaveLength(1);
    expect(sent(STATE)).toHaveLength(2);
  });

  test('does not cache a failed site lookup', async () => {
    mockFetch({
      ...easeeRoutes(3),
      [SITE]: call => call === 0 ? new Response('down', { status: 503 }) : Response.json({ id: 1 }),
    });
    await expect(easee.getChargingStatus()).rejects.toThrow('HTTP 503');
    expect((await easee.getChargingStatus()).chargerOpMode).toBe(3);
  });

  test('throws when the site does not include this charger', async () => {
    mockFetch({ ...easeeRoutes(3), [STATE]: () => Response.json({ circuitStates: [{ chargerStates: [] }] }) });
    await expect(easee.getChargingStatus()).rejects.toThrow('not found');
  });
});

describe('expired access tokens', () => {
  const refreshes = {
    [REFRESH]: () => Response.json({ accessToken: 'new-access', refreshToken: 'new-refresh', expiresIn: 3600 }),
  };

  test('a 401 forces one token refresh, then retries with the new token', async () => {
    const routes = easeeRoutes(3);
    mockFetch({
      ...routes,
      ...refreshes,
      [STATE]: call => call === 0 ? new Response('expired', { status: 401 }) : (routes[STATE] as () => Response)(),
    });
    expect((await easee.getChargingStatus()).chargerOpMode).toBe(3);
    expect(sent(REFRESH)).toHaveLength(1);
    expect(sent(STATE).map(r => r.headers.get('authorization'))).toEqual(['Bearer old-access', 'Bearer new-access']);
  });

  test('gives up if the retry is also a 401, rather than spending more refresh tokens', async () => {
    mockFetch({ ...easeeRoutes(3), ...refreshes, [STATE]: () => new Response('expired', { status: 401 }) });
    await expect(easee.getChargingStatus()).rejects.toThrow('HTTP 401');
    expect(sent(REFRESH)).toHaveLength(1);
    expect(sent(STATE)).toHaveLength(2);
  });

  test('other errors are not retried', async () => {
    mockFetch({ ...easeeRoutes(3), [STATE]: () => new Response('down', { status: 500 }) });
    await expect(easee.getChargingStatus()).rejects.toThrow('HTTP 500');
    expect(sent(STATE)).toHaveLength(1);
  });
});

test('startCharging sends the command to this charger and copes with an empty response', async () => {
  const route = 'POST /api/chargers/TESTCHARGER/commands/start_charging';
  mockFetch({ [route]: () => new Response(null, { status: 202 }) });
  await easee.startCharging();
  expect(sent(route)[0]?.headers.get('authorization')).toBe('Bearer old-access');
});
