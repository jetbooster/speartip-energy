import Box from '@mui/material/Box';
import { Gauge, gaugeClasses } from '@mui/x-charts/Gauge';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import useWindowDimensions from '../hooks/useWindowDimensions';
import FlowArrow from './FlowArrow';
import { GAUGE_CORNER_RADIUS, GAUGE_END_ANGLE, gaugeFrameSx, gaugeHeight } from './gaugeFrame';

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
  // Signed flow in kW: positive shows a green arrow to the right, negative a red arrow to the left.
  diff?: number;
  // Replaces the formatted value in the centre, e.g. a placeholder when there is no reading.
  text?: string;
  // Multiplies the centre text size. Words look heavier than readings like "2.4 kW", so prompts use less than 1.
  textScale?: number;
}

const TWEEN_MS = 1000;

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
  diff,
  text,
  textScale = 1,
}: GaugeProps) {
  // x-charts doesn't animate the arc, so we tween the displayed value towards `val`.
  const [shown, setShown] = useState(val);
  const shownRef = useRef(val);
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
    const from = shownRef.current;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min((now - start) / TWEEN_MS, 1);
      const next = from + BezierBlend(t) * (val - from);
      shownRef.current = next;
      setShown(next);
      if (t < 1) {
        frame = requestAnimationFrame(step);
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [val]);

  return (
    <Box sx={{ position: 'relative' }}>
      <Gauge
        value={exponential ? (Math.pow(shown / max, 0.3) * 100) : ((shown / max) * 100)}
        startAngle={startAngle}
        endAngle={GAUGE_END_ANGLE}
        cornerRadius={GAUGE_CORNER_RADIUS}
        height={gaugeHeight(height, width)}
        sx={theme => ({
          ...gaugeFrameSx(active, height, width, textScale),
          color: colour,
          [`& .${gaugeClasses.valueArc}`]: {
            fill: colour ?? theme.palette.primary.main,
          },
        })}
        text={() => text ?? transformWithUnits()}
      >
        {icon}
      </Gauge>
      {diff !== undefined && (
        <FlowArrow
          axis="vertical"
          kw={diff}
          left="33%"
          top="48%"
          active={active}
        />
      )}
    </Box>
  );
}
