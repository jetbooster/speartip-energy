import AcUnit from '@mui/icons-material/AcUnit';
import Air from '@mui/icons-material/Air';
import Cloud from '@mui/icons-material/Cloud';
import FilterDrama from '@mui/icons-material/FilterDrama';
import NightsStay from '@mui/icons-material/NightsStay';
import Thunderstorm from '@mui/icons-material/Thunderstorm';
import Umbrella from '@mui/icons-material/Umbrella';
import WbSunny from '@mui/icons-material/WbSunny';
import type { ReactNode } from 'react';
import type { WeatherStatus } from '../types/types';
import Gauge from './Gauge';
import Item from './Item';

// Home Assistant's weather conditions. Anything unlisted (fog, 'exceptional') shows as cloud.
const CONDITION_ICONS: Record<string, ReactNode> = {
  'sunny': <WbSunny />,
  'clear-night': <NightsStay />,
  'partlycloudy': <FilterDrama />,
  'cloudy': <Cloud />,
  'rainy': <Umbrella />,
  'pouring': <Umbrella />,
  'snowy': <AcUnit />,
  'snowy-rainy': <AcUnit />,
  'hail': <AcUnit />,
  'lightning': <Thunderstorm />,
  'lightning-rainy': <Thunderstorm />,
  'windy': <Air />,
  'windy-variant': <Air />,
};

// The arc fills with cloud cover. The centre shows the outdoor temperature.
export default function WeatherDial({ weather, active }: { weather: WeatherStatus | null; active: boolean }) {
  return (
    <Item>
      <Gauge
        val={weather?.cloudCover ?? 0}
        max={100}
        icon={(weather && CONDITION_ICONS[weather.condition]) ?? <Cloud />}
        colour="#557"
        text={weather ? `${Math.round(weather.temperature)}°` : '—'}
        active={active}
      />
    </Item>
  );
}
