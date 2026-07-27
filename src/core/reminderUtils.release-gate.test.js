import fc from 'fast-check';
import { parseReminderCommand, makeReminderDate, createStrictLocalDate } from './reminderUtils';

const local = (year, month, day, hour = 12, minute = 0) => new Date(year, month, day, hour, minute, 0, 0);

describe('release-gate reminder properties', () => {
  test('parser never throws for arbitrary speech input', () => {
    fc.assert(fc.property(fc.string({ maxLength: 500 }), (text) => {
      expect(() => parseReminderCommand(text, local(2026, 6, 25, 12, 0))).not.toThrow();
    }), { numRuns: 1000 });
  });

  test('strict date constructor accepts exactly valid Gregorian dates', () => {
    fc.assert(fc.property(
      fc.integer({ min: 2000, max: 2100 }),
      fc.integer({ min: 0, max: 11 }),
      fc.integer({ min: 1, max: 31 }),
      (year, month, day) => {
        const result = createStrictLocalDate(year, month, day);
        const expected = new Date(year, month, day, 12, 0, 0, 0);
        const valid = expected.getFullYear() === year && expected.getMonth() === month && expected.getDate() === day;
        expect(Boolean(result)).toBe(valid);
      }
    ), { numRuns: 1000 });
  });

  test('valid relative minute reminders advance by the requested amount', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 1440 }), (minutes) => {
      const now = local(2026, 6, 25, 10, 0);
      const parsed = parseReminderCommand(`Remind me to check prep in ${minutes} minutes`, now);
      expect(parsed.validationError).toBe('');
      expect(new Date(parsed.scheduledAt).getTime() - now.getTime()).toBe(minutes * 60 * 1000);
    }), { numRuns: 300 });
  });

  test('scheduled reminder output is never in the past', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 23 }),
      fc.integer({ min: 0, max: 59 }),
      (hour, minute) => {
        const now = local(2026, 6, 25, 20, 30);
        const suffix = hour >= 12 ? 'pm' : 'am';
        const h12 = hour % 12 || 12;
        const parsed = parseReminderCommand(`Remind me to check line at ${h12}:${String(minute).padStart(2, '0')} ${suffix}`, now);
        if (parsed.scheduledAt) expect(new Date(parsed.scheduledAt).getTime()).toBeGreaterThan(now.getTime());
      }
    ), { numRuns: 300 });
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
