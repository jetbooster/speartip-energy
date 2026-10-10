import type { ValuesResponse } from '@/types/types';

export const fetchValues = async (): Promise<ValuesResponse> => {
  const res = await fetch('/api/values');
  if (!res.ok) {
    throw new Error(`Values request failed with status ${res.status}`);
  }
  return res.json();
};
