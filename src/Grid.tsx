import BatteryChargingFull from '@mui/icons-material/BatteryChargingFull';
import Bolt from '@mui/icons-material/Bolt';
import ElectricCar from '@mui/icons-material/ElectricCar';
import SolarPower from '@mui/icons-material/SolarPower';
import Grid from '@mui/material/Grid2';
import { ElectricMeter } from './assets/icons';
import Gauge from './components/Gauge';
import type { ValuesResponse } from './types/types';
import WashingMachineTimer from './components/WashingMachineTimer';
import Item from './components/Item';

interface DisplayGridProps {
  onClick: () => void;
  values: ValuesResponse;
  active: boolean;
}

const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

// Status shown under the car dial. Plugged-in state takes priority over the age of the reading.
const carSubLabel = (values: ValuesResponse): string | undefined => {
  if (!values.charger) {
    return 'No charger data';
  }
  if (!values.charger.carConnected) {
    return 'Unplugged';
  }
  if (values.charger.carAwaitingAuthorization) {
    return 'Awaiting authorisation';
  }
  if (values.carChargeLevelUpdatedAt && Date.now() - Date.parse(values.carChargeLevelUpdatedAt) > STALE_AFTER_MS) {
    const hours = Math.floor((Date.now() - Date.parse(values.carChargeLevelUpdatedAt)) / (60 * 60 * 1000));
    return `Updated ${hours}h ago`;
  }
  return undefined;
};

export default function DisplayGrid({ onClick, values, active }: DisplayGridProps) {
  return (

    <Grid
      onClick={onClick}
      container
      spacing={0}
      columns={{ xs: 4, sm: 12, md: 12 }}
      sx={{ height: '100vh', width: '100vw' }}
      padding={1}
    >
      <Grid size={{ xs: 2, sm: 4, md: 4 }}>
        <Item>
          <Gauge
            val={Number(values.solar.toPrecision(2))}
            max={5.4}
            icon={<SolarPower />}
            colour="#166"
            units={{ normal: 'kW', milli: 'W' }}
            active={active}
          />
        </Item>
      </Grid>
      <Grid size={{ xs: 2, sm: 4, md: 4 }}>
        <Item>
          <Gauge
            val={Number(values.usage.toPrecision(2))}
            exponential
            max={10}
            icon={<Bolt />}
            colour="#661"
            units={{ normal: 'kW', milli: 'W' }}
            active={active}
          />
        </Item>
      </Grid>
      <Grid size={{ xs: 2, sm: 4, md: 4 }}>
        <Item>
          <Gauge
            val={values.batteryCharge}
            max={100}
            icon={<BatteryChargingFull />}
            colour="#066006"
            units={{ normal: '%', noSpace: true }}
            active={active}
            diff={values.batteryPower}
          />
        </Item>
      </Grid>
      <Grid size={{ xs: 2, sm: 4, md: 4 }}>
        <Item>
          <Gauge
            val={values.carChargeLevel ?? 0}
            max={100}
            icon={<ElectricCar />}
            colour="#036"
            units={{ normal: '%', noSpace: true }}
            text={values.carChargeLevel === null ? '—' : undefined}
            active={active}
            // Charger power only shows as a flow while a car is plugged in.
            diff={values.charger?.carConnected ? (values.charger.totalPower ?? 0) : undefined}
            subLabel={carSubLabel(values)}
          />
        </Item>
      </Grid>
      <Grid size={{ xs: 2, sm: 4, md: 4 }}>
        <Item>
          <Gauge
            val={Number(values.grid.toPrecision(2))}
            exponential
            max={10}
            icon={<ElectricMeter />}
            active={active}
            colour="#666"
            units={{ normal: 'kW', milli: 'W' }}
            startAngle={-90}
            subLabel={`${Number(values.price.toPrecision(2))}p`}
          />
        </Item>
      </Grid>
      <Grid size={{ xs: 2, sm: 4, md: 4 }}>
        <WashingMachineTimer active={active} />
      </Grid>

    </Grid>
  );
}
