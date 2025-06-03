import BatteryChargingFull from '@mui/icons-material/BatteryChargingFull';
import Bolt from '@mui/icons-material/Bolt';
import CurrencyPound from '@mui/icons-material/CurrencyPound';
import SolarPower from '@mui/icons-material/SolarPower';
import Grid from '@mui/material/Grid2';
import Paper from '@mui/material/Paper';
import { styled } from '@mui/material/styles';
import { ElectricMeter } from './assets/icons';
import Gauge from './Gauge';
import { ValuesResponse } from './types/types';

const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: '#000',
  ...theme.typography.body2,
  padding: theme.spacing(0),
  textAlign: 'center',
  height: '100%',

}));

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
            val={Number(values.solar.toPrecision(3))}
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
            val={values.usage}
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
            val={Number(values.price.toPrecision(3))}
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
            val={values.grid}
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
      {/* <Grid size={{ xs: 2, sm: 4, md: 4 }}>
        <Item>
          <Gauge
            val={0}
            max={100}
            icon={<QuestionMark />}
            active={active}
            colour="#666"
            units={{ normal: "" }}
          />
        </Item>
      </Grid> */}

    </Grid>
  );
}
