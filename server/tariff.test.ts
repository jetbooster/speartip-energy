import { describe, expect, test } from 'bun:test';
import { cheapShareOfHour, isCheapRate } from './tariff';

describe('isCheapRate', () => {
  test.each([
    ['2027-01-15T23:29:59Z', false],
    ['2027-01-15T23:30:00Z', true],
    ['2027-01-16T03:00:00Z', true],
    ['2027-01-16T05:29:59Z', true],
    ['2027-01-16T05:30:00Z', false],
    // British Summer Time: 22:30 UTC is 23:30 in the UK.
    ['2027-07-15T22:30:00Z', true],
    ['2027-07-16T04:30:00Z', false],
  ])('%s -> %p', (iso, expected) => {
    expect(isCheapRate(new Date(iso))).toBe(expected);
  });
});

describe('cheapShareOfHour', () => {
  test.each([
    [0, 1],
    [4, 1],
    // The overnight rate ends at 05:30 and starts at 23:30.
    [5, 0.5],
    [6, 0],
    [17, 0],
    [22, 0],
    [23, 0.5],
  ])('%d:00 -> %p', (hour, expected) => {
    expect(cheapShareOfHour(hour)).toBe(expected);
  });
});
