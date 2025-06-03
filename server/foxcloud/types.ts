export interface HourMin {
  hour: number;
  minute: number;
}

export interface BatteryChargeBody {
  sn: string;
  enable1: boolean;
  enable2: boolean;
  startTime1: HourMin;
  endTime1: HourMin;
  startTime2: HourMin;
  endTime2: HourMin;
}

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
