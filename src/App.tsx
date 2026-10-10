import { Alert, CircularProgress, Snackbar } from '@mui/material';
import { useEffect, useState } from 'react';
import { fetchValues } from './fetch';
import DisplayGrid from './Grid';
import type { ValuesResponse } from './types/types';

export default function App() {
  const [active, setActive] = useState(false);

  const [values, setValues] = useState<ValuesResponse | null>(null);

  const [connectionError, setConnectionError] = useState(false);

  const onClick = () => {
    setActive(true);
    document.querySelector('body')!.requestFullscreen();
  };

  useEffect(() => {
    const loadValues = () => fetchValues()
      .then((data) => {
        setValues(data);
        setConnectionError(false);
      })
      .catch(() => setConnectionError(true));

    if (!values) {
      loadValues();
      return;
    }
    const pollInterval = 3 * 60 * 1000;
    let timeout: ReturnType<typeof setTimeout>;
    if (active) {
      timeout = setTimeout(() => {
        setActive(false);
      }, pollInterval);
    }
    loadValues();
    const interval = setInterval(loadValues, pollInterval);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [active]);

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
