import type { ValuesResponse } from '@/types/types';

export const fetchValues = async (): Promise<ValuesResponse> => {
  const res = await fetch('/api/values');
  if (!res.ok) {
    throw new Error(`Values request failed with status ${res.status}`);
  }
  return res.json();
};

// Returns the HTTP status so the caller can explain refusals. Throws only if the server can't be reached.
export const authoriseCharging = async (key: string): Promise<number> => {
  const res = await fetch('/api/charging/authorise', {
    method: 'POST',
    headers: { 'X-Charge-Key': key },
  });
  return res.status;
};
