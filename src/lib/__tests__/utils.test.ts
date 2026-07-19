import { describe, it, expect } from 'vitest';
import { decimalFromTimeInput, formatTime, intervalOverlap, roundHalf } from '../utils';

describe('formatTime', () => {
  it('formats whole morning hours', () => {
    expect(formatTime(5)).toBe('5am');
    expect(formatTime(11)).toBe('11am');
  });

  it('formats noon and afternoon hours', () => {
    expect(formatTime(12)).toBe('12pm');
    expect(formatTime(13)).toBe('1pm');
    expect(formatTime(23)).toBe('11pm');
  });

  it('formats midnight as 12am', () => {
    expect(formatTime(0)).toBe('12am');
  });

  it('includes minutes only when non-zero', () => {
    expect(formatTime(9.5)).toBe('9:30am');
    expect(formatTime(13.25)).toBe('1:15pm');
    expect(formatTime(8.75)).toBe('8:45am');
  });

  it('pads single-digit minutes', () => {
    expect(formatTime(9 + 5 / 60)).toBe('9:05am');
  });

  it('rolls minutes that round to 60 into the next hour', () => {
    // 11.999h rounds to 720 minutes, i.e. 12:00pm rather than 11:60am.
    expect(formatTime(11.999)).toBe('12pm');
  });
});

describe('decimalFromTimeInput', () => {
  it('parses HH:MM into decimal hours', () => {
    expect(decimalFromTimeInput('09:30')).toBe(9.5);
    expect(decimalFromTimeInput('00:00')).toBe(0);
    expect(decimalFromTimeInput('23:45')).toBe(23.75);
  });

  it('treats a missing minutes part as zero', () => {
    expect(decimalFromTimeInput('9')).toBe(9);
  });

  it('returns NaN for empty or null input', () => {
    expect(decimalFromTimeInput(null)).toBeNaN();
    expect(decimalFromTimeInput('')).toBeNaN();
  });

  it('returns NaN when the hours part is not a number', () => {
    expect(decimalFromTimeInput('ab:30')).toBeNaN();
  });
});

describe('roundHalf', () => {
  it('rounds to the nearest half', () => {
    expect(roundHalf(1.2)).toBe(1);
    expect(roundHalf(1.3)).toBe(1.5);
    expect(roundHalf(1.6)).toBe(1.5);
    expect(roundHalf(1.8)).toBe(2);
  });

  it('keeps exact halves and integers unchanged', () => {
    expect(roundHalf(2.5)).toBe(2.5);
    expect(roundHalf(3)).toBe(3);
    expect(roundHalf(0)).toBe(0);
  });

  it('rounds .25 up to the next half (Math.round ties round up)', () => {
    expect(roundHalf(1.25)).toBe(1.5);
  });
});

describe('intervalOverlap', () => {
  it('returns the overlapping length of two intervals', () => {
    expect(intervalOverlap(8, 12, 10, 14)).toBe(2);
    expect(intervalOverlap(10, 14, 8, 12)).toBe(2);
  });

  it('returns the full length when one interval contains the other', () => {
    expect(intervalOverlap(8, 16, 10, 12)).toBe(2);
    expect(intervalOverlap(10, 12, 8, 16)).toBe(2);
  });

  it('returns 0 for disjoint intervals', () => {
    expect(intervalOverlap(8, 10, 12, 14)).toBe(0);
  });

  it('returns 0 for intervals that only touch at a boundary', () => {
    expect(intervalOverlap(8, 10, 10, 12)).toBe(0);
  });

  it('handles fractional bounds', () => {
    expect(intervalOverlap(8.5, 9.75, 9, 11)).toBe(0.75);
  });
});
