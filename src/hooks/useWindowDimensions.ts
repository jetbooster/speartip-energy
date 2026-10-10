import { useSyncExternalStore } from 'react';

const subscribe = (onChange: () => void) => {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
};

// Primitive snapshots keep useSyncExternalStore from re-rendering on every read.
export default function useWindowDimensions() {
  const width = useSyncExternalStore(subscribe, () => window.innerWidth);
  const height = useSyncExternalStore(subscribe, () => window.innerHeight);
  return { width, height };
}
