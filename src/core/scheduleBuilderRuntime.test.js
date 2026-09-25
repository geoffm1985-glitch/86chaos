import { normalizeScheduleBuilderEvents, safeScheduleBuilderRecords, scheduleBuilderDateKey } from './scheduleBuilderRuntime';

test('Schedule Builder normalizes legacy event dates before render-time string operations', () => {
  const timestampDate = new Date('2026-09-20T12:00:00.000Z');
  const timestamp = { toDate: () => timestampDate };
  const plainTimestamp = { seconds: 1789905600, nanoseconds: 0 };
  const canonical = { id: 'canonical', type: 'special_event', date: '2026-09-18', title: 'Canonical' };
  const source = [
    canonical,
    { id: 'firebase', type: 'special_event', date: timestamp, title: 'Firestore Timestamp' },
    { id: 'plain', type: 'special_event', date: plainTimestamp, title: 'Serialized Timestamp' },
    { id: 'iso', type: 'special_event', date: '2026-09-22T01:30:00.000Z', title: 'Legacy ISO' },
    { id: 'alternate', type: 'special_event', eventDate: '2026-9-23', title: 'Legacy eventDate' },
    { id: 'deleted-history', type: 'special_event', date: new Date('2026-09-24T12:00:00.000Z'), deleted: true },
    { id: 'missing', type: 'special_event', date: null },
    { id: 'malformed', type: 'special_event', date: 'not-a-date' },
    null,
    'not-a-row'
  ];

  const normalized = normalizeScheduleBuilderEvents(source);
  expect(normalized.map(event => event.id)).toEqual(['canonical', 'firebase', 'plain', 'iso', 'alternate', 'deleted-history']);
  expect(normalized.every(event => event.date.startsWith('2026-09'))).toBe(true);
  expect(normalized.find(event => event.id === 'firebase').date).toBe('2026-09-20');
  expect(normalized.find(event => event.id === 'plain').date).toBe('2026-09-20');
  expect(normalized.find(event => event.id === 'alternate').date).toBe('2026-09-23');
  expect(canonical.date).toBe('2026-09-18');
  expect(scheduleBuilderDateKey({ toDate: () => { throw new Error('corrupt timestamp'); } })).toBe('');
  expect(safeScheduleBuilderRecords([null, {}, [], 'row'])).toEqual([{}]);
});

