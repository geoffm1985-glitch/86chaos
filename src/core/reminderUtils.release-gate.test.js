import { parseReminderCommand, makeReminderDate, createStrictLocalDate } from './reminderUtils';

const local = (year, month, day, hour = 12, minute = 0) => new Date(year, month, day, hour, minute, 0, 0);

const SAMPLE_SPEECH_INPUTS = [
  '',
  'remind me to check prep',
  'Remind me to clean the fryer in 15 minutes',
  '86 perch tomorrow at 9am',
  'set a reminder for 1/5/2025 at 9am',
  '🚨 check line temps at 4:30 pm',
  'x'.repeat(500),
  'remind me '.repeat(40),
  'Remind me to count freezer on 02/29/2028 at 7:15 am',
  'Remind me to check invoices next Tuesday at noon'
];

const SAMPLE_DATE_CASES = [
  [2000, 0, 1],
  [2024, 1, 29],
  [2026, 1, 28],
  [2026, 1, 29],
  [2026, 3, 30],
  [2026, 3, 31],
  [2026, 5, 31],
  [2026, 11, 31],
  [2100, 1, 28],
  [2100, 1, 29]
];

const SAMPLE_MINUTES = [1, 2, 5, 15, 30, 45, 60, 90, 120, 240, 720, 1440];

const SAMPLE_CLOCK_TIMES = [
  [0, 0],
  [5, 15],
  [8, 30],
  [12, 0],
  [16, 45],
  [20, 31],
  [23, 59]
];

describe('release-gate reminder properties', () => {
  test('parser never throws for representative speech input', () => {
    SAMPLE_SPEECH_INPUTS.forEach((text) => {
      expect(() => parseReminderCommand(text, local(2026, 6, 25, 12, 0))).not.toThrow();
    });
  });

  test('strict date constructor accepts exactly valid Gregorian dates', () => {
    SAMPLE_DATE_CASES.forEach(([year, month, day]) => {
      const result = createStrictLocalDate(year, month, day);
      const expected = new Date(year, month, day, 12, 0, 0, 0);
      const valid = expected.getFullYear() === year && expected.getMonth() === month && expected.getDate() === day;
      expect(Boolean(result)).toBe(valid);
    });
  });

  test('valid relative minute reminders advance by the requested amount', () => {
    SAMPLE_MINUTES.forEach((minutes) => {
      const now = local(2026, 6, 25, 10, 0);
      const parsed = parseReminderCommand(`Remind me to check prep in ${minutes} minutes`, now);
      expect(parsed.validationError).toBe('');
      expect(new Date(parsed.scheduledAt).getTime() - now.getTime()).toBe(minutes * 60 * 1000);
    });
  });

  test('scheduled reminder output is never in the past', () => {
    SAMPLE_CLOCK_TIMES.forEach(([hour, minute]) => {
      const now = local(2026, 6, 25, 20, 30);
      const suffix = hour >= 12 ? 'pm' : 'am';
      const h12 = hour % 12 || 12;
      const parsed = parseReminderCommand(`Remind me to check line at ${h12}:${String(minute).padStart(2, '0')} ${suffix}`, now);
      const scheduledTime = parsed.scheduledAt ? new Date(parsed.scheduledAt).getTime() : Number.POSITIVE_INFINITY;
      expect(scheduledTime).toBeGreaterThan(now.getTime());
    });
  });

  test('past explicit slash dates with a year are rejected rather than scheduled in the past', () => {
    const now = local(2026, 6, 25, 12, 0);
    const parsed = parseReminderCommand('Remind me to count freezer on 1/5/2025 at 9am', now);
    expect(parsed.validationError).toBeTruthy();
    expect(parsed.scheduledAt).toBe('');
  });

  test('manual date construction rejects calendar rollover', () => {
    expect(makeReminderDate('2026-02-31', '09:00')).toBeNull();
    expect(makeReminderDate('2026-04-31', '09:00')).toBeNull();
    expect(makeReminderDate('2026-02-28', '25:00')).toBeNull();
  });
});
