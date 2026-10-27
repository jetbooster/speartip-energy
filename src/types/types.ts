export interface ChargerStatus {
  carConnected: boolean;
  carAwaitingAuthorization: boolean;
  isOnline: boolean;
  // Easee chargerOpMode: 1 Disconnected, 2 AwaitingStart, 3 Charging, 4 Completed,
  // 5 Error, 6 ReadyToCharge, 7 AwaitingAuthorization
  chargerOpMode: number | null;
  // Current actually flowing to the car, in amps.
  outputCurrent: number | null;
  // Current limit the charger is set to, in amps.
  dynamicChargerCurrent: number | null;
  // Power being drawn, in kW.
  totalPower: number | null;
}

export interface ValuesResponse {
  solar: number;
  usage: number;
  grid: number;
  batteryCharge: number;
  batteryPower: number;
  price: number;
  // Car state of charge from Smartcar, null until the first webhook ever received. Persisted across restarts.
  carChargeLevel: number | null;
  carChargeLevelUpdatedAt: string | null;
  // Null when the Easee lookup failed, so the rest of the dashboard still loads.
  charger: ChargerStatus | null;
}

export interface SmartCarWebhookBase {
  eventId: string;
  eventType: string;
  data: Record<string, unknown>;
}

export interface SmartCarBatteryWebhook extends SmartCarWebhookBase {
  eventType: 'VEHICLE_STATE';
  data: {
    user: {
      id: string;
      externalId: string;
    }
    vehicle: {
      id: string;
      make: string;
      model: string;
    }
    signals:[
      {
        code: "tractionbattery-stateofcharge";
        name: "StateOfCharge";
        group: "TractionBattery";
        body:{
          value: number;
          unit: "percent";
        }
      }
    ]
  }
}

export interface SmartCarWebhookVerify extends SmartCarWebhookBase {
  eventType: 'VERIFY';
  data: {
    challenge: string;
  }
}

export type SmartCarWebhook = SmartCarBatteryWebhook | SmartCarWebhookVerify;