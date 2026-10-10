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
