import { ElectricalServices } from '@mui/icons-material';
import Box from '@mui/material/Box';
import {
  gaugeClasses,
  GaugeContainer,
  GaugeReferenceArc,
  GaugeValueText,
  useGaugeState,
} from '@mui/x-charts/Gauge';
import useWindowDimensions from '../hooks/useWindowDimensions';
import type { EnergySources } from '../types/types';
import { formatTotal, segmentAngles, SOURCE_COLOURS } from './energySegments';
import { GAUGE_CORNER_RADIUS, GAUGE_END_ANGLE, gaugeFrameSx, gaugeHeight } from './gaugeFrame';
import Item from './Item';

// Today's usage so far, split by where it came from. The whole arc is today's usage, so the colours show
// the split rather than an amount. The centre shows the total in kWh.

function Segments({ sources }: { sources: EnergySources }) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle } = useGaugeState();
  const radius = (innerRadius + outerRadius) / 2;
  const thickness = outerRadius - innerRadius;
  if (radius <= 0) {
    return null;
  }
  const point = (angle: number) => `${cx + radius * Math.sin(angle)} ${cy - radius * Math.cos(angle)}`;
  return (
    <g>
      {segmentAngles(sources, startAngle, endAngle, thickness / 2 / radius).map(({ source, start, end }) => (
        <path
          key={source}
          data-source={source}
          d={`M ${point(start)} A ${radius} ${radius} 0 ${end - start > Math.PI ? 1 : 0} 1 ${point(end)}`}
          fill="none"
          stroke={SOURCE_COLOURS[source]}
          strokeWidth={thickness}
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}

export default function EnergySourcesDial({ sources, active }: { sources: EnergySources | null; active: boolean }) {
  const { height, width } = useWindowDimensions();
  return (
    <Item>
      <Box sx={{ position: 'relative' }}>
        <GaugeContainer
          className={gaugeClasses.root}
          value={null}
          startAngle={-120}
          endAngle={GAUGE_END_ANGLE}
          cornerRadius={GAUGE_CORNER_RADIUS}
          height={gaugeHeight(height, width)}
          sx={gaugeFrameSx(active, height, width)}
        >
          <GaugeReferenceArc className={gaugeClasses.referenceArc} />
          {sources && <Segments sources={sources} />}
          <GaugeValueText className={gaugeClasses.valueText} text={sources ? formatTotal(sources) : '—'} />
          <ElectricalServices />
        </GaugeContainer>
      </Box>
    </Item>
  );
}
