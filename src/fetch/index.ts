import { ValuesResponse } from '@/types/types';

export const fetchValues = async (): Promise<ValuesResponse> => {
  return (await fetch('/api/values')).json();
};
