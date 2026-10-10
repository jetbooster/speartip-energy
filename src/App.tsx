import { Alert, CircularProgress, Snackbar } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { fetchValues } from './fetch';
import DisplayGrid from './Grid';
import type { ValuesResponse } from './types/types';

const POLL_INTERVAL_MS = 3 * 60 * 1000;
const ACTIVE_TIMEOUT_MS = 3 * 60 * 1000;

export default function App() {
  const [active, setActive] = useState(false);

  const [values, setValues] = useState<ValuesResponse | null>(null);

  const [connectionError, setConnectionError] = useState(false);

  const activeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Activity is a user event, so the timeout is scheduled here rather than in an effect.
  const onClick = () => {
    setActive(true);
    clearTimeout(activeTimer.current);
    activeTimer.current = setTimeout(() => setActive(false), ACTIVE_TIMEOUT_MS);
    document.body.requestFullscreen();
  };

  // Polling is independent of `active`. Failed polls retry on the next tick.
  useEffect(() => {
    const loadValues = () => fetchValues()
      .then((data) => {
        setValues(data);
        setConnectionError(false);
      })
      .catch(() => setConnectionError(true));

    loadValues();
    const interval = setInterval(loadValues, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {values ? <DisplayGrid onClick={onClick} values={values} active={active} /> : <CircularProgress />}
      <Snackbar
        open={connectionError}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" variant="filled" onClose={() => setConnectionError(false)}>
          Connection failed. Unable to fetch the latest values.
        </Alert>
      </Snackbar>
    </>
  );
}
