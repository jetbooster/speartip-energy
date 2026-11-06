import { freshImport, silenceConsole } from '../test/setup';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import { rmSync } from 'node:fs';

type SmartCar = typeof import('./index');

const STATE_FILE = process.env.SMARTCAR_STATE_FILE as string;

const webhook = (body: object, method = 'POST') => new Request('http://localhost/webhook/smartcar/battery', {
  method,
  body: method === 'POST' ? JSON.stringify(body) : undefined,
});

const batteryEvent = (percent: number, webhookId = 'test-webhook-id', code = 'tractionbattery-stateofcharge') => ({
  eventType: 'VEHICLE_STATE',
  meta: { webhookId },
  data: { vehicle: { id: 'car' }, signals: [{ code, body: { value: percent } }] },
});

let smartcar: SmartCar;

beforeEach(async () => {
  silenceConsole();
  rmSync(STATE_FILE, { force: true });
  smartcar = await freshImport<SmartCar>('../smartcar/index');
});

afterEach(() => {
  mock.restore();
});

describe('battery events', () => {
  test('records the charge level and when it arrived', async () => {
    const before = Date.now();
    expect((await smartcar.webhookHandler(webhook(batteryEvent(55)))).status).toBe(200);
    const state = smartcar.getStateOfCharge();
    expect(state?.percent).toBe(55);
    expect(Date.parse(state?.updatedAt as string)).toBeGreaterThanOrEqual(before);
  });

  test('the last reading survives a restart', async () => {
    await smartcar.webhookHandler(webhook(batteryEvent(55)));
    const restarted = await freshImport<SmartCar>('../smartcar/index');
    expect(restarted.getStateOfCharge()?.percent).toBe(55);
  });

  test('starts with no reading when the saved file is corrupt', async () => {
    await Bun.write(STATE_FILE, '{not json');
    const restarted = await freshImport<SmartCar>('../smartcar/index');
    expect(restarted.getStateOfCharge()).toBeNull();
  });

  test('rejects an event with the wrong webhook ID and keeps the last reading', async () => {
    await smartcar.webhookHandler(webhook(batteryEvent(55)));
    expect((await smartcar.webhookHandler(webhook(batteryEvent(1, 'someone-else')))).status).toBe(400);
    expect(smartcar.getStateOfCharge()?.percent).toBe(55);
  });

  test('ignores events that carry other signals', async () => {
    expect((await smartcar.webhookHandler(webhook(batteryEvent(1, undefined, 'location')))).status).toBe(200);
    expect(smartcar.getStateOfCharge()).toBeNull();
  });
});

test('answers the verification challenge with an HMAC of it, keyed by the management key', async () => {
  const res = await smartcar.webhookHandler(webhook({ eventType: 'VERIFY', meta: {}, data: { challenge: 'abc' } }));
  const expected = createHmac('sha256', 'test-management-key').update('abc').digest('hex');
  expect(await res.json()).toEqual({ challenge: expected });
});

test('rejects unknown event types and non-POST requests', async () => {
  expect((await smartcar.webhookHandler(webhook({ eventType: 'OTHER', meta: {}, data: {} }))).status).toBe(400);
  expect((await smartcar.webhookHandler(webhook({}, 'GET'))).status).toBe(405);
});
