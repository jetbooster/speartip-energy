import HeatPump from '@mui/icons-material/HeatPump';
import LocalFireDepartment from '@mui/icons-material/LocalFireDepartment';
import Thermostat from '@mui/icons-material/Thermostat';
import type { HeatingStatus } from '../types/types';
import Gauge from './Gauge';
import Item from './Item';

// The arc and centre show the indoor temperature. Icon and colour show what is heating the house:
// gas wins when both run, since that's the one costing money.
const MAX_TEMPERATURE = 25;

const source = (heating: HeatingStatus | null) => {
  if (heating?.gasHeating) {
    return { icon: <LocalFireDepartment />, colour: '#a40' };
  }
  if (heating && heating.acUnitsHeating > 0) {
    return { icon: <HeatPump />, colour: '#166' };
  }
  return { icon: <Thermostat />, colour: '#444' };
};

export default function HeatingDial({ heating, active }: { heating: HeatingStatus | null; active: boolean }) {
  const temperature = heating?.indoorTemperature ?? null;
  const { icon, colour } = source(heating);
  return (
    <Item>
      <Gauge
        val={temperature ?? 0}
        max={MAX_TEMPERATURE}
        icon={icon}
        colour={colour}
        text={temperature === null ? '—' : `${temperature.toFixed(1)}°`}
        active={active}
      />
    </Item>
  );
}
