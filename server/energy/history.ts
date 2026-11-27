import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import type { EnergyDay, EnergySources } from '../../src/types/types';
import { cached } from '../cache';
import { addDays, type CalendarDay, dayKey, londonDay, londonHourOf } from '../calendar';
import { getCachedTodayHourly, getHourly } from '../foxcloud';
import { energySources } from './index';

// Today and the days before it, oldest first.
export const HISTORY_DAYS = 7;
// Finished days are kept this long, then dropped.
const KEEP_DAYS = 31;
// FoxCloud's hourly report lags by an hour or so, so yesterday isn't kept until its last hour has surely landed.
const YESTERDAY_FINAL_AFTER_HOUR = 2;

// A finished day never changes, so each is fetched from FoxCloud once and kept here. Lives outside the repo
// and survives reboots. Override with ENERGY_HISTORY_FILE.
const HISTORY_FILE = process.env.ENERGY_HISTORY_FILE
  ?? path.join(homedir(), '.config', 'speartip-energy', 'energy-history.json');

type Stored = Record<string, EnergySources>;

const readStored = (): Stored => {
  try {
    return JSON.parse(readFileSync(HISTORY_FILE, 'utf8')) as Stored;
  }
  catch {
    return {};
  }
};

const writeStored = (stored: Stored) => {
  mkdirSync(path.dirname(HISTORY_FILE), { recursive: true, mode: 0o700 });
  // Write then rename so a crash mid-write can't leave a truncated file behind.
  const tmp = `${HISTORY_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(stored), { mode: 0o600 });
  renameSync(tmp, HISTORY_FILE);
};

const fetchDay = async (day: CalendarDay): Promise<EnergySources | null> => {
  try {
    return energySources(await getHourly(day));
  }
  catch (err) {
    console.error(`Failed to fetch FoxCloud report for ${dayKey(day)}`, err);
    return null;
  }
};

export const getEnergyHistory = async (now = new Date()): Promise<EnergyDay[]> => {
  const today = londonDay(now);
  const stored = readStored();
  let changed = false;
  const days: EnergyDay[] = [];

  for (let back = HISTORY_DAYS - 1; back >= 1; back--) {
    const day = addDays(today, -back);
    const date = dayKey(day);
    let sources: EnergySources | null = stored[date] ?? null;
    if (!sources) {
      // One at a time: a first load fetches up to six days, and FoxCloud limits calls per key.
      sources = await fetchDay(day);
      const final = back > 1 || londonHourOf(now) >= YESTERDAY_FINAL_AFTER_HOUR;
      if (sources && final) {
        stored[date] = sources;
        changed = true;
      }
    }
    days.push({ date, sources });
  }

  // Today shares the dashboard's cache, so opening the chart costs no extra call for it.
  let todaySources: EnergySources | null = null;
  try {
    todaySources = energySources(await getCachedTodayHourly());
  }
  catch (err) {
    console.error('Failed to fetch FoxCloud report for today', err);
  }
  days.push({ date: dayKey(today), sources: todaySources });

  const oldest = dayKey(addDays(today, -KEEP_DAYS));
  for (const date of Object.keys(stored)) {
    if (date < oldest) {
      delete stored[date];
      changed = true;
    }
  }
  if (changed) {
    try {
      writeStored(stored);
    }
    catch (err) {
      console.error('Failed to save energy history', err);
    }
  }
  return days;
};

// Several displays opening the chart together share one lookup.
export const getCachedEnergyHistory = cached(() => getEnergyHistory(), 60 * 1000);
