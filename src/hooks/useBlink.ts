import { useEffect, useState } from 'react';

const BLINK_MS = 500;

// Alternates between true and false while enabled, and stays false otherwise.
export default function useBlink(enabled: boolean) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const id = setInterval(() => setOn(current => !current), BLINK_MS);
    return () => {
      clearInterval(id);
      setOn(false);
    };
  }, [enabled]);

  return on;
}
