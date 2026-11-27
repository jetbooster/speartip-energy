import type { EnergySources } from '../../src/types/types';
import type { HourlyEnergy } from '../foxcloud';
import { cheapShareOfHour } from '../tariff';

type Sources = { [K in keyof EnergySources]: number };

const SOURCES: (keyof EnergySources)[] = ['cheapGrid', 'solar', 'expensiveGrid'];

const total = (s: Sources) => s.cheapGrid + s.solar + s.expensiveGrid;

// Where the electricity the house used today came from, in kWh, worked out hour by hour.
//
// Solar used on site and grid import go straight to the house, except for whatever went into the battery that
// hour (solar first, then grid). Grid import is cheap or expensive by the hour it arrived, split for the hours
// the overnight rate starts and ends in. The battery is tracked as a mix of those three sources, and what it
// gives back is shared out in proportion to what went in. It can give back more than went in today, because it
// started the day partly charged. That remainder counts as cheap, since the battery charges overnight.
export const energySources = (hourly: HourlyEnergy): EnergySources => {
  const used: Sources = { cheapGrid: 0, solar: 0, expensiveGrid: 0 };
  const stored: Sources = { cheapGrid: 0, solar: 0, expensiveGrid: 0 };

  for (let hour = 0; hour < 24; hour++) {
    const at = (series: number[]) => Math.max(series[hour] ?? 0, 0);
    const cheapShare = cheapShareOfHour(hour);
    const imported = at(hourly.gridImport);
    const charged = at(hourly.batteryCharge);
    const discharged = at(hourly.batteryDischarge);

    const solarOnSite = Math.max(at(hourly.pv) - at(hourly.feedin), 0);
    const solarToBattery = Math.min(charged, solarOnSite);
    const gridToBattery = Math.min(charged - solarToBattery, imported);
    stored.solar += solarToBattery;
    stored.cheapGrid += gridToBattery * cheapShare;
    stored.expensiveGrid += gridToBattery * (1 - cheapShare);

    const gridToHouse = imported - gridToBattery;
    used.solar += solarOnSite - solarToBattery;
    used.cheapGrid += gridToHouse * cheapShare;
    used.expensiveGrid += gridToHouse * (1 - cheapShare);

    const storedToday = total(stored);
    const fromToday = Math.min(discharged, storedToday);
    if (fromToday > 0) {
      for (const source of SOURCES) {
        const part = fromToday * (stored[source] / storedToday);
        used[source] += part;
        stored[source] -= part;
      }
    }
    used.cheapGrid += discharged - fromToday;
  }

  return used;
};
