export interface FoxCloudResponse<T> {
  errno: number;
  result: T;
}

export type DeviceQueryResponse = FoxCloudResponse<DeviceQueryBody[]>;

export interface DeviceQueryBody {
  deviceSN: string;
  datas: {
    variable: string;
    unit: string;
    name: string;
    value: number;
  }[];
}

// One entry per variable. With dimension 'day', `values` has one total per hour, starting at midnight.
export type ReportQueryResponse = FoxCloudResponse<{
  variable: string;
  unit: string;
  values: number[];
}[]>;
