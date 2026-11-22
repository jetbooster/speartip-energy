// Minimal Home Assistant REST client. Needs HA_URL (e.g. http://192.168.1.135:8123) and HA_TOKEN
// (a long-lived access token: HA profile -> Security -> Long-lived access tokens).

const HA_URL = process.env.HA_URL?.replace(/\/$/, '');
const { HA_TOKEN } = process.env;

export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
}

export const isConfigured = () => Boolean(HA_URL && HA_TOKEN);

const request = async (method: 'GET' | 'POST', path: string, body?: object) => {
  if (!isConfigured()) {
    throw new Error('Home Assistant is not configured. Set HA_URL and HA_TOKEN.');
  }
  const res = await fetch(`${HA_URL}${path}`, {
    method,
    headers: { 'Authorization': `Bearer ${HA_TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    throw new Error(`Home Assistant ${method} ${path} returned HTTP ${res.status}`);
  }
  return res;
};

export const getState = async (entityId: string): Promise<HassEntity> =>
  (await request('GET', `/api/states/${entityId}`)).json() as Promise<HassEntity>;

export const callService = async (domain: string, service: string, data: Record<string, unknown>) => {
  await request('POST', `/api/services/${domain}/${service}`, data);
};
