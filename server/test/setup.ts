// Import this FIRST in every test file. Modules read their config when they are imported, so
// this has to run before them. It keeps tests away from the real Easee tokens (spending a
// refresh token could log the server out) and makes any unmocked network call fail.
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { spyOn } from 'bun:test';

// Wiped at the start of each run, because `bun test` doesn't fire process exit handlers.
export const TEST_DIR = path.join(import.meta.dir, '..', '..', 'node_modules', '.tmp', 'server-tests');
rmSync(TEST_DIR, { recursive: true, force: true });
mkdirSync(TEST_DIR, { recursive: true, mode: 0o700 });

// Assigned unconditionally, because `bun test` run from server/ also loads the real server/.env.
Object.assign(process.env, {
  EASEE_TOKEN_FILE: path.join(TEST_DIR, 'easee-tokens.json'),
  SMARTCAR_STATE_FILE: path.join(TEST_DIR, 'smartcar-state.json'),
  EASEE_CHARGER_ID: 'TESTCHARGER',
  CHARGE_START_KEY: 'test-charge-key',
  FOXCLOUD_API_KEY: 'test-fox-key',
  FOXCLOUD_SN: 'TESTSN',
  SMARTCAR_WEBHOOK_ID: 'test-webhook-id',
  SMART_CAR_MANAGEMENT_KEY: 'test-management-key',
});

export interface LoggedRequest {
  route: string;
  headers: Pick<Headers, 'get'>;
  body: string | undefined;
}

type Handler = (call: number) => Response | Promise<Response>;

// Everything sent since the last mockFetch call.
export let requests: LoggedRequest[] = [];

// Routes are keyed like 'POST /api/foo'. `call` counts from 0, so a handler can fail and then succeed.
export const mockFetch = (routes: Record<string, Handler> = {}) => {
  requests = [];
  const calls: Record<string, number> = {};
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = new URL(input.toString());
    const route = `${init?.method ?? 'GET'} ${url.pathname}`;
    const headers = new Headers(init?.headers as Record<string, string> | undefined);
    requests.push({ route, headers, body: init?.body as string | undefined });
    const handler = routes[route];
    if (!handler) {
      throw new Error(`Unexpected network request in test: ${route}`);
    }
    const call = calls[route] ?? 0;
    calls[route] = call + 1;
    return handler(call);
  }) as unknown as typeof fetch;
};

export const sent = (route: string) => requests.filter(r => r.route === route);

mockFetch();

// Modules keep state (caches, cooldowns) and read env at import. A query string gives a new instance.
let instance = 0;
export const freshImport = <T>(modulePath: string): Promise<T> =>
  import(`${modulePath}?test=${++instance}`) as Promise<T>;

export const silenceConsole = () => {
  for (const method of ['log', 'warn', 'error'] as const) {
    spyOn(console, method).mockImplementation(() => undefined);
  }
};

export const writeTokens = (expiresInMs: number, accessToken = 'old-access', refreshToken = 'old-refresh') =>
  Bun.write(process.env.EASEE_TOKEN_FILE as string, JSON.stringify({
    accessToken,
    refreshToken,
    accessTokenExpiresAt: Date.now() + expiresInMs,
  }));

export const readTokens = () => Bun.file(process.env.EASEE_TOKEN_FILE as string).json();

export const HOUR_MS = 60 * 60 * 1000;

// The Easee calls behind getChargingStatus, reporting the given chargerOpMode.
export const easeeRoutes = (mode: number | null): Record<string, Handler> => ({
  'GET /api/chargers/TESTCHARGER/site': () => Response.json({ id: 1 }),
  'GET /api/sites/1/state': () => Response.json({
    circuitStates: [{
      chargerStates: [{
        chargerID: 'TESTCHARGER',
        chargerState: {
          chargerOpMode: mode,
          isOnline: true,
          outputCurrent: 0,
          dynamicChargerCurrent: 32,
          totalPower: 0,
        },
      }],
    }],
  }),
});
