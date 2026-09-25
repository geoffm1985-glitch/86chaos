import { createSchedulePublishGuard, getSchedulePublishProgressPercent, makeSchedulePublishProgress } from './schedulePublishProgress';

test('schedule publish guard rejects a second launch until the active publish ends', () => {
  const guard = createSchedulePublishGuard();
  expect(guard.begin()).toBe(true);
  expect(guard.isActive()).toBe(true);
  expect(guard.begin()).toBe(false);
  guard.end();
  expect(guard.isActive()).toBe(false);
  expect(guard.begin()).toBe(true);
});

test('schedule publish progress advances monotonically through real publish phases', () => {
  const values = [
    getSchedulePublishProgressPercent('preparing'),
    getSchedulePublishProgressPercent('loading'),
    getSchedulePublishProgressPercent('planning'),
    getSchedulePublishProgressPercent('confirming'),
    getSchedulePublishProgressPercent('backup'),
    getSchedulePublishProgressPercent('publishing', 1, 2),
    getSchedulePublishProgressPercent('publishing', 2, 2),
    getSchedulePublishProgressPercent('verifying', 1, 2),
    getSchedulePublishProgressPercent('verifying', 2, 2),
    getSchedulePublishProgressPercent('time-off'),
    getSchedulePublishProgressPercent('notifications'),
    getSchedulePublishProgressPercent('complete'),
  ];
  expect(values).toEqual([...values].sort((a, b) => a - b));
  expect(values[0]).toBeGreaterThan(0);
  expect(values[values.length - 1]).toBe(100);
});

test('completed and cancelled progress states are not active', () => {
  expect(makeSchedulePublishProgress({ phase: 'complete' }).active).toBe(false);
  expect(makeSchedulePublishProgress({ phase: 'cancelled' }).active).toBe(false);
  expect(makeSchedulePublishProgress({ phase: 'publishing', current: 1, total: 3 }).active).toBe(true);
});
