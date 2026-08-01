const test = require('node:test');
const assert = require('node:assert/strict');
const state = require('../src/core/runtimeReportState.cjs');

function memoryStorage() {
  const map = new Map();
  return { getItem: (k) => map.has(k) ? map.get(k) : null, setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k), _map: map };
}

test('failed report submission is not permanently delivered-deduped', () => {
  const storage = memoryStorage();
  const error = new TypeError('TabGodMode exploded');
  const fp = state.buildRuntimeReportFingerprint('section-runtime-error', error, { appVersion: '16.0.95', route: '/?tab=godmode' });
  const first = state.beginReportSubmission(storage, fp);
  assert.equal(first.ok, true);
  state.failReportSubmission(storage, fp, 'authentication not ready', 'section_local_1');
  const second = state.beginReportSubmission(storage, fp);
  assert.equal(second.ok, true);
});

test('concurrent identical report attempts are in-flight deduped until failure or success', () => {
  const storage = memoryStorage();
  const fp = state.buildRuntimeReportFingerprint('chunk-failure', new Error('Loading chunk 12 failed'), { appVersion: '16.0.95', route: '/' });
  assert.equal(state.beginReportSubmission(storage, fp).ok, true);
  const second = state.beginReportSubmission(storage, fp);
  assert.equal(second.ok, false);
  assert.equal(second.state, 'in-flight');
});

test('successful report stores delivered fingerprint and links fallback to server id', () => {
  const storage = memoryStorage();
  const fp = state.buildRuntimeReportFingerprint('section-runtime-error', new Error('x'), { appVersion: '16.0.95', route: '/?tab=godmode' });
  assert.equal(state.beginReportSubmission(storage, fp).ok, true);
  const done = state.completeReportSubmission(storage, fp, 'm1iJOS8qGXf1by5VPTx3', 'section_local_1');
  assert.equal(done.ok, true);
  const again = state.beginReportSubmission(storage, fp);
  assert.equal(again.ok, false);
  assert.equal(again.state, 'delivered');
  assert.equal(again.reportId, 'm1iJOS8qGXf1by5VPTx3');
});

test('local diagnostics redact obvious secrets and include fallback ids', () => {
  const storage = memoryStorage();
  const diagnostic = state.createRuntimeDiagnostic({ fallbackReportId: 'section_local_abc', error: new Error('password=super-secret token abc'), route: '/?tab=godmode' });
  state.rememberLocalRuntimeDiagnostic(storage, diagnostic);
  const raw = storage.getItem(state.DIAGNOSTIC_STORAGE_KEY);
  assert.match(raw, /section_local_abc/);
  assert.doesNotMatch(raw, /super-secret/);
});

test('stale in-flight runtime report marker is removed and permits retry after reload', () => {
  const storage = memoryStorage();
  const fp = state.buildRuntimeReportFingerprint('section-runtime-error', new Error('TabGodMode stale in-flight'), { appVersion: '16.0.96', route: '/?tab=godmode' });
  const first = state.beginReportSubmission(storage, fp, { fallbackReportId: 'section_local_first', staleMs: 100 });
  assert.equal(first.ok, true);
  storage.setItem(first.inFlightKey, JSON.stringify({ at: new Date(Date.now() - 1000).toISOString(), atMs: Date.now() - 1000, fallbackReportId: 'section_local_first' }));
  const second = state.beginReportSubmission(storage, fp, { fallbackReportId: 'section_local_second', staleMs: 100 });
  assert.equal(second.ok, true);
  assert.match(storage.getItem(second.inFlightKey), /section_local_second/);
});

test('fresh in-flight runtime report marker still suppresses a duplicate', () => {
  const storage = memoryStorage();
  const fp = state.buildRuntimeReportFingerprint('chunk-failure', new Error('Loading chunk x failed'), { appVersion: '16.0.96', route: '/' });
  const first = state.beginReportSubmission(storage, fp, { staleMs: 60_000 });
  assert.equal(first.ok, true);
  const second = state.beginReportSubmission(storage, fp, { staleMs: 60_000 });
  assert.equal(second.ok, false);
  assert.equal(second.state, 'in-flight');
});
