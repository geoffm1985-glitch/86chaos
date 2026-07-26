import { parseReminderCommand, makeReminderDate } from './reminderUtils';

const localNow = (year, monthIndex, day, hour = 12, minute = 0) => new Date(year, monthIndex, day, hour, minute, 0, 0);

describe('reminderUtils parsing', () => {
  test('rejects impossible slash dates', () => {
    expect(parseReminderCommand('Remind me to check inventory on 2/31 at 9am', localNow(2026, 0, 1)).validationError).toBe('That calendar date is not valid.');
    expect(parseReminderCommand('Remind me to check inventory on 4/31 at 9am', localNow(2026, 0, 1)).validationError).toBe('That calendar date is not valid.');
  });

  test('handles leap-year February 29 correctly', () => {
    expect(parseReminderCommand('Remind me to count freezer on 2/29/2024 at 9am', localNow(2024, 0, 1)).validationError).toBe('');
    expect(parseReminderCommand('Remind me to count freezer on 2/29/2023 at 9am', localNow(2023, 0, 1)).validationError).toBe('That calendar date is not valid.');
  });

  test('parses half-hour, quarter-hour, and one-hour phrases', () => {
    const now = localNow(2026, 6, 25, 10, 0);
    expect(parseReminderCommand('Remind me to check fryer in half an hour', now).timeInput).toBe('10:30');
    expect(parseReminderCommand('Remind me to check fryer in a half hour', now).timeInput).toBe('10:30');
    expect(parseReminderCommand('Remind me to check fryer in a quarter hour', now).timeInput).toBe('10:15');
    expect(parseReminderCommand('Remind me to check fryer in an hour', now).timeInput).toBe('11:00');
  });

  test('removes parsed time phrases from reminder titles', () => {
    expect(parseReminderCommand('Remind me to check the fryer in half an hour', localNow(2026, 6, 25, 10, 0)).title).toBe('check the fryer');
  });

  test('rejects explicit today times that already passed but rolls bare times forward', () => {
    const now = localNow(2026, 6, 25, 20, 0);
    expect(parseReminderCommand('Remind me today at 6pm', now).validationError).toBe('That time has already passed today.');
    const bare = parseReminderCommand('Remind me at 6pm', now);
    expect(bare.validationError).toBe('');
    expect(bare.needsManualTime).toBe(false);
    expect(bare.dateInput).toBe('2026-07-26');
  });

  test('DST-adjacent dates still produce finite ISO values', () => {
    const parsed = parseReminderCommand('Remind me to check prep on March 8 at 9am', localNow(2026, 2, 1));
    expect(parsed.validationError).toBe('');
    expect(Number.isFinite(new Date(parsed.scheduledAt).getTime())).toBe(true);
  });

  test('invalid reminders are not ready for immediate Firestore creation', () => {
    const parsed = parseReminderCommand('Remind me to clean hood on 2/31 at 9am', localNow(2026, 0, 1));
    expect(parsed.validationError).toBeTruthy();
    expect(parsed.scheduledAt).toBe('');
    expect(makeReminderDate(parsed.dateInput, parsed.timeInput)).toBeNull();
  });
});
