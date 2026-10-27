import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import type { SmartCarWebhook } from "../../src/types/types";

interface StateOfCharge {
  percent: number;
  // When this server received the webhook, not when the car measured it.
  updatedAt: string;
}

// Lives outside the repo and survives reboots. Override with SMARTCAR_STATE_FILE.
const STATE_FILE = process.env.SMARTCAR_STATE_FILE
  ?? path.join(homedir(), '.config', 'speartip-energy', 'smartcar-state.json');

const loadStateOfCharge = (): StateOfCharge | null => {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8')) as StateOfCharge;
  }
  catch {
    // No file yet, or unreadable. Start with no reading.
    return null;
  }
};

const saveStateOfCharge = (state: StateOfCharge) => {
  try {
    mkdirSync(path.dirname(STATE_FILE), { recursive: true, mode: 0o700 });
    // Write then rename so a crash mid-write can't leave a truncated file behind.
    const tmp = `${STATE_FILE}.tmp`;
    writeFileSync(tmp, JSON.stringify(state), { mode: 0o600 });
    renameSync(tmp, STATE_FILE);
  }
  catch (err) {
    console.error('Failed to persist SmartCar state of charge', err);
  }
};

// Restored from disk so the last-known charge level survives a restart.
let latestStateOfCharge: StateOfCharge | null = loadStateOfCharge();

export const getStateOfCharge = (): StateOfCharge | null => latestStateOfCharge;

export const webhookHandler = async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  const { eventType, data } = await req.json() as SmartCarWebhook;
  switch (eventType) {
    case 'VEHICLE_STATE': {
      const signal = data.signals.find(s => s.code === 'tractionbattery-stateofcharge');
      if (signal) {
        latestStateOfCharge = { percent: signal.body.value, updatedAt: new Date().toISOString() };
        saveStateOfCharge(latestStateOfCharge);
        console.log(`SmartCar vehicle state updated for ${data.vehicle.id}: ${signal.body.value}%`);
      }
      return new Response('OK');
    }
    case 'VERIFY': {
      console.log(`SmartCar webhook verification challenge: ${data.challenge}`);
      const hasher = new Bun.CryptoHasher('sha256', process.env.SMART_CAR_MANAGEMENT_KEY!);
      hasher.update(data.challenge);
      const hash = hasher.digest('hex');
      return Response.json({ challenge: hash }, { status: 200 });

    }
    default: {
      console.warn(`Unknown SmartCar webhook event type: ${eventType}`);
      return new Response('Unknown event type', { status: 400 });
    }

  }

}