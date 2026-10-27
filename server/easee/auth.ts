import { chmod, mkdir, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import type { UserToken } from './types';

const API_ROOT = 'https://api.easee.com';

// Refresh this long before the access token expires so a request never races the expiry.
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

// Lives outside the repo and survives reboots. Override with EASEE_TOKEN_FILE.
export const TOKEN_FILE = process.env.EASEE_TOKEN_FILE
  ?? path.join(homedir(), '.config', 'speartip-energy', 'easee-tokens.json');

interface StoredTokens {
  accessToken: string;
  accessTokenExpiresAt: number;
  refreshToken: string;
}

const readTokens = async (): Promise<StoredTokens | null> => {
  const file = Bun.file(TOKEN_FILE);
  if (!await file.exists()) {
    return null;
  }
  return file.json() as Promise<StoredTokens>;
};

const writeTokens = async (tokens: StoredTokens) => {
  await mkdir(path.dirname(TOKEN_FILE), { recursive: true, mode: 0o700 });
  // Write then rename so a crash mid-write can't leave a truncated token file behind.
  const tmp = `${TOKEN_FILE}.tmp`;
  await writeFile(tmp, JSON.stringify(tokens, null, 2), { mode: 0o600 });
  await chmod(tmp, 0o600);
  await rename(tmp, TOKEN_FILE);
};

const requestTokens = async (endpoint: string, body: object): Promise<UserToken> => {
  const res = await fetch(`${API_ROOT}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    throw new Error(`Easee ${endpoint} returned HTTP ${res.status}`);
  }
  return res.json() as Promise<UserToken>;
};

// Easee may rotate the refresh token on every refresh, so always persist the one that comes back.
const toStored = (token: UserToken, previousRefreshToken?: string): StoredTokens => {
  const refreshToken = token.refreshToken ?? previousRefreshToken;
  if (!token.accessToken || !refreshToken) {
    throw new Error('Easee returned no tokens');
  }
  return {
    accessToken: token.accessToken,
    accessTokenExpiresAt: Date.now() + token.expiresIn * 1000,
    refreshToken,
  };
};

// Used once by login.ts. The password is never stored; only the resulting tokens are.
export const loginWithPassword = async (userName: string, password: string) => {
  await writeTokens(toStored(await requestTokens('/api/accounts/login', { userName, password })));
};

const resolveAccessToken = async (force: boolean): Promise<string> => {
  const stored = await readTokens();
  if (!stored) {
    throw new Error(`No Easee tokens found at ${TOKEN_FILE}. Run: bun server/easee/login.ts <email>`);
  }
  if (!force && stored.accessTokenExpiresAt - Date.now() > REFRESH_MARGIN_MS) {
    return stored.accessToken;
  }
  const tokens = toStored(
    await requestTokens('/api/accounts/refresh_token', { refreshToken: stored.refreshToken }),
    stored.refreshToken,
  );
  await writeTokens(tokens);
  return tokens.accessToken;
};

// Concurrent callers share one refresh, so we never spend the refresh token twice.
let inFlight: Promise<string> | null = null;

export const getAccessToken = (force = false): Promise<string> => {
  inFlight ??= resolveAccessToken(force).finally(() => {
    inFlight = null;
  });
  return inFlight;
};
