function pad(value) { return String(value).padStart(2, '0'); }
function fmt(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
function clean(value = '') { return String(value).replace(/\s+/g, ' ').trim(); }
function crop(value, max = 175) { const text = clean(value); return text.length > max ? `${text.slice(0, max - 1)}…` : text; }

export default async function* nodeLiveTimer(source) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const iterator = source[Symbol.asyncIterator]();
  const active = new Map();
  const tests = [];
  const totals = { started: 0, executed: 0, passed: 0, failed: 0, skipped: 0, cancelled: 0 };
  let nextPromise = iterator.next();
  let ordinal = 0;
  const startedAt = Date.now();
  const summaryPath = process.env.CHAOS_NODE_TEST_SUMMARY_PATH || (process.env.CHAOS_RELEASE_GATE_RUN_DIR ? path.join(process.env.CHAOS_RELEASE_GATE_RUN_DIR, 'node-test-live-summary.json') : '');
  const writeSummary = (extra = {}) => {
    if (!summaryPath) return;
    try {
      fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
      fs.writeFileSync(summaryPath, JSON.stringify({
        ok: totals.failed === 0 && totals.cancelled === 0,
        started: totals.started,
        executed: totals.executed,
        passed: totals.passed,
        failed: totals.failed,
        skipped: totals.skipped,
        cancelled: totals.cancelled,
        durationMs: Date.now() - startedAt,
        tests,
        ...extra,
      }, null, 2));
    } catch (_) {}
  };
  try {
    while (true) {
      const result = await Promise.race([
        nextPromise.then(value => ({ kind: 'event', value })),
        new Promise(resolve => setTimeout(() => resolve({ kind: 'tick' }), 1000)),
      ]);
      if (result.kind === 'tick') {
        if (active.size) {
          const now = Date.now();
          const rows = [...active.values()].sort((a, b) => a.startedAt - b.startedAt);
          for (const row of rows) {
            if (now - row.lastLoggedAt < 1000) continue;
            row.lastLoggedAt = now;
            yield `[RUNNING ${fmt(now - row.startedAt)}] [NODE ${row.ordinal}] ${row.label}\n`;
          }
        }
        continue;
      }
      const { value, done } = result.value;
      if (done) break;
      nextPromise = iterator.next();
      const type = value?.type || '';
      const data = value?.data || {};
      const file = data.file || data.testFile || '';
      const name = data.name || data.title || 'Unnamed Node test';
      const nesting = data.nesting || 0;
      const key = `${file}|${name}|${nesting}`;
      if (type === 'test:start') {
        ordinal += 1;
        totals.started += 1;
        const row = { label: crop(name), title: clean(name), file, nesting, startedAt: Date.now(), lastLoggedAt: 0, ordinal };
        active.set(key, row);
        yield `START [NODE ${row.ordinal}] ${row.label}\n`;
      } else if (type === 'test:pass' || type === 'test:fail' || type === 'test:skip' || type === 'test:cancel') {
        const rawStatus = type === 'test:pass' ? 'passed' : type === 'test:skip' ? 'skipped' : type === 'test:cancel' ? 'cancelled' : 'failed';
        const failureType = String(data.details?.error?.failureType || data.details?.failureType || '').toLowerCase();
        const statusName = rawStatus === 'failed' && /cancel/.test(failureType) ? 'cancelled' : rawStatus;
        const row = active.get(key) || { label: crop(name), title: clean(name), file, nesting, startedAt: Date.now() - Number(data.details?.duration_ms || 0), ordinal: ordinal + 1 };
        active.delete(key);
        const duration = Number(data.details?.duration_ms || (Date.now() - row.startedAt));
        totals.executed += 1;
        totals[statusName] += 1;
        const statusLabel = statusName === 'passed' ? '✓ PASS' : statusName === 'skipped' ? '○ SKIP' : statusName === 'cancelled' ? '⊘ CANCELLED' : '✗ FAIL';
        const errorMessage = clean(data.details?.error?.message || data.details?.error?.stack || data.details?.message || '');
        tests.push({ ordinal: row.ordinal, title: row.title || clean(name), file: row.file || file, status: statusName, durationMs: duration, error: errorMessage });
        yield `${statusLabel} ${fmt(duration)} [NODE ${row.ordinal}] ${row.label}\n`;
        if ((statusName === 'failed' || statusName === 'cancelled') && errorMessage) yield `  ${crop(errorMessage, 1000)}\n`;
        writeSummary();
      } else if (type === 'test:diagnostic') {
        yield `  ${clean(data.message || '')}\n`;
      } else if (type === 'test:stderr' || type === 'test:stdout') {
        if (data.message) yield String(data.message);
      }
    }
  } finally {
    for (const row of active.values()) {
      totals.executed += 1;
      totals.cancelled += 1;
      tests.push({ ordinal: row.ordinal, title: row.title, file: row.file, status: 'cancelled', durationMs: Date.now() - row.startedAt, error: 'Node test runner ended before this test reported pass/fail/skip.' });
      yield `⊘ CANCELLED ${fmt(Date.now() - row.startedAt)} [NODE ${row.ordinal}] ${row.label}\n`;
    }
    active.clear();
    writeSummary({ finishedAt: new Date().toISOString() });
  }
}
