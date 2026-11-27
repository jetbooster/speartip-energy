import type { EnergySources } from '../types/types';

// Dark like the other dials' colours, so the active brightening lifts them to full strength.
export const SOURCE_COLOURS: Record<keyof EnergySources, string> = {
  cheapGrid: '#066006',
  solar: '#036',
  expensiveGrid: '#700',
};

// What those colours become on the brightened display, for places drawn at full strength, like the history chart.
export const SOURCE_NEON: Record<keyof EnergySources, string> = {
  cheapGrid: '#0edd0e',
  solar: '#0076eb',
  expensiveGrid: '#ff1a1a',
};

export const SOURCE_LABELS: Record<keyof EnergySources, string> = {
  cheapGrid: 'Overnight',
  solar: 'Solar',
  expensiveGrid: 'Peak',
};

// Left to right along the arc.
export const ORDER: (keyof EnergySources)[] = ['cheapGrid', 'solar', 'expensiveGrid'];

// Space between segments, in radians, on top of what their rounded ends take up.
const GAP = 0.06;

interface Segment {
  source: keyof EnergySources;
  start: number;
  end: number;
}

// Splits the arc between the sources in proportion to their kWh, leaving gaps between them.
// Angles are in radians, measured clockwise from 12 o'clock, as x-charts uses them.
export const segmentAngles = (
  sources: EnergySources,
  startAngle: number,
  endAngle: number,
  capAngle: number,
): Segment[] => {
  const present = ORDER.filter(source => sources[source] > 0);
  const total = present.reduce((sum, source) => sum + sources[source], 0);
  if (total <= 0) {
    return [];
  }
  const gaps = (present.length - 1) * GAP;
  // A round end sticks out by capAngle, so every segment is inset by that much at each end.
  const span = endAngle - startAngle - gaps;
  let at = startAngle;
  return present.map((source) => {
    const length = span * (sources[source] / total);
    // A sliver too short for its two rounded ends shows as a dot in the middle of its share.
    const middle = at + length / 2;
    const start = Math.min(at + capAngle, middle);
    const end = Math.max(at + length - capAngle, middle);
    at += length + GAP;
    return { source, start, end };
  });
};

export const formatTotal = (sources: EnergySources) => {
  const kwh = sources.cheapGrid + sources.solar + sources.expensiveGrid;
  return `${kwh < 10 ? kwh.toFixed(1) : Math.round(kwh)} kWh`;
};
