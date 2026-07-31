'use strict';

const fs = require('fs');
const path = require('path');

function pad(value) { return String(value).padStart(2, '0'); }
function fmt(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
function clean(value = '') { return String(value).replace(/\s+/g, ' ').trim(); }
function crop(value, max = 180) { const text = clean(value); return text.length > max ? `${text.slice(0, max - 1)}…` : text; }
function color(code, text) { return process.stdout.isTTY ? `\u001b[${code}m${text}\u001b[0m` : text; }
function statusText(status) {
  if (status === 'passed') return color('32;1', '✓ PASS');
  if (status === 'skipped') return color('33;1', '○ SKIP');
  if (status === 'timedOut') return color('31;1', '⏱ TIMEOUT');
  if (status === 'interrupted') return color('31;1', '■ INTERRUPTED');
  return color('31;1', '✗ FAIL');
}

class LiveTimerReporter {
  constructor(options = {}) {
    this.tickMs = Number(options.tickMs || process.env.CHAOS_TEST_TIMER_TICK_MS || 1000);
    this.active = new Map();
    this.finished = [];
    this.interval = null;
    this.startedAt = 0;
    this.lastLineLength = 0;
    this.runDir = process.env.CHAOS_RELEASE_GATE_RUN_DIR || '';
    this.total = 0;
    this.startedCount = 0;
    this.finishedCount = 0;
  }
  _key(test, result) { return `${test.id || test.title}|${result.workerIndex || 0}|${result.retry || 0}`; }
  _project(test) {
    try { return test.parent?.project?.()?.name || test.parent?.project?.name || ''; } catch (_) { return ''; }
  }
  _label(test) {
    const parts = typeof test.titlePath === 'function' ? test.titlePath() : [test.title];
    return crop(parts.filter(Boolean).slice(-4).join(' > ') || test.title || 'Unnamed Playwright test', 190);
  }
  _clearActiveLine() {
    if (!process.stdout.isTTY || !this.lastLineLength) return;
    process.stdout.write(`\r${' '.repeat(this.lastLineLength)}\r`);
    this.lastLineLength = 0;
  }
  _runningMessage(row, now = Date.now()) {
    const count = row.ordinal && this.total ? `${row.ordinal}/${this.total}` : `${this.finishedCount + 1}/${this.total || '?'}`;
    return `[RUNNING ${fmt(now - row.startedAt)}] [${count}] [${row.project || 'project'}] ${row.label}`;
  }
  _renderTick() {
    if (!this.active.size) return;
    const now = Date.now();
    const rows = [...this.active.values()].sort((a, b) => a.startedAt - b.startedAt);
    for (const row of rows) {
      if (now - row.lastLoggedAt < this.tickMs) continue;
      row.lastLoggedAt = now;
      const message = this._runningMessage(row, now);
      if (process.stdout.isTTY && rows.length === 1) {
        const line = color('36;1', message);
        const plainLen = message.length;
        process.stdout.write(`\r${line}${' '.repeat(Math.max(0, this.lastLineLength - plainLen))}`);
        this.lastLineLength = plainLen;
      } else {
        process.stdout.write(`${color('36;1', message)}\n`);
      }
    }
  }
  _ensureTimer() {
    if (this.interval) return;
    this.interval = setInterval(() => this._renderTick(), this.tickMs);
    this.interval.unref?.();
  }
  _stopTimerIfIdle() {
    if (this.active.size || !this.interval) return;
    clearInterval(this.interval);
    this.interval = null;
  }

  onBegin(config, suite) {
    this.startedAt = Date.now();
    this.total = suite.allTests().length;
    process.stdout.write(`\n${color('36;1', '86 CHAOS LIVE PLAYWRIGHT TEST TIMER')}\n`);
    process.stdout.write(`Discovered ${this.total} Playwright test${this.total === 1 ? '' : 's'}.\n`);
    process.stdout.write('Each test prints START, a live elapsed timer while it runs, then PASS/FAIL/SKIP.\n\n');
  }

  onTestBegin(test, result) {
    this._clearActiveLine();
    this.startedCount += 1;
    const key = this._key(test, result);
    const row = {
      key,
      testId: test.id || '',
      title: test.title || '',
      label: this._label(test),
      project: this._project(test),
      retry: result.retry || 0,
      ordinal: this.startedCount,
      startedAt: Date.now(),
      lastLoggedAt: 0,
    };
    this.active.set(key, row);
    const count = this.total ? `${row.ordinal}/${this.total}` : `${row.ordinal}`;
    process.stdout.write(`${color('36', 'START')} [${count}] [${row.project || 'project'}] ${row.label}${row.retry ? ` (retry ${row.retry})` : ''}\n`);
    this._ensureTimer();
    this._renderTick();
  }

  onTestEnd(test, result) {
    this._clearActiveLine();
    const key = this._key(test, result);
    const fallbackStarted = Date.now() - (result.duration || 0);
    const row = this.active.get(key) || {
      label: this._label(test), project: this._project(test), startedAt: fallbackStarted, retry: result.retry || 0, ordinal: this.finishedCount + 1,
    };
    this.active.delete(key);
    this.finishedCount += 1;
    const duration = Number(result.duration || (Date.now() - row.startedAt));
    const status = result.status || 'failed';
    const errors = (result.errors || []).map(error => clean(error.message || error.value || '')).filter(Boolean);
    this.finished.push({ title: row.label, project: row.project, retry: row.retry, status, durationMs: duration, errors });
    const count = this.total ? `${this.finishedCount}/${this.total}` : `${this.finishedCount}`;
    process.stdout.write(`${statusText(status)} ${fmt(duration)} [${count}] [${row.project || 'project'}] ${row.label}${row.retry ? ` (retry ${row.retry})` : ''}\n`);
    if (status !== 'passed' && status !== 'skipped' && errors.length) {
      process.stdout.write(`${color('31', `  ${crop(errors[0], 240)}`)}\n`);
    }
    this._stopTimerIfIdle();
  }

  onError(error) {
    this._clearActiveLine();
    process.stdout.write(`${color('31;1', 'GLOBAL ERROR')} ${crop(error?.message || error, 240)}\n`);
  }

  async onEnd(result) {
    this._clearActiveLine();
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    const counts = this.finished.reduce((acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    }, {});
    const elapsed = Date.now() - this.startedAt;
    process.stdout.write(`\n${color(result.status === 'passed' ? '32;1' : '31;1', `PLAYWRIGHT ${String(result.status || '').toUpperCase()}`)} in ${fmt(elapsed)}\n`);
    process.stdout.write(`Passed: ${counts.passed || 0} | Failed: ${counts.failed || 0} | Timed out: ${counts.timedOut || 0} | Skipped: ${counts.skipped || 0}\n`);
    if (this.runDir) {
      try {
        const out = path.join(this.runDir, 'playwright-live-timer-summary.json');
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), status: result.status, durationMs: elapsed, counts, tests: this.finished }, null, 2));
      } catch (_) {}
    }
  }
}

module.exports = LiveTimerReporter;
