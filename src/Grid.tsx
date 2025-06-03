import BatteryChargingFull from '@mui/icons-material/BatteryChargingFull';
import Bolt from '@mui/icons-material/Bolt';
import CurrencyPound from '@mui/icons-material/CurrencyPound';
import SolarPower from '@mui/icons-material/SolarPower';
import Grid from '@mui/material/Grid2';
import { ElectricMeter } from './assets/icons';
import Gauge from './components/Gauge';
import { ValuesResponse } from './types/types';
import WashingMachineTimer from './components/WashingMachineTimer';
import Item from './components/Item';

interface DisplayGridProps {
  onClick: () => void;
  values: ValuesResponse;
  active: boolean;
}

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
          />
        </Item>
      </Grid>
      <Grid size={{ xs: 2, sm: 4, md: 4 }}>
        <Item>
          <Gauge
            val={Number(values.price.toPrecision(2))}
            max={100}
            icon={<CurrencyPound />}
            colour="#616"
            units={{ normal: 'p', noSpace: true }}
            active={active}
            startAngle={-90}
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
          />
        </Item>
      </Grid>
      <Grid size={{ xs: 2, sm: 4, md: 4 }}>
        <WashingMachineTimer active={active} />
      </Grid>

    </Grid>
  );
}
