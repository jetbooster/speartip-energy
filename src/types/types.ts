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

export interface WeatherStatus {
  // Outside, in °C.
  temperature: number;
  // Percent of the sky covered, 0-100.
  cloudCover: number;
  // Home Assistant's condition, e.g. 'sunny', 'partlycloudy', 'rainy', 'clear-night'.
  condition: string;
}

export interface HeatingStatus {
  // From the living room thermostat, in °C. Null while it's unavailable.
  indoorTemperature: number | null;
  // Whether a thermostat is calling the gas boiler right now.
  gasHeating: boolean;
  // How many AC units are in heat mode, whether the heating job or a person turned them on.
  acUnitsHeating: number;
}

// kWh the house has used today, by where it came from. Energy that passed through the battery counts as
// whatever charged it.
export interface EnergySources {
  // Imported on the overnight rate.
  cheapGrid: number;
  solar: number;
  // Imported at the normal rate.
  expensiveGrid: number;
}

export interface ValuesResponse {
  solar: number;
  usage: number;
  grid: number;
  batteryCharge: number;
  batteryPower: number;
  // Car state of charge from Smartcar, null until the first webhook ever received. Persisted across restarts.
  carChargeLevel: number | null;
  carChargeLevelUpdatedAt: string | null;
  // Null when the Easee lookup failed, so the rest of the dashboard still loads.
  charger: ChargerStatus | null;
  // Where today's electricity came from so far. Null when FoxCloud's hourly report failed.
  energySources: EnergySources | null;
  // Both null when Home Assistant isn't configured or didn't answer.
  weather: WeatherStatus | null;
  heating: HeatingStatus | null;
}

export interface SmartCarWebhookBase {
  eventId: string;
  eventType: string;
  data: Record<string, unknown>;
  meta: {
    webhookId: string;
  };
}

export interface SmartCarBatteryWebhook extends SmartCarWebhookBase {
  eventType: 'VEHICLE_STATE';
  data: {
    user: {
      id: string;
      externalId: string;
    };
    vehicle: {
      id: string;
      make: string;
      model: string;
    };
    signals: [
      {
        code: 'tractionbattery-stateofcharge';
        name: 'StateOfCharge';
        group: 'TractionBattery';
        body: {
          value: number;
          unit: 'percent';
        };
      },
    ];
  };
}

export interface SmartCarWebhookVerify extends SmartCarWebhookBase {
  eventType: 'VERIFY';
  data: {
    challenge: string;
  };
}

export type SmartCarWebhook = SmartCarBatteryWebhook | SmartCarWebhookVerify;
