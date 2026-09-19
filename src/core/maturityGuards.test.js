import {
  appendOfflineQueueItem,
  buildLocalMaturitySnapshot,
  classifyRuntimeIssue,
  normalizeOfflineQueue,
  readJsonFromStorage,
  recordLocalRuntimeEvent,
  redactSensitiveValue,
  safeJsonParse,
  writeJsonToStorage
} from './maturityGuards';

describe('maturity guardrails', () => {
  const makeStorage = () => {
    const rows = new Map();
    return {
      getItem: jest.fn(key => rows.has(key) ? rows.get(key) : null),
      setItem: jest.fn((key, value) => { rows.set(key, String(value)); }),
      removeItem: jest.fn(key => { rows.delete(key); }),
      dump: () => rows
    };
  };

  test('safeJsonParse returns fallback for corrupt data instead of throwing', () => {
    expect(safeJsonParse('{bad', { ok: false })).toEqual({ ok: false });
    expect(safeJsonParse('{"ok":true}', {})).toEqual({ ok: true });
  });

  test('corrupt local storage JSON is quarantined and repaired', () => {
    const storage = makeStorage();
    storage.setItem('queue', '{bad');
    const result = readJsonFromStorage(storage, 'queue', []);
    expect(result.value).toEqual([]);
    expect(result.repaired).toBe(true);
    expect(storage.removeItem).toHaveBeenCalledWith('queue');
    expect(Array.from(storage.dump().keys()).some(key => key.startsWith('queue_corrupt_'))).toBe(true);
  });

  test('offline queue drops malformed rows, redacts secrets, clamps duplicates, and keeps latest retry state', () => {
    const queue = normalizeOfflineQueue([
      null,
      { collectionName: '', action: 'set', docId: 'x' },
      { collectionName: 'shifts', action: 'update', docId: 's1', data: { title: 'A', fcmToken: 'secret' }, attemptCount: 0 },
      { collectionName: 'shifts', action: 'update', docId: 's1', data: { title: 'A', fcmToken: 'secret' }, attemptCount: 2, lastError: 'offline' }
    ]);
    expect(queue).toHaveLength(1);
    expect(queue[0].attemptCount).toBe(2);
    expect(queue[0].data.fcmToken).toBe('[redacted]');
  });

  test('appendOfflineQueueItem preserves valid queued writes and rejects updates without doc ids', () => {
    const queue = appendOfflineQueueItem([], { collectionName: 'tasks', action: 'update', data: { title: 'No doc' } });
    expect(queue).toHaveLength(0);
    const next = appendOfflineQueueItem(queue, { collectionName: 'tasks', action: 'add', data: { title: 'Prep' } });
    expect(next).toHaveLength(1);
    expect(next[0].collectionName).toBe('tasks');
  });

  test('redactSensitiveValue removes credential-like fields recursively', () => {
    const redacted = redactSensitiveValue({ nested: { apiKey: 'abc', password: 'pw', safe: 'ok' }, rows: [{ email: 'a@b.com' }] });
    expect(redacted.nested.apiKey).toBe('[redacted]');
    expect(redacted.nested.password).toBe('[redacted]');
    expect(redacted.nested.safe).toBe('ok');
    expect(redacted.rows[0].email).toBe('[redacted]');
  });

  test('local runtime events stay local, redacted, and summarized', () => {
    const storage = makeStorage();
    const events = recordLocalRuntimeEvent(storage, { type: 'safe-write-error', message: 'Failed to fetch token=abc', detail: { authToken: 'secret', collectionName: 'tasks' } });
    expect(events).toHaveLength(1);
    expect(events[0].issueType).toBe('network');
    expect(events[0].detail.authToken).toBe('[redacted]');
    expect(writeJsonToStorage(storage, 'snapshot', buildLocalMaturitySnapshot({ queue: [{ attemptCount: 1 }], runtimeEvents: events })).ok).toBe(true);
  });

  test('runtime issue classifier separates common operational failures', () => {
    expect(classifyRuntimeIssue('PERMISSION_DENIED')).toBe('permission');
    expect(classifyRuntimeIssue('failed to fetch')).toBe('network');
    expect(classifyRuntimeIssue('JSON parse failed')).toBe('data-shape');
  });
});
