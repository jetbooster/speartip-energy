import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { axisClasses } from '@mui/x-charts/ChartsAxis';
import { BarChart } from '@mui/x-charts/BarChart';
import { useEffect, useState } from 'react';
import { fetchEnergyHistory } from '../fetch';
import type { EnergyDay } from '../types/types';
import { ORDER, SOURCE_LABELS, SOURCE_NEON } from './energySegments';
import GappedBar from './GappedBar';

const TEXT = '#bbb';
const LINES = '#333';

// Seven days only need so much room. At this width the bars come out about 40px wide with about 25px between
// them; the two numbers go together, so change them together. Narrow screens still get 90% of the width.
export const HISTORY_DIALOG_WIDTH = 'min(90vw, 560px)';

// The share of each day's slot left empty. Declared here because x-charts' prop type rejects categoryGapRatio
// written inline, though it's a valid band-axis setting.
const DAYS_AXIS = { scaleType: 'band', dataKey: 'label', categoryGapRatio: 0.38 } as const;

const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });

// "Sat 21", or "Today" for the last day.
const dayLabel = (date: string, isToday: boolean) =>
  (isToday ? 'Today' : weekday.format(new Date(`${date}T12:00:00Z`)));

// The last week of usage by source, one stacked bar per day.
export default function EnergyHistoryChart() {
  const [days, setDays] = useState<EnergyDay[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    fetchEnergyHistory()
      .then((history) => {
        if (current) {
          setDays(history);
        }
      })
      .catch(() => {
        if (current) {
          setFailed(true);
        }
      });
    return () => {
      current = false;
    };
  }, []);

  if (failed) {
    return <Box sx={{ color: TEXT, padding: 2 }}>Could not load the last week. Try again in a minute.</Box>;
  }
  if (!days) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  // A day FoxCloud didn't answer for shows as an empty slot rather than a zero-height bar.
  const dataset = days.map((day, i) => ({
    label: dayLabel(day.date, i === days.length - 1),
    cheapGrid: day.sources?.cheapGrid ?? null,
    solar: day.sources?.solar ?? null,
    expensiveGrid: day.sources?.expensiveGrid ?? null,
  }));

  return (
    <BarChart
      dataset={dataset}
      xAxis={[DAYS_AXIS]}
      yAxis={[{ label: 'kWh' }]}
      series={ORDER.map(source => ({
        dataKey: source,
        label: SOURCE_LABELS[source],
        color: SOURCE_NEON[source],
        stack: 'total',
        valueFormatter: (value: number | null) => (value === null ? '—' : `${value.toFixed(1)} kWh`),
      }))}
      slots={{ bar: GappedBar }}
      // Room on the right for the close button, which sits over the chart's top corner.
      margin={{ top: 16, right: 40, bottom: 30, left: 50 }}
      slotProps={{ legend: { hidden: true } }}
      sx={{
        [`& .${axisClasses.root} .${axisClasses.tickLabel}`]: { fill: TEXT },
        [`& .${axisClasses.root} .${axisClasses.label}`]: { fill: TEXT },
        [`& .${axisClasses.root} .${axisClasses.line}`]: { stroke: LINES },
        [`& .${axisClasses.root} .${axisClasses.tick}`]: { stroke: LINES },
      }}
    />
  );
}
