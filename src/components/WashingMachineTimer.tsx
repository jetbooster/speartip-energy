import React, { useEffect, useState } from 'react';
import Item from './Item';
import Gauge from './Gauge';
import { LocalLaundryService } from '@mui/icons-material';

export default function WashingMachineTimer({ active }: { active: boolean }) {
  const [minsRemaining, setMinsRemaining] = useState(0);
  const [alerting, setAlerting] = useState(false);
  const [running, setRunning] = useState(false);
  const [flashState, setFlashState] = useState(false);

  useEffect(() => {
    if (!running) {
      return;
    }
    const timeout = setTimeout(() => {
      setMinsRemaining(r => r - 1);
      if (minsRemaining === 1) {
        setAlerting(true);
        setRunning(false);
        clearTimeout(timeout);
      }
    }, 100);
    return () => clearTimeout(timeout);
  }, [running, minsRemaining]);

  useEffect(() => {
    if (!running && !alerting) {
      return;
    }
    const interval = setInterval(() => {
      setFlashState(prev => !prev);
    }, 1000);

    return () => clearInterval(interval);
  }, [running, alerting]);

  const onClick = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    if (alerting) {
      setMinsRemaining(0);
      setAlerting(false);
      return;
    }
    if (running) {
      return;
    }
    setRunning(true);
    setAlerting(false);
    // 3.5h roughly long enough for complete cycle
    setMinsRemaining(3.5 * 60);
  };

  return (
    <Item onClick={event => onClick(event)}>
      <Gauge
        val={minsRemaining}
        max={3.5 * 60}
        units={{ convertMinsToHrMins: true, normal: flashState ? ' ' : ':', kilo: alerting && flashState ? '.' : '' }}
        active={(active || running) || (alerting && !flashState)}
        colour="#666"
        icon={<LocalLaundryService />}
      />
    </Item>
  );
}
