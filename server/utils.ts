// Octopus timestamps are UTC with a literal Z, so everything here stays in UTC.
export const parseIsoNoMilliSeconds = (s: string) => new Date(s);
export const formatToIsoNoMilliseconds = (date: Date) => `${date.toISOString().slice(0, 19)}Z`;
