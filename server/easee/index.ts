import type { ChargerStatus } from '../../src/types/types';
import { getAccessToken } from './auth';
import type { ChargerState, OpMode, SiteDashboardState, SiteDTO } from './types';

const API_ROOT = 'https://api.easee.com';

const { EASEE_CHARGER_ID } = process.env;

// Modes where a car is plugged in. Error (5) is excluded because it can mean either.
const CAR_CONNECTED_MODES: OpMode[] = [2, 3, 4, 6, 7];

const send = (endpoint: string, init: RequestInit | undefined, accessToken: string) => fetch(`${API_ROOT}${endpoint}`, {
  ...init,
  headers: {
    ...init?.headers,
    Accept: 'application/json',
    Authorization: `Bearer ${accessToken}`,
  },
  signal: AbortSignal.timeout(5000),
});

const request = async <T>(endpoint: string, init?: RequestInit): Promise<T | undefined> => {
  let res = await send(endpoint, init, await getAccessToken());
  if (res.status === 401) {
    // Token was revoked or expired early. A 401 means the call was not executed, so retrying is safe.
    res = await send(endpoint, init, await getAccessToken(true));
  }
  if (!res.ok) {
    throw new Error(`Easee ${init?.method ?? 'GET'} ${endpoint} returned HTTP ${res.status}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) as T : undefined;
};

const requireChargerId = (): string => {
  if (!EASEE_CHARGER_ID) {
    throw new Error('EASEE_CHARGER_ID is not set');
  }
  return EASEE_CHARGER_ID;
};

let siteIdCache: Promise<number> | null = null;

const getSiteId = () => {
  siteIdCache ??= request<SiteDTO>(`/api/chargers/${requireChargerId()}/site`)
    .then((site) => {
      if (!site) {
        throw new Error('Easee returned no site for charger');
      }
      return site.id;
    })
    .catch((err: unknown) => {
      siteIdCache = null;
      throw err;
    });
  return siteIdCache;
};

export const getChargerState = async (): Promise<ChargerState> => {
  const siteId = await getSiteId();
  const dashboard = await request<SiteDashboardState>(`/api/sites/${siteId}/state`);
  const chargerId = requireChargerId();
  const state = dashboard?.circuitStates
    ?.flatMap(circuit => circuit.chargerStates ?? [])
    .find(charger => charger.chargerID === chargerId)
    ?.chargerState;
  if (!state) {
    throw new Error(`Charger ${chargerId} not found in site ${siteId} state`);
  }
  return state;
};

export const getChargingStatus = async (): Promise<ChargerStatus> => {
  const state = await getChargerState();
  return {
    carConnected: state.chargerOpMode !== null && CAR_CONNECTED_MODES.includes(state.chargerOpMode),
    carAwaitingAuthorization: state.chargerOpMode === 7,
    isOnline: state.isOnline,
    chargerOpMode: state.chargerOpMode,
    outputCurrent: state.outputCurrent,
    dynamicChargerCurrent: state.dynamicChargerCurrent,
    totalPower: state.totalPower,
  };
};

// Authorizes a charge. Only has an effect when the charger requires authorization and a car is plugged in.
export const startCharging = async () => {
  await request(`/api/chargers/${requireChargerId()}/commands/start_charging`, { method: 'POST' });
};

export const stopCharging = async () => {
  await request(`/api/chargers/${requireChargerId()}/commands/stop_charging`, { method: 'POST' });
};
