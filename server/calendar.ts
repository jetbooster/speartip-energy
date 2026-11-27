// Calendar days in UK time. FoxCloud's reports and the tariff both follow the UK clock.

export interface CalendarDay {
  year: number;
  month: number;
  day: number;
}

const londonDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

const londonHour = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: 'numeric', hourCycle: 'h23' });

export const londonDay = (now: Date): CalendarDay => {
  const parts = Object.fromEntries(londonDate.formatToParts(now).map(p => [p.type, Number(p.value)]));
  return { year: parts.year, month: parts.month, day: parts.day };
};

export const londonHourOf = (now: Date) => Number(londonHour.format(now));

// Works on the date alone, so clock changes can't shift it.
export const addDays = ({ year, month, day }: CalendarDay, days: number): CalendarDay => {
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
};

// YYYY-MM-DD, which also sorts in date order.
export const dayKey = ({ year, month, day }: CalendarDay) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
