import { Transform } from 'node:stream';
import fs from 'node:fs';
import path from 'node:path';

const tickMs = Math.max(250, Number(process.env.CHAOS_TEST_TIMER_TICK_MS || 1000));
const totalExpected = Number(process.env.CHAOS_NODE_TEST_TOTAL || 0);
const runDir = process.env.CHAOS_RELEASE_GATE_RUN_DIR || '';
const transcript = runDir ? path.join(runDir, 'ultimate-live-test-transcript.txt') : '';
const active = new Map();
const finished = [];
let started = 0;
let completed = 0;
let runStartedAt = Date.now();

function pad(value) { return String(value).padStart(2, '0'); }
function fmt(ms) {
  const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
function clean(value = '') { return String(value).replace(/\u001b\[[0-9;]*m/g, '').replace(/\s+/g, ' ').trim(); }
function crop(value, max = 230) { const text = clean(value); return text.length > max ? `${text.slice(0, max - 1)}…` : text; }
function append(line = '') {
  if (!transcript) return;
  try { fs.mkdirSync(path.dirname(transcript), { recursive: true }); fs.appendFileSync(transcript, `${clean(line)}\n`, 'utf8'); } catch {}
}
function emitLine(stream, line = '') { stream.push(`${line}\n`); append(line); }
function keyOf(data = {}) { return `${data.nesting || 0}|${data.name || ''}|${data.file || ''}|${data.line || 0}`; }
function totalLabel(row) { return `${row.ordinal}/${totalExpected || '?'}`; }

export default function nodeLiveTimerReporter() {
  const stream = new Transform({ objectMode: true });
  const timer = setInterval(() => {
    const now = Date.now();
    for (const row of [...active.values()].sort((a, b) => a.startedAt - b.startedAt)) {
      if (now - row.lastLoggedAt < tickMs) continue;
      row.lastLoggedAt = now;
      emitLine(stream, `[RUNNING ${fmt(now - row.startedAt)}] [${totalLabel(row)}] [NODE] ${row.label}`);
    }
  }, tickMs);
  timer.unref?.();

  emitLine(stream, '');
  emitLine(stream, '86 CHAOS LIVE NODE TEST TIMER');
  emitLine(stream, `Expected Node tests: ${totalExpected || 'dynamic discovery'}.`);
  emitLine(stream, 'Every individual Node test prints START, a one-second live timer, and a final duration.');

  stream._transform = (event, _encoding, callback) => {
    try {
      const type = event?.type || '';
      const data = event?.data || {};
      const key = keyOf(data);
      if (type === 'test:start' && data.nesting > 0) {
        started += 1;
        const row = { key, ordinal: started, label: crop(data.name || 'Unnamed Node test'), startedAt: Date.now(), lastLoggedAt: 0 };
        active.set(key, row);
        emitLine(stream, `START [${totalLabel(row)}] [NODE] ${row.label}`);
      } else if (type === 'test:pass' && data.nesting > 0) {
        const row = active.get(key) || { ordinal: ++started, label: crop(data.name || 'Unnamed Node test'), startedAt: Date.now() - Number(data.details?.duration_ms || 0) };
        active.delete(key);
        completed += 1;
        const durationMs = Number(data.details?.duration_ms || Date.now() - row.startedAt);
        const skipped = Boolean(data.skip || data.details?.skip || data.details?.type === 'skip');
        emitLine(stream, `${skipped ? '○ SKIP' : '✓ PASS'} ${fmt(durationMs)} [${totalLabel(row)}] [NODE] ${row.label}`);
        finished.push({ title: row.label, status: skipped ? 'skipped' : 'passed', durationMs, duration: fmt(durationMs) });
      } else if (type === 'test:fail' && data.nesting > 0) {
        const row = active.get(key) || { ordinal: ++started, label: crop(data.name || 'Unnamed Node test'), startedAt: Date.now() - Number(data.details?.duration_ms || 0) };
        active.delete(key);
        completed += 1;
        const durationMs = Number(data.details?.duration_ms || Date.now() - row.startedAt);
        emitLine(stream, `✗ FAIL ${fmt(durationMs)} [${totalLabel(row)}] [NODE] ${row.label}`);
        const message = crop(data.details?.error?.message || data.details?.error || '', 320);
        if (message) emitLine(stream, `  ${message}`);
        finished.push({ title: row.label, status: 'failed', durationMs, duration: fmt(durationMs), error: message });
      } else if (type === 'test:skip' && data.nesting > 0) {
        const row = active.get(key) || { ordinal: ++started, label: crop(data.name || 'Unnamed Node test'), startedAt: Date.now() };
        active.delete(key);
        completed += 1;
        emitLine(stream, `○ SKIP 00:00:00 [${totalLabel(row)}] [NODE] ${row.label}`);
        finished.push({ title: row.label, status: 'skipped', durationMs: 0, duration: '00:00:00' });
      } else if (type === 'test:diagnostic' && data.message) {
        emitLine(stream, `  ${clean(data.message)}`);
      }
      callback();
    } catch (error) { callback(error); }
  };

  stream._flush = callback => {
    clearInterval(timer);
    const durationMs = Date.now() - runStartedAt;
    const counts = finished.reduce((acc, row) => { acc[row.status] = (acc[row.status] || 0) + 1; return acc; }, {});
    const slowest = [...finished].sort((a, b) => b.durationMs - a.durationMs).slice(0, 25);
    emitLine(stream, '');
    emitLine(stream, `NODE TESTS FINISHED in ${fmt(durationMs)}`);
    emitLine(stream, `Total: ${finished.length}/${totalExpected || finished.length} | Passed: ${counts.passed || 0} | Failed: ${counts.failed || 0} | Skipped: ${counts.skipped || 0}`);
    if (slowest.length) {
      emitLine(stream, 'Slowest 25 Node tests:');
      slowest.forEach((row, index) => emitLine(stream, `  ${index + 1}. ${row.duration} ${row.title}`));
    }
    if (runDir) {
      try { fs.writeFileSync(path.join(runDir, 'node-live-timer-summary.json'), JSON.stringify({ generatedAt: new Date().toISOString(), durationMs, duration: fmt(durationMs), counts, totalExpected, tests: finished, slowest }, null, 2)); } catch {}
    }
    callback();
  };

  return stream;
}
