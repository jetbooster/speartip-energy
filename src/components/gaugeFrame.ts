import { gaugeClasses } from '@mui/x-charts/Gauge';

// The look every dial shares: the dark background arc, the centre text and icon, and the brighter
// "active" state. Gauge and EnergySourcesDial both build on this so they stay identical.

export const GAUGE_END_ANGLE = 120;
// Rounds the arc ends fully, whatever the arc's thickness.
export const GAUGE_CORNER_RADIUS = 80;

export const gaugeHeight = (height: number, width: number) => (height <= width ? height / 2 : height / 3);

export const gaugeFrameSx = (active: boolean, height: number, width: number, textScale = 1) => ({
  filter: active ? 'brightness(230%)' : '',
  [`& .${gaugeClasses.valueText}`]: {
    fontSize: `calc(${height > width ? '8vw' : '11.5vh'} * ${textScale})`,
    fontWeight: 500,
    transform: `translate(0px, ${height > width ? '9vw' : '9vh'})`,
  },
  [`& .${gaugeClasses.valueText} text`]: {
    fill: active ? '#bbb' : '#888',
  },
  [`& .${gaugeClasses.referenceArc}`]: {
    fill: '#0b0b0b',
  },
  ['& .MuiSvgIcon-root']: {
    '& path': {
      transform: `translate(0px, ${height > width ? '0px' : '-0.1vh'}) scale(0.45)`,
      transformOrigin: 'center center',
    },
  },
  [`& .${gaugeClasses.root}`]: {
    height: '200px',
  },
});
