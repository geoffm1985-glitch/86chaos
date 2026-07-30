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
function crop(value, max = 160) { const text = clean(value); return text.length > max ? `${text.slice(0, max - 1)}…` : text; }
function color(code, text) { return process.stdout.isTTY ? `\u001b[${code}m${text}\u001b[0m` : text; }

class JestLiveTimerReporter {
  constructor() {
    this.active = new Map();
    this.interval = null;
    this.lastLineLength = 0;
    this.fileStart = new Map();
  }
  _clear() {
    if (!process.stdout.isTTY || !this.lastLineLength) return;
    process.stdout.write(`\r${' '.repeat(this.lastLineLength)}\r`);
    this.lastLineLength = 0;
  }
  _tick() {
    if (!this.active.size) return;
    const row = [...this.active.values()].sort((a, b) => a.startedAt - b.startedAt)[0];
    const message = `[RUNNING ${fmt(Date.now() - row.startedAt)}] [JEST] ${row.label}`;
    if (process.stdout.isTTY) {
      process.stdout.write(`\r${color('36;1', message)}${' '.repeat(Math.max(0, this.lastLineLength - message.length))}`);
      this.lastLineLength = message.length;
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
    if (options?.estimatedTime) process.stdout.write(`Estimated Jest time: ${options.estimatedTime}s\n`);
  }
  onTestStart(test) {
    this.fileStart.set(test.path, Date.now());
  }
  onTestCaseStart(test, info) {
    this._clear();
    const title = [...(info.ancestorTitles || []), info.title || 'Unnamed test'].join(' > ');
    const key = `${test.path}|${title}`;
    const row = { key, label: crop(title), startedAt: Date.now() };
    this.active.set(key, row);
    process.stdout.write(`${color('36', 'START')} [JEST] ${row.label}\n`);
    this._ensure();
    this._tick();
  }
  onTestCaseResult(test, result) {
    this._clear();
    const title = [...(result.ancestorTitles || []), result.title || 'Unnamed test'].join(' > ');
    const key = `${test.path}|${title}`;
    const row = this.active.get(key) || { label: crop(title), startedAt: Date.now() - (result.duration || 0) };
    this.active.delete(key);
    const status = result.status === 'passed' ? color('32;1', 'PASS') : result.status === 'pending' ? color('33;1', 'SKIP') : color('31;1', 'FAIL');
    process.stdout.write(`${status} ${fmt(result.duration || (Date.now() - row.startedAt))} [JEST] ${row.label}\n`);
    this._stop();
  }
  onTestResult(test, result) {
    if (!this.active.size && !result.testResults?.length) {
      const startedAt = this.fileStart.get(test.path) || Date.now();
      const status = result.numFailingTests ? color('31;1', 'FAIL') : color('32;1', 'PASS');
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
