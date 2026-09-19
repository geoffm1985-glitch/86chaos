'use strict';

function pad(value) { return String(value).padStart(2, '0'); }
function fmt(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
function clean(value = '') { return String(value).replace(/\s+/g, ' ').trim(); }
function crop(value, max = 170) { const text = clean(value); return text.length > max ? `${text.slice(0, max - 1)}…` : text; }
function color(code, text) { return process.stdout.isTTY ? `\u001b[${code}m${text}\u001b[0m` : text; }

class JestLiveTimerReporter {
  constructor() {
    this.active = new Map();
    this.interval = null;
    this.lastLineLength = 0;
    this.fileStart = new Map();
    this.totalStarted = 0;
    this.totalFinished = 0;
  }
  _clear() {
    if (!process.stdout.isTTY || !this.lastLineLength) return;
    process.stdout.write(`\r${' '.repeat(this.lastLineLength)}\r`);
    this.lastLineLength = 0;
  }
  _tick() {
    if (!this.active.size) return;
    const now = Date.now();
    const rows = [...this.active.values()].sort((a, b) => a.startedAt - b.startedAt);
    for (const row of rows) {
      if (now - row.lastLoggedAt < 1000) continue;
      row.lastLoggedAt = now;
      const message = `[RUNNING ${fmt(now - row.startedAt)}] [JEST ${row.ordinal}] ${row.label}`;
      if (process.stdout.isTTY && rows.length === 1) {
        process.stdout.write(`\r${color('36;1', message)}${' '.repeat(Math.max(0, this.lastLineLength - message.length))}`);
        this.lastLineLength = message.length;
      } else {
        process.stdout.write(`${color('36;1', message)}\n`);
      }
    }
  }
  _ensure() {
    if (this.interval) return;
    this.interval = setInterval(() => this._tick(), 1000);
    this.interval.unref?.();
  }
  _stop() {
    if (this.active.size || !this.interval) return;
    clearInterval(this.interval);
    this.interval = null;
  }
  onRunStart(_, options) {
    process.stdout.write(`\n${color('36;1', '86 CHAOS JEST LIVE TEST TIMER')}\n`);
    process.stdout.write('Each Jest test prints START, a live elapsed timer while it runs, then PASS/FAIL/SKIP.\n');
    if (options?.estimatedTime) process.stdout.write(`Estimated Jest time: ${options.estimatedTime}s\n`);
  }
  onTestStart(test) {
    this.fileStart.set(test.path, Date.now());
  }
  onTestCaseStart(test, info) {
    this._clear();
    this.totalStarted += 1;
    const title = [...(info.ancestorTitles || []), info.title || 'Unnamed Jest test'].join(' > ');
    const key = `${test.path}|${title}`;
    const row = { key, label: crop(title), startedAt: Date.now(), lastLoggedAt: 0, ordinal: this.totalStarted };
    this.active.set(key, row);
    process.stdout.write(`${color('36', 'START')} [JEST ${row.ordinal}] ${row.label}\n`);
    this._ensure();
    this._tick();
  }
  onTestCaseResult(test, result) {
    this._clear();
    const title = [...(result.ancestorTitles || []), result.title || 'Unnamed Jest test'].join(' > ');
    const key = `${test.path}|${title}`;
    const row = this.active.get(key) || { label: crop(title), startedAt: Date.now() - (result.duration || 0), ordinal: this.totalFinished + 1 };
    this.active.delete(key);
    this.totalFinished += 1;
    const status = result.status === 'passed' ? color('32;1', '✓ PASS') : result.status === 'pending' ? color('33;1', '○ SKIP') : color('31;1', '✗ FAIL');
    process.stdout.write(`${status} ${fmt(result.duration || (Date.now() - row.startedAt))} [JEST ${row.ordinal}] ${row.label}\n`);
    if (result.failureMessages?.length) process.stdout.write(`  ${crop(result.failureMessages[0], 240)}\n`);
    this._stop();
  }
  onTestResult(test, result) {
    if (!this.active.size && !result.testResults?.length) {
      const startedAt = this.fileStart.get(test.path) || Date.now();
      const status = result.numFailingTests ? color('31;1', '✗ FAIL') : color('32;1', '✓ PASS');
      process.stdout.write(`${status} ${fmt(Date.now() - startedAt)} [JEST FILE] ${crop(test.path)}\n`);
    }
  }
  onRunComplete() {
    this._clear();
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }
}

module.exports = JestLiveTimerReporter;
