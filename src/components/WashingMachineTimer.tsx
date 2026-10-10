import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import Item from './Item';
import Gauge from './Gauge';
import { LocalLaundryService } from '@mui/icons-material';

const MINUTE_MS = 60 * 1000;
// 3.5h is roughly long enough for a complete cycle
const CYCLE_MS = 3.5 * 60 * MINUTE_MS;
const STEP_MS = 30 * MINUTE_MS;
const BLINK_MS = 500;

export default function WashingMachineTimer({ active }: { active: boolean }) {
  // Wall-clock end time, so the countdown doesn't drift when timers are throttled.
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const remainingMs = endsAt === null ? 0 : Math.max(0, endsAt - now);
  const alerting = endsAt !== null && remainingMs === 0;
  const counting = endsAt !== null && !alerting;
  const minsRemaining = Math.ceil(remainingMs / MINUTE_MS);
  const blink = endsAt !== null && Math.floor(now / BLINK_MS) % 2 === 0;

  // Only ticks while there is a timer to show.
  useEffect(() => {
    if (endsAt === null) {
      return;
    }
    const id = setInterval(() => setNow(Date.now()), BLINK_MS);
    return () => clearInterval(id);
  }, [endsAt]);

  const onClick = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    if (alerting) {
      setEndsAt(null);
      return;
    }
    if (counting) {
      if (remainingMs < STEP_MS) {
        setEndsAt(null);
        return;
      }
      setEndsAt(end => (end ?? 0) - STEP_MS);
      return;
    }
    const current = Date.now();
    setNow(current);
    setEndsAt(current + CYCLE_MS);
  };

  return (
    <Item onClick={onClick}>
      <Gauge
        val={minsRemaining}
        max={CYCLE_MS / MINUTE_MS}
        units={{ convertMinsToHrMins: true, normal: blink ? ' ' : ':', kilo: alerting && blink ? '.' : '' }}
        active={active || counting || (alerting && !blink)}
        colour="#666"
        icon={<LocalLaundryService />}
      />
    </Item>
  );
}
