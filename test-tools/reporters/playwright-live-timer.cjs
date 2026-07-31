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
function statusText(status) {
  if (status === 'passed') return color('32;1', '✓ PASS');
  if (status === 'skipped') return color('33;1', '○ SKIP');
  if (status === 'timedOut') return color('31;1', '⏱ TIMEOUT');
  if (status === 'interrupted') return color('31;1', '■ INTERRUPTED');
  return color('31;1', '✗ FAIL');
}

class LiveTimerReporter {
  constructor(options = {}) {
    this.tickMs = Math.max(250, Number(options.tickMs || process.env.CHAOS_TEST_TIMER_TICK_MS || 1000));
    this.active = new Map();
    this.finished = [];
    this.startedAt = 0;
    this.interval = null;
    this.lastTtyLength = 0;
    this.total = 0;
    this.startedCount = 0;
    this.completedCount = 0;
    this.ordinalByTestId = new Map();
    this.runDir = process.env.CHAOS_RELEASE_GATE_RUN_DIR || '';
  }

  _key(test, result) { return `${test.id || test.title}|${result.workerIndex ?? 0}|${result.retry ?? 0}`; }
  _project(test) {
    try {
      const project = typeof test.parent?.project === 'function' ? test.parent.project() : test.parent?.project;
      return project?.name || test.projectName || '';
    } catch (_) { return ''; }
  }
  _label(test) {
    const parts = typeof test.titlePath === 'function' ? test.titlePath() : [test.title];
    return crop((parts || []).filter(Boolean).join(' > ') || test.title || 'Unnamed Playwright test');
  }
  _clearTtyLine() {
    if (!process.stdout.isTTY || !this.lastTtyLength) return;
    process.stdout.write(`\r${' '.repeat(this.lastTtyLength)}\r`);
    this.lastTtyLength = 0;
  }
  _ordinal(row) { return `${row.ordinal || this.completedCount + 1}/${this.total || '?'}`; }
  _runningPlain(row, now = Date.now()) {
    return `[RUNNING ${fmt(now - row.startedAt)}] [${this._ordinal(row)}] [PLAYWRIGHT] [${row.project || 'project'}] ${row.label}${row.retry ? ` (retry ${row.retry})` : ''}`;
  }
  _renderTick() {
    if (!this.active.size) return;
    const now = Date.now();
    const rows = [...this.active.values()].sort((a, b) => a.startedAt - b.startedAt);
    for (const row of rows) {
      if (now - row.lastLoggedAt < this.tickMs) continue;
      row.lastLoggedAt = now;
      const plain = this._runningPlain(row, now);
      appendTranscript(plain);
      if (process.stdout.isTTY && rows.length === 1) {
        const rendered = color('36;1', plain);
        process.stdout.write(`\r${rendered}${' '.repeat(Math.max(0, this.lastTtyLength - plain.length))}`);
        this.lastTtyLength = plain.length;
      } else {
        process.stdout.write(`${color('36;1', plain)}\n`);
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

  onBegin(_config, suite) {
    this.startedAt = Date.now();
    this.total = suite.allTests().length;
    writeLine('');
    writeLine(color('36;1', '86 CHAOS LIVE PLAYWRIGHT TEST TIMER'));
    writeLine(`Discovered ${this.total} Playwright test${this.total === 1 ? '' : 's'}.`);
    writeLine('Every individual test prints START, a one-second live timer, and a final PASS/FAIL/TIMEOUT/SKIP duration.');
    writeLine('');
  }

  onTestBegin(test, result) {
    this._clearTtyLine();
    const testId = test.id || `${this._project(test)}|${this._label(test)}`;
    let ordinal = this.ordinalByTestId.get(testId);
    if (!ordinal) {
      this.startedCount += 1;
      ordinal = this.startedCount;
      this.ordinalByTestId.set(testId, ordinal);
    }
    const row = {
      key: this._key(test, result),
      id: testId,
      label: this._label(test),
      project: this._project(test),
      retry: Number(result.retry || 0),
      ordinal,
      startedAt: Date.now(),
      lastLoggedAt: 0,
    };
    this.active.set(row.key, row);
    writeLine(`${color('36', 'START')} [${this._ordinal(row)}] [PLAYWRIGHT] [${row.project || 'project'}] ${row.label}${row.retry ? ` (retry ${row.retry})` : ''}`);
    this._ensureTimer();
    this._renderTick();
  }

  onTestEnd(test, result) {
    this._clearTtyLine();
    const key = this._key(test, result);
    const row = this.active.get(key) || {
      key,
      label: this._label(test),
      project: this._project(test),
      retry: Number(result.retry || 0),
      ordinal: ++this.startedCount,
      startedAt: Date.now() - Number(result.duration || 0),
    };
    this.active.delete(key);
    this.completedCount += 1;
    const durationMs = Number(result.duration || (Date.now() - row.startedAt));
    const status = result.status || 'failed';
    const errors = (result.errors || []).map(error => clean(error.message || error.value || '')).filter(Boolean);
    const artifacts = (result.attachments || []).map(item => item.path).filter(Boolean);
    const plain = `${status === 'passed' ? '✓ PASS' : status === 'skipped' ? '○ SKIP' : status === 'timedOut' ? '⏱ TIMEOUT' : status === 'interrupted' ? '■ INTERRUPTED' : '✗ FAIL'} ${fmt(durationMs)} [${this._ordinal(row)}] [PLAYWRIGHT] [${row.project || 'project'}] ${row.label}${row.retry ? ` (retry ${row.retry})` : ''}`;
    writeLine(`${statusText(status)} ${fmt(durationMs)} [${this._ordinal(row)}] [PLAYWRIGHT] [${row.project || 'project'}] ${row.label}${row.retry ? ` (retry ${row.retry})` : ''}`);
    if (!['passed', 'skipped'].includes(status) && errors.length) writeLine(color('31', `  ${crop(errors[0], 320)}`));
    if (!['passed', 'skipped'].includes(status) && artifacts.length) writeLine(color('33', `  Artifacts: ${artifacts.join(', ')}`));
    this.finished.push({
      title: row.label,
      project: row.project,
      retry: row.retry,
      status,
      durationMs,
      duration: fmt(durationMs),
      errors,
      artifacts,
      outputLine: plain,
    });
    this._stopTimerIfIdle();
  }

  onError(error) {
    this._clearTtyLine();
    writeLine(`${color('31;1', 'GLOBAL ERROR')} ${crop(error?.message || error, 320)}`);
  }

  async onEnd(result) {
    this._clearTtyLine();
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    const elapsed = Date.now() - this.startedAt;
    const counts = this.finished.reduce((acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      if (row.retry) acc.retries = (acc.retries || 0) + 1;
      return acc;
    }, {});
    const slowest = [...this.finished].sort((a, b) => b.durationMs - a.durationMs).slice(0, 25);
    const failures = this.finished.filter(row => !['passed', 'skipped'].includes(row.status));
    writeLine('');
    writeLine(color(result.status === 'passed' ? '32;1' : '31;1', `PLAYWRIGHT ${String(result.status || '').toUpperCase()} in ${fmt(elapsed)}`));
    writeLine(`Total: ${this.finished.length}/${this.total} | Passed: ${counts.passed || 0} | Failed: ${counts.failed || 0} | Timed out: ${counts.timedOut || 0} | Skipped: ${counts.skipped || 0} | Interrupted: ${counts.interrupted || 0} | Retries: ${counts.retries || 0}`);
    if (slowest.length) {
      writeLine('Slowest 25 Playwright tests:');
      slowest.forEach((row, index) => writeLine(`  ${index + 1}. ${row.duration} [${row.project}] ${row.title}`));
    }
    if (failures.length) {
      writeLine('Failed Playwright tests:');
      failures.forEach(row => writeLine(`  ${row.status.toUpperCase()} ${row.duration} [${row.project}] ${row.title}${row.artifacts.length ? ` | ${row.artifacts.join(', ')}` : ''}`));
    }
    if (this.runDir) {
      try {
        const out = path.join(this.runDir, 'playwright-live-timer-summary.json');
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), status: result.status, durationMs: elapsed, duration: fmt(elapsed), counts, totalDiscovered: this.total, tests: this.finished, slowest, failures }, null, 2));
      } catch (_) {}
    }
  }
}

module.exports = LiveTimerReporter;
