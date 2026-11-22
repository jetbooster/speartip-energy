import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { getValues } from '../foxcloud';
import { callService, getState, isConfigured } from '../homeassistant';

// Heat with the AC units (air-to-air heat pumps) when electricity is cheap: either the overnight rate or a
// battery full of solar. At a winter COP of ~2 that beats gas, but at the peak rate it doesn't, so the job
// also switches its units off again once neither condition holds.

export const TARGET_TEMPERATURE = 19;
export const BATTERY_FULL_PERCENT = 90;
// Once heating from the battery, keep going until it drops below this. On a dull day the ACs can draw more than
// the panels make, and a single threshold would switch them on and off every half hour.
export const BATTERY_STOP_PERCENT = 80;
// Battery heating only starts while the panels are producing, so a battery charged overnight at 05:30
// isn't spent on heat (and doesn't wake the main bedroom).
export const SOLAR_START_KW = 0.5;

interface AcUnit {
  entityId: string;
  /** We sleep better slightly cooler, so this one is left off on the overnight rate. */
  skipOvernight?: boolean;
}

export const AC_UNITS: AcUnit[] = [
  { entityId: 'climate.lounge' },
  { entityId: 'climate.bedroom', skipOvernight: true },
  { entityId: 'climate.guest_bedroom' },
];

// Overnight rate, 23:30-05:30 UK time.
const CHEAP_START_MINUTES = 23 * 60 + 30;
const CHEAP_END_MINUTES = 5 * 60 + 30;

const CHECK_INTERVAL_MS = 30 * 60 * 1000;
// Run a few seconds after each :00/:30 so a timer that fires early still lands inside the new half hour.
const CHECK_OFFSET_MS = 5000;

const londonClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export const isCheapRate = (now: Date) => {
  const [hours, minutes] = londonClock.format(now).split(':').map(Number);
  const m = hours * 60 + minutes;
  return m >= CHEAP_START_MINUTES || m < CHEAP_END_MINUTES;
};

export const shouldHeatFromBattery = ({ batteryPercent, solarKw }: Readings, alreadyHeating: boolean) =>
  alreadyHeating
    ? batteryPercent >= BATTERY_STOP_PERCENT
    : batteryPercent >= BATTERY_FULL_PERCENT && solarKw > SOLAR_START_KW;

export const wantedUnits = (cheapRate: boolean, batteryHeating: boolean): Set<string> => {
  if (cheapRate) {
    return new Set(AC_UNITS.filter(u => !u.skipOvernight).map(u => u.entityId));
  }
  if (batteryHeating) {
    return new Set(AC_UNITS.map(u => u.entityId));
  }
  return new Set();
};

// `owned`: units this job switched on, so it may switch them off again.
// `handsOff`: units someone changed by hand while we owned them. Left alone until the current heating
// period ends, so we don't fight a person who turned one off.
// `batteryHeating`: whether we're heating from a full battery, which decides the threshold for carrying on.
interface HeatingState {
  owned: string[];
  handsOff: string[];
  batteryHeating?: boolean;
}

// Lives outside the repo and survives reboots. Override with HEATING_STATE_FILE.
const STATE_FILE = process.env.HEATING_STATE_FILE
  ?? path.join(homedir(), '.config', 'speartip-energy', 'heating-state.json');

const readState = (): HeatingState => {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8')) as HeatingState;
  }
  catch {
    return { owned: [], handsOff: [] };
  }
};

const writeState = (state: HeatingState) => {
  mkdirSync(path.dirname(STATE_FILE), { recursive: true, mode: 0o700 });
  // Write then rename so a crash mid-write can't leave a truncated file behind.
  const tmp = `${STATE_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(state), { mode: 0o600 });
  renameSync(tmp, STATE_FILE);
};

const isStillOurs = (state: string, attributes: Record<string, unknown>) =>
  state === 'heat' && Number(attributes.temperature) === TARGET_TEMPERATURE;

interface Readings {
  batteryPercent: number;
  solarKw: number;
}

const getReadings = async (): Promise<Readings | null> => {
  try {
    const values = await getValues();
    return { batteryPercent: values.SoC.value, solarKw: values.pvPower.value };
  }
  catch (err) {
    console.error('Heating: failed to read battery and solar', err);
    return null;
  }
};

export const runHeatingCheck = async (now = new Date()) => {
  const cheapRate = isCheapRate(now);
  const readings = await getReadings();
  if (!cheapRate && readings === null) {
    // Without the readings we can't tell whether to heat, so change nothing until next time.
    return;
  }
  const saved = readState();
  // The overnight rate takes over from the battery; next morning starts afresh from the 90% threshold.
  const batteryHeating = !cheapRate && readings !== null
    && shouldHeatFromBattery(readings, saved.batteryHeating ?? false);
  const batteryPercent = readings?.batteryPercent;
  const wanted = wantedUnits(cheapRate, batteryHeating);
  const owned = new Set(saved.owned);
  const handsOff = new Set(saved.handsOff);

  for (const { entityId } of AC_UNITS) {
    try {
      if (!wanted.has(entityId)) {
        handsOff.delete(entityId);
        if (owned.has(entityId)) {
          const { state, attributes } = await getState(entityId);
          if (isStillOurs(state, attributes)) {
            await callService('climate', 'turn_off', { entity_id: entityId });
            console.log(`Heating: turned off ${entityId}`);
          }
          owned.delete(entityId);
        }
        continue;
      }
      if (handsOff.has(entityId)) {
        continue;
      }
      const { state, attributes } = await getState(entityId);
      if (owned.has(entityId)) {
        if (!isStillOurs(state, attributes)) {
          console.log(`Heating: ${entityId} was changed by hand, leaving it alone`);
          owned.delete(entityId);
          handsOff.add(entityId);
        }
        continue;
      }
      // Only take over a unit that's off. One already running was set up by someone on purpose.
      if (state === 'off') {
        await callService('climate', 'set_temperature', {
          entity_id: entityId,
          hvac_mode: 'heat',
          temperature: TARGET_TEMPERATURE,
        });
        owned.add(entityId);
        console.log(`Heating: heating with ${entityId} to ${TARGET_TEMPERATURE}°C`
          + ` (${cheapRate ? 'overnight rate' : `battery ${batteryPercent}%`})`);
      }
    }
    catch (err) {
      console.error(`Heating: failed to update ${entityId}`, err);
    }
  }

  writeState({ owned: [...owned], handsOff: [...handsOff], batteryHeating });
};

export const msUntilNextCheck = (now: number) =>
  CHECK_INTERVAL_MS - (now % CHECK_INTERVAL_MS) + CHECK_OFFSET_MS;

// Checks once at startup, then every :00 and :30. UK offsets are whole hours, so UTC half hours line up.
export const startHeatingSchedule = () => {
  if (!isConfigured()) {
    console.log('Heating schedule disabled: set HA_URL and HA_TOKEN to enable it');
    return;
  }
  const tick = async () => {
    try {
      await runHeatingCheck();
    }
    catch (err) {
      console.error('Heating check failed', err);
    }
    setTimeout(tick, msUntilNextCheck(Date.now()));
  };
  void tick();
};
