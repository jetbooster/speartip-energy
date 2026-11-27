// Wraps `fetch` so callers within `maxAgeMs` of the last call share its result, including one still in flight.
// Failures aren't kept, so the next call retries straight away.
export const cached = <T>(fetch: () => Promise<T>, maxAgeMs: number): (() => Promise<T>) => {
  let entry: { at: number; value: Promise<T> } | null = null;
  return () => {
    const now = Date.now();
    if (!entry || now - entry.at >= maxAgeMs) {
      const current = { at: now, value: fetch() };
      current.value.catch(() => {
        if (entry === current) {
          entry = null;
        }
      });
      entry = current;
    }
    return entry.value;
  };
};
