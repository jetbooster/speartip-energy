import Box from '@mui/material/Box';
import { Gauge, gaugeClasses } from '@mui/x-charts/Gauge';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import useWindowDimensions from '../hooks/useWindowDimensions';
import FlowArrow from './FlowArrow';

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
  // Small line of text under the dial, e.g. a rate or status.
  subLabel?: ReactNode;
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
  subLabel,
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
        endAngle={120}
        cornerRadius={80}
        height={height <= width ? (height / 2) : (height / 3)}
        sx={theme => ({
          filter: `${active ? 'brightness(230%)' : ''}`,
          color: colour,
          [`& .${gaugeClasses.valueArc}`]: {
            'fill': colour ?? theme.palette.primary.main,
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
          [`& .${gaugeClasses.root}`]: {
            height: '200px',
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
      {subLabel !== undefined && (
        <Box
          sx={{
            position: 'absolute',
            // Right of centre, opposite the battery arrow, so a flow arrow on the left never overlaps it.
            left: '27%',
            top: '45%',
            transform: 'translate(-50%, -50%)',
            // Same size as the FlowArrow label, so the two read as a pair.
            fontSize: '3rem',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            color: active ? '#f050f8' : '#552058',
          }}
        >
          {subLabel}
        </Box>
      )}
    </Box>
  );
}
