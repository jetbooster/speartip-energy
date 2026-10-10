export interface FullRate {
  value_exc_vat: number;
  value_inc_vat: number;
  valid_from: string;
  valid_to: string;
}

export type RatesResponse = Paged<FullRate[]>;

export interface Paged<T> {
  count: number;
  next: string; // url
  previous: string; // url
  results: T;
}
