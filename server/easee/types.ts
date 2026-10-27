export interface UserToken {
  accessToken: string | null;
  expiresIn: number;
  accessClaims: string[] | null;
  tokenType: string | null;
  refreshToken: string | null;
}

// Easee's chargerOpMode: 1 Disconnected, 2 AwaitingStart, 3 Charging, 4 Completed, 5 Error, 6 ReadyToCharge, 7 AwaitingAuthorization
export type OpMode = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface ChargerState {
  chargerOpMode: OpMode | null;
  isOnline: boolean;
  outputCurrent: number | null;
  dynamicChargerCurrent: number | null;
  totalPower: number | null;
  sessionEnergy: number | null;
  cableLocked: boolean | null;
  reasonForNoCurrent: number | null;
}

export interface DashboardChargerState {
  chargerID: string | null;
  chargerState: ChargerState | null;
}

export interface SiteDashboardState {
  circuitStates: {
    chargerStates: DashboardChargerState[] | null;
  }[] | null;
}

export interface SiteDTO {
  id: number;
}
