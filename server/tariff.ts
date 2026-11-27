// Intelligent Octopus Go's overnight rate, 23:30-05:30 UK time, as minutes after midnight.
export const CHEAP_START_MINUTES = 23 * 60 + 30;
export const CHEAP_END_MINUTES = 5 * 60 + 30;

export const isCheapMinute = (minuteOfDay: number) =>
  minuteOfDay >= CHEAP_START_MINUTES || minuteOfDay < CHEAP_END_MINUTES;

// How much of a clock hour (0-23) is on the overnight rate: 1 for 00:00-05:00, 0.5 for 05:00 and 23:00, else 0.
export const cheapShareOfHour = (hour: number) => {
  let cheap = 0;
  for (let minute = hour * 60; minute < (hour + 1) * 60; minute++) {
    cheap += isCheapMinute(minute) ? 1 : 0;
  }
  return cheap / 60;
};

const londonClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export const isCheapRate = (now: Date) => {
  const [hours, minutes] = londonClock.format(now).split(':').map(Number);
  const m = hours * 60 + minutes;
  return isCheapMinute(m);
};
