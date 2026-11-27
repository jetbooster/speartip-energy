import { describe, expect, test } from 'bun:test';
import { addDays, dayKey, londonDay, londonHourOf } from './calendar';

describe('calendar', () => {
  test('uses the UK date, which runs ahead of UTC in summer', () => {
    expect(londonDay(new Date('2027-07-15T23:30:00Z'))).toEqual({ year: 2027, month: 7, day: 16 });
    expect(londonHourOf(new Date('2027-07-15T23:30:00Z'))).toBe(0);
  });

  test('steps across month and year ends', () => {
    expect(addDays({ year: 2027, month: 3, day: 1 }, -1)).toEqual({ year: 2027, month: 2, day: 28 });
    expect(addDays({ year: 2026, month: 12, day: 31 }, 1)).toEqual({ year: 2027, month: 1, day: 1 });
  });

  test('keys sort in date order', () => {
    expect(dayKey({ year: 2027, month: 1, day: 5 })).toBe('2027-01-05');
  });
});
