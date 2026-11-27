// Development launcher. Run through package.json:
//   bun run dev          UI only, against a backend you've started yourself on 127.0.0.1:29999
//   bun run dev:remote   UI against the real backend on hetzner, through an SSH tunnel over the tailnet
//   bun run dev:mock     UI plus this checkout's backend (restarts on edits), with fake upstreams
//                        (FoxCloud, Easee, Home Assistant). See mock-upstreams.ts to change what they report.
import type { Subprocess } from 'bun';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { MOCK_CHARGER_ID, startMockUpstreams } from './mock-upstreams';

const ROOT = path.join(import.meta.dir, '..', '..');

const REMOTE_HOST = process.env.DEV_REMOTE_HOST ?? 'hetzner';
const TUNNEL_PORT = 29998;
const BACKEND_PORT = 29999;
const MOCK_PORT = 29990;
// The display's charging key in mock mode. Open http://localhost:9000/#chargeKey=dev once to store it.
const MOCK_CHARGE_KEY = 'dev';

const children: Subprocess[] = [];

const stopAll = (code: number) => {
  for (const child of children) {
    child.kill();
  }
  process.exit(code);
};

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));

// If any part dies, stop the rest rather than leave a half-working setup.
const start = (name: string, cmd: string[], env: Record<string, string | undefined> = {}) => {
  const child = Bun.spawn(cmd, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: ['inherit', 'inherit', 'inherit'],
    onExit: (_proc, exitCode) => {
      console.error(`[dev] ${name} exited${exitCode ? ` with code ${exitCode}` : ''}, stopping`);
      stopAll(exitCode ?? 1);
    },
  });
  children.push(child);
  return child;
};

const waitForPort = async (port: number, timeoutMs = 15000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const socket = await Bun.connect({ hostname: '127.0.0.1', port, socket: { data() {} } });
      socket.end();
      return;
    }
    catch {
      await Bun.sleep(200);
    }
  }
  throw new Error(`Nothing listening on port ${port} after ${timeoutMs / 1000}s`);
};

// A strict port, so a leftover dev server is an error rather than a second UI on 9001 talking to who knows what.
const startVite = (apiTarget: string) =>
  start('vite', ['bunx', '--bun', 'vite', '--strictPort'], { API_TARGET: apiTarget });

const remote = async () => {
  start('ssh tunnel', [
    'ssh', '-N',
    '-o', 'ExitOnForwardFailure=yes',
    '-o', 'ServerAliveInterval=30',
    '-L', `${TUNNEL_PORT}:127.0.0.1:${BACKEND_PORT}`,
    REMOTE_HOST,
  ]);
  await waitForPort(TUNNEL_PORT);
  console.log(`[dev] tunnelled to the backend on ${REMOTE_HOST}. This is the real system: approving`
    + ' charging starts the real charger.');
  startVite(`http://127.0.0.1:${TUNNEL_PORT}`);
};

const mock = async () => {
  // Fresh state files each run, away from the real ones in ~/.config.
  const stateDir = path.join(ROOT, 'node_modules', '.tmp', 'dev-mock');
  rmSync(stateDir, { recursive: true, force: true });
  mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  const smartcarFile = path.join(stateDir, 'smartcar-state.json');
  writeFileSync(smartcarFile, JSON.stringify({ percent: 52, updatedAt: new Date().toISOString() }));
  // Already expired, so the first call exercises the refresh against the fake Easee.
  const easeeTokenFile = path.join(stateDir, 'easee-tokens.json');
  writeFileSync(easeeTokenFile, JSON.stringify({ accessToken: 'x', refreshToken: 'x', accessTokenExpiresAt: 0 }));

  startMockUpstreams(MOCK_PORT);
  const upstream = `http://127.0.0.1:${MOCK_PORT}`;
  console.log(`[dev] fake upstreams on ${upstream}. Change them with: curl ${upstream}/_mock -d '{"soc": 95}'`);

  // Every secret and endpoint is set here, so nothing from a real .env can reach a real service.
  start('backend', ['bun', '--watch', 'server/index.ts'], {
    FOXCLOUD_API_ROOT: upstream,
    FOXCLOUD_API_KEY: 'mock',
    FOXCLOUD_SN: 'MOCK',
    EASEE_API_ROOT: upstream,
    EASEE_CHARGER_ID: MOCK_CHARGER_ID,
    EASEE_TOKEN_FILE: easeeTokenFile,
    HA_URL: upstream,
    HA_TOKEN: 'mock',
    HEATING_STATE_FILE: path.join(stateDir, 'heating-state.json'),
    SMARTCAR_STATE_FILE: smartcarFile,
    SMARTCAR_WEBHOOK_ID: 'mock',
    SMART_CAR_CLIENT_ID: 'mock',
    SMART_CAR_CLIENT_SECRET: 'mock',
    SMART_CAR_MANAGEMENT_KEY: 'mock',
    OCTOPUS_API_KEY: 'mock',
    CHARGE_START_KEY: MOCK_CHARGE_KEY,
  });
  await waitForPort(BACKEND_PORT);
  console.log(`[dev] open http://localhost:9000/#chargeKey=${MOCK_CHARGE_KEY} once to be able to approve charging`);
  startVite(`http://127.0.0.1:${BACKEND_PORT}`);
};

const modes: Record<string, () => Promise<void>> = { remote, mock };
const mode = modes[process.argv[2] ?? ''];
if (!mode) {
  console.error('Usage: bun server/dev/index.ts <remote|mock>');
  process.exit(1);
}
mode().catch((err: unknown) => {
  console.error('[dev]', err);
  stopAll(1);
});
