import { HOUR_MS, mockFetch, readTokens, requests, sent, silenceConsole, TEST_DIR, writeTokens } from '../test/setup';
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { readdirSync, rmSync, statSync } from 'node:fs';
import { getAccessToken, keepTokensFresh, TOKEN_FILE } from './auth';

const REFRESH = 'POST /api/accounts/refresh_token';
const MARGIN_MS = 5 * 60 * 1000;

const refreshReturns = (body: object) => mockFetch({ [REFRESH]: () => Response.json(body) });
const newTokens = { accessToken: 'new-access', refreshToken: 'new-refresh', expiresIn: 3600 };

beforeEach(() => {
  rmSync(TOKEN_FILE, { force: true });
  mockFetch();
  silenceConsole();
});

afterEach(() => {
  mock.restore();
});

test('uses a temporary token file, never the real one', () => {
  expect(TOKEN_FILE.startsWith(TEST_DIR)).toBe(true);
});

describe('getAccessToken', () => {
  test('returns a fresh stored token without calling Easee', async () => {
    await writeTokens(HOUR_MS);
    expect(await getAccessToken()).toBe('old-access');
    expect(requests).toHaveLength(0);
  });

  test('refreshes a token that is inside the expiry margin, spending the stored refresh token', async () => {
    await writeTokens(MARGIN_MS - 1000);
    refreshReturns(newTokens);
    expect(await getAccessToken()).toBe('new-access');
    expect(JSON.parse(sent(REFRESH)[0]?.body as string)).toEqual({ refreshToken: 'old-refresh' });
  });

  test('persists a rotated refresh token and the new expiry', async () => {
    await writeTokens(0);
    refreshReturns(newTokens);
    const before = Date.now();
    await getAccessToken();
    const stored = await readTokens();
    expect(stored.accessToken).toBe('new-access');
    expect(stored.refreshToken).toBe('new-refresh');
    expect(stored.accessTokenExpiresAt).toBeGreaterThanOrEqual(before + 3600 * 1000);
  });

  test('keeps the existing refresh token when Easee does not send a new one', async () => {
    await writeTokens(0);
    refreshReturns({ accessToken: 'new-access', refreshToken: null, expiresIn: 3600 });
    await getAccessToken();
    expect((await readTokens()).refreshToken).toBe('old-refresh');
  });

  test('force refreshes even when the stored token looks fresh', async () => {
    await writeTokens(HOUR_MS);
    refreshReturns(newTokens);
    expect(await getAccessToken(true)).toBe('new-access');
  });

  test('concurrent callers share a single refresh', async () => {
    await writeTokens(0);
    refreshReturns(newTokens);
    const tokens = await Promise.all([getAccessToken(), getAccessToken(), getAccessToken()]);
    expect(tokens).toEqual(['new-access', 'new-access', 'new-access']);
    expect(sent(REFRESH)).toHaveLength(1);
  });

  test('a failed refresh keeps the stored tokens, and the next call retries', async () => {
    await writeTokens(0);
    mockFetch({
      [REFRESH]: call => call === 0 ? new Response('nope', { status: 500 }) : Response.json(newTokens),
    });
    await expect(getAccessToken()).rejects.toThrow('HTTP 500');
    expect((await readTokens()).refreshToken).toBe('old-refresh');
    expect(await getAccessToken()).toBe('new-access');
  });

  test('a refresh response with no access token does not overwrite the stored tokens', async () => {
    await writeTokens(0);
    refreshReturns({ accessToken: null, refreshToken: 'new-refresh', expiresIn: 3600 });
    await expect(getAccessToken()).rejects.toThrow('no tokens');
    expect((await readTokens()).refreshToken).toBe('old-refresh');
  });

  test('with no token file, explains how to log in and does not call Easee', async () => {
    await expect(getAccessToken()).rejects.toThrow('login.ts');
    expect(requests).toHaveLength(0);
  });

  test('saves tokens readable only by the owner and leaves no temp file behind', async () => {
    await writeTokens(0);
    refreshReturns(newTokens);
    await getAccessToken();
    expect(statSync(TOKEN_FILE).mode & 0o777).toBe(0o600);
    expect(readdirSync(TEST_DIR).filter(f => f.endsWith('.tmp'))).toEqual([]);
  });
});

describe('keepTokensFresh', () => {
  // Captures the delay of the next refresh instead of actually waiting for it.
  const nextDelay = async () => {
    const timer = spyOn(globalThis, 'setTimeout').mockImplementation((() => 0) as never);
    keepTokensFresh();
    while (timer.mock.calls.length === 0) {
      await Bun.sleep(1);
    }
    return timer.mock.calls[0]?.[1] as number;
  };

  test('schedules the next refresh for when the token enters the expiry margin', async () => {
    await writeTokens(HOUR_MS);
    const delay = await nextDelay();
    expect(delay).toBeGreaterThan(HOUR_MS - MARGIN_MS - 5000);
    expect(delay).toBeLessThanOrEqual(HOUR_MS - MARGIN_MS);
  });

  test('retries after 5 minutes when a refresh fails', async () => {
    await writeTokens(0);
    mockFetch({ [REFRESH]: () => new Response('nope', { status: 500 }) });
    expect(await nextDelay()).toBe(MARGIN_MS);
  });

  test('never schedules a tight loop, even if Easee issues very short tokens', async () => {
    await writeTokens(0);
    refreshReturns({ ...newTokens, expiresIn: 60 });
    expect(await nextDelay()).toBe(1000);
  });
});
