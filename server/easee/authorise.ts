import { createHash, timingSafeEqual } from 'node:crypto';
import { getChargingStatus, startCharging } from './index';

// Shared secret the wall display sends. Unset means the endpoint is disabled.
const { CHARGE_START_KEY } = process.env;

// Stops repeated taps from sending repeated start commands to Easee.
const COOLDOWN_MS = 30 * 1000;

let lastAttemptAt = 0;
let inFlight = false;

const digest = (value: string) => createHash('sha256').update(value).digest();

// Compares digests so the check takes the same time whatever the key is.
const keyMatches = (given: string | null): boolean => {
  if (!CHARGE_START_KEY || given === null) {
    return false;
  }
  return timingSafeEqual(digest(given), digest(CHARGE_START_KEY));
};

export const authoriseChargingHandler = async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  if (!CHARGE_START_KEY) {
    return new Response('Not Found', { status: 404 });
  }
  // Browsers mark requests started by other websites. Reject those outright.
  if (req.headers.get('sec-fetch-site') === 'cross-site') {
    return new Response('Forbidden', { status: 403 });
  }
  if (!keyMatches(req.headers.get('x-charge-key'))) {
    console.warn('Rejected charging authorisation: missing or wrong key');
    return new Response('Forbidden', { status: 403 });
  }
  if (inFlight || Date.now() - lastAttemptAt < COOLDOWN_MS) {
    return Response.json({ error: 'Too many requests' }, { status: 429 });
  }

  lastAttemptAt = Date.now();
  inFlight = true;
  try {
    // Checked against Easee now, not against whatever the display last showed.
    const status = await getChargingStatus();
    if (!status.carAwaitingAuthorization) {
      return Response.json({ error: 'Car is not awaiting authorisation' }, { status: 409 });
    }
    await startCharging();
    console.log('Charging authorised from display');
    return Response.json({ ok: true });
  }
  catch (err) {
    console.error('Failed to authorise charging', err);
    return Response.json({ error: 'Upstream request failed' }, { status: 502 });
  }
  finally {
    inFlight = false;
  }
};
