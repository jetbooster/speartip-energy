import type { HeatingStatus, WeatherStatus } from '../../src/types/types';
import { cached } from '../cache';
import { AC_UNITS } from '../heating';
import { getAllStates, isConfigured, type HassEntity } from '../homeassistant';

const WEATHER_ENTITY = 'weather.home';
// Nest thermostats for the gas boiler. The living room one is the indoor temperature shown on the dashboard.
const LIVING_ROOM_THERMOSTAT = 'climate.living_room_living_room';
const GAS_THERMOSTATS = [LIVING_ROOM_THERMOSTAT, 'climate.entryway_entryway'];

export interface HomeStatus {
  weather: WeatherStatus | null;
  heating: HeatingStatus | null;
}

const NO_STATUS: HomeStatus = { weather: null, heating: null };

const finite = (value: unknown): number | null => {
  const n = Number(value);
  return value === null || value === undefined || !Number.isFinite(n) ? null : n;
};

export const readWeather = (entity: HassEntity | undefined): WeatherStatus | null => {
  const temperature = finite(entity?.attributes.temperature);
  if (!entity || temperature === null) {
    return null;
  }
  return {
    temperature,
    cloudCover: finite(entity.attributes.cloud_coverage) ?? 0,
    condition: entity.state,
  };
};

export const readHeating = (byId: Map<string, HassEntity>): HeatingStatus => ({
  indoorTemperature: finite(byId.get(LIVING_ROOM_THERMOSTAT)?.attributes.current_temperature),
  gasHeating: GAS_THERMOSTATS.some(id => byId.get(id)?.attributes.hvac_action === 'heating'),
  acUnitsHeating: AC_UNITS.filter(({ entityId }) => byId.get(entityId)?.state === 'heat').length,
});

const fetchHomeStatus = async (): Promise<HomeStatus> => {
  const byId = new Map((await getAllStates()).map(entity => [entity.entity_id, entity]));
  return { weather: readWeather(byId.get(WEATHER_ENTITY)), heating: readHeating(byId) };
};

// The forecast and thermostats change slowly, so one read a minute is plenty for every display.
const getCachedHomeStatus = cached(fetchHomeStatus, 60 * 1000);

// Never throws, so the rest of the dashboard still loads without Home Assistant.
export const getHomeStatus = async (): Promise<HomeStatus> => {
  if (!isConfigured()) {
    return NO_STATUS;
  }
  try {
    return await getCachedHomeStatus();
  }
  catch (err) {
    console.error('Failed to read Home Assistant status', err);
    return NO_STATUS;
  }
};
