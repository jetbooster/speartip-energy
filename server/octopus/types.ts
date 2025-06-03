export interface FullRate {
  value_exc_vat: number;
  value_inc_vat: number;
  valid_from: string;
  valid_to: string;
}

// {valid_from: value_inc_vat}
export type Rate = Record<string, number>;

export interface AccountsResponse {
  // account number
  number: string;
  // other irrelevant items
  properties:
  {
    address_line_1: string;
    address_line_2: string;
    address_line_3: string;
    town: string;
    county: string;
    postcode: string;
    electricity_meter_points:
    {
      // other irrelevant items
      tariff_code: string;
      mpan: string;
      agreements: {
        tariff_code: string;
        valid_from: string; // noMillis ISO
        valid_to: string; // noMillis ISO
      }[];
    }[];

  }[];
}

export interface KrakenAuthResponse {
  data: {
    obtainKrakenToken: {
      token: string;
    };
  };
}

export type RatesResponse = Paged<FullRate[]>;

export interface Paged<T> {
  count: number;
  next: string; // url
  previous: string; // url
  results: T;
}
