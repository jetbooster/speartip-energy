import { Gauge, gaugeClasses } from '@mui/x-charts/Gauge';
import { ReactNode, useEffect, useState } from 'react';
import useWindowDimensions from '../hooks/useWindowDimentions';

interface GaugeProps {
  val: number;
  max: number;
  colour?: string;
  icon: ReactNode;
  units?: {
    kilo?: string;
    normal: string;
    milli?: string;
    noSpace?: boolean;
    convertMinsToHrMins?: boolean;
  };
  active?: boolean;
  startAngle?: number;
  exponential?: boolean;
}

function BezierBlend(t: number) {
  return t * t * (3 - (2 * t));
}

const convertToHoursMins = (n: number, s: string) => {
  const hrs = Math.floor(n / 60);
  const mins = n - hrs * 60;
  return `${hrs}${s}${mins.toString().padStart(2, '0')}`;
};

export default function MyGauge({
  val,
  max,
  colour,
  icon,
  units,
  active = false,
  startAngle = -120,
  exponential = false,
}: GaugeProps) {
  const [slowVal, setSlowVal] = useState(val);
  const { height, width } = useWindowDimensions();

  const transformWithUnits = (): string => {
    if (units?.convertMinsToHrMins) {
      if (units.kilo === '.') {
        return '';
      }
      return convertToHoursMins(val, units.normal);
    }
    if (units?.milli && Math.abs(val) < 1.0) {
      return `${val * 1000}${units.noSpace ? '' : ' '}${units?.milli}`;
    }
    if (units?.kilo && Math.abs(val) > 1000) {
      return `${val / 1000}${units.noSpace ? '' : ' '}${units?.kilo}`;
    }
    return `${val}${units?.noSpace ? '' : ' '}${units?.normal}`;
  };

  useEffect(() => {
    const initSlowVal = slowVal;
    let curr = 0;
    const interval = setInterval(() => {
      setSlowVal(initSlowVal + BezierBlend(curr) * (val - initSlowVal));
      curr += 0.02;
      if (curr >= 1) {
        clearInterval(interval);
      }
    }, 20);
    return () => clearInterval(interval);
  }, [val]);

  return (
    <Gauge
      value={exponential ? (Math.pow(slowVal / max, 0.3) * 100) : ((slowVal / max) * 100)}
      startAngle={startAngle}
      endAngle={120}
      cornerRadius={80}
      sx={theme => ({
        filter: `${active ? 'brightness(230%)' : ''}`,
        color: colour,
        [`& .${gaugeClasses.valueArc}`]: {
          'fill': colour ?? theme.palette.primary.main,
          // transition: "0.2s",
          '& path': {
          },
        },
        [`& .${gaugeClasses.valueText}`]: {
          fontSize: height > width ? '8vw' : '11.5vh',
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
      })}
      text={transformWithUnits}
    >
      {icon}
    </Gauge>
  );
}
