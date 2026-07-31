'use strict';

const fs = require('fs');
const path = require('path');
const { appendTranscript, writeLine } = require('./transcript-writer.cjs');

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
function color(code, text) { return process.stdout.isTTY ? `\u001b[${code}m${text}\u001b[0m` : text; }

class JestLiveTimerReporter {
  constructor() {
    this.active = new Map();
    this.finished = [];
    this.interval = null;
    this.lastTtyLength = 0;
    this.total = Number(process.env.CHAOS_JEST_TEST_TOTAL || 0);
    this.started = 0;
    this.completed = 0;
    this.runStartedAt = 0;
    this.runDir = process.env.CHAOS_RELEASE_GATE_RUN_DIR || '';
  }
  _key(test, title) { return `${test.path}|${title}`; }
  _clear() {
    if (!process.stdout.isTTY || !this.lastTtyLength) return;
    process.stdout.write(`\r${' '.repeat(this.lastTtyLength)}\r`);
    this.lastTtyLength = 0;
  }
  _ordinal(row) { return `${row.ordinal}/${this.total || '?'}`; }
  _tick() {
    if (!this.active.size) return;
    const now = Date.now();
    const rows = [...this.active.values()].sort((a, b) => a.startedAt - b.startedAt);
    for (const row of rows) {
      if (now - row.lastLoggedAt < 1000) continue;
      row.lastLoggedAt = now;
      const plain = `[RUNNING ${fmt(now - row.startedAt)}] [${this._ordinal(row)}] [JEST] ${row.label}`;
      appendTranscript(plain);
      if (process.stdout.isTTY && rows.length === 1) {
        process.stdout.write(`\r${color('36;1', plain)}${' '.repeat(Math.max(0, this.lastTtyLength - plain.length))}`);
        this.lastTtyLength = plain.length;
      } else {
        process.stdout.write(`${color('36;1', plain)}\n`);
      }
    }
  }
  _ensure() {
    if (this.interval) return;
    this.interval = setInterval(() => this._tick(), 1000);
    this.interval.unref?.();
  }
  _stopIfIdle() {
    if (this.active.size || !this.interval) return;
    clearInterval(this.interval);
    this.interval = null;
  }
  onRunStart(results, options) {
    this.runStartedAt = Date.now();
    if (!this.total) this.total = Number(results?.numTotalTests || 0);
    writeLine('');
    writeLine(color('36;1', '86 CHAOS LIVE JEST TEST TIMER'));
    writeLine(`Discovered ${this.total || 'an unknown number of'} Jest tests.`);
    if (options?.estimatedTime) writeLine(`Estimated Jest duration: ${options.estimatedTime}s.`);
    writeLine('Every individual Jest test prints START, a one-second live timer, and a final duration.');
  }
  onTestCaseStart(test, info) {
    this._clear();
    this.started += 1;
    const title = [...(info.ancestorTitles || []), info.title || 'Unnamed Jest test'].join(' > ');
    const row = { key: this._key(test, title), label: crop(title), ordinal: this.started, startedAt: Date.now(), lastLoggedAt: 0 };
    this.active.set(row.key, row);
    writeLine(`${color('36', 'START')} [${this._ordinal(row)}] [JEST] ${row.label}`);
    this._ensure();
    this._tick();
  }
  onTestCaseResult(test, result) {
    this._clear();
    const title = [...(result.ancestorTitles || []), result.title || 'Unnamed Jest test'].join(' > ');
    const key = this._key(test, title);
    const row = this.active.get(key) || { label: crop(title), ordinal: ++this.started, startedAt: Date.now() - Number(result.duration || 0) };
    this.active.delete(key);
    this.completed += 1;
    const durationMs = Number(result.duration || (Date.now() - row.startedAt));
    const status = result.status || 'failed';
    const icon = status === 'passed' ? color('32;1', '✓ PASS') : status === 'pending' || status === 'todo' || status === 'disabled' ? color('33;1', '○ SKIP') : color('31;1', '✗ FAIL');
    writeLine(`${icon} ${fmt(durationMs)} [${this._ordinal(row)}] [JEST] ${row.label}`);
    const errors = (result.failureMessages || []).map(clean).filter(Boolean);
    if (status === 'failed' && errors.length) writeLine(color('31', `  ${crop(errors[0], 320)}`));
    this.finished.push({ title: row.label, status, durationMs, duration: fmt(durationMs), errors });
    this._stopIfIdle();
  }
  onRunComplete(_contexts, aggregated) {
    this._clear();
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    const durationMs = Date.now() - this.runStartedAt;
    const counts = this.finished.reduce((acc, row) => { acc[row.status] = (acc[row.status] || 0) + 1; return acc; }, {});
    const slowest = [...this.finished].sort((a, b) => b.durationMs - a.durationMs).slice(0, 25);
    const failures = this.finished.filter(row => row.status === 'failed');
    writeLine('');
    writeLine(color(aggregated?.success ? '32;1' : '31;1', `JEST ${aggregated?.success ? 'PASSED' : 'FAILED'} in ${fmt(durationMs)}`));
    writeLine(`Total: ${this.finished.length}/${this.total || aggregated?.numTotalTests || '?'} | Passed: ${counts.passed || 0} | Failed: ${counts.failed || 0} | Skipped: ${(counts.pending || 0) + (counts.todo || 0) + (counts.disabled || 0)}`);
    if (slowest.length) {
      writeLine('Slowest 25 Jest tests:');
      slowest.forEach((row, index) => writeLine(`  ${index + 1}. ${row.duration} ${row.title}`));
    }
    if (failures.length) {
      writeLine('Failed Jest tests:');
      failures.forEach(row => writeLine(`  FAIL ${row.duration} ${row.title}`));
    }
    if (this.runDir) {
      try {
        fs.writeFileSync(path.join(this.runDir, 'jest-live-timer-summary.json'), JSON.stringify({ generatedAt: new Date().toISOString(), success: Boolean(aggregated?.success), durationMs, duration: fmt(durationMs), counts, totalDiscovered: this.total || aggregated?.numTotalTests || 0, tests: this.finished, slowest, failures }, null, 2));
      } catch (_) {}
    }
  }
}

module.exports = JestLiveTimerReporter;
