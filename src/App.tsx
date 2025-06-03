import { CircularProgress } from '@mui/material';
import { useEffect, useState } from 'react';
import { fetchValues } from './fetch';
import DisplayGrid from './Grid';
import { ValuesResponse } from './types/types';

export default function App() {
  const [active, setActive] = useState(false);

  const [values, setValues] = useState<ValuesResponse | null>(null);

  const onClick = () => {
    setActive(true);
    document.querySelector('body')!.requestFullscreen();
  };

  useEffect(() => {
    if (!values) {
      fetchValues().then(setValues);
      return;
    }
    const pollInterval = 3 * 60 * 1000;
    if (active) {
      setTimeout(() => {
        setActive(false);
      }, pollInterval);
    }
    fetchValues().then(setValues);
    const interval = setInterval(() => {
      fetchValues().then(setValues);
    }, pollInterval);
    return () => clearInterval(interval);
  }, [active]);

  return (values ? <DisplayGrid onClick={onClick} values={values} active={active} /> : <CircularProgress />
  );
}
