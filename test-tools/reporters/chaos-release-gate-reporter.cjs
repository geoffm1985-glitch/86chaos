'use strict';

const fs = require('fs');
const path = require('path');

const LINE = '============================================================';
const DASH = '------------------------------------------------------------';

function readJsonIfExists(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null;
  }
}

function readPackageVersion(root = process.cwd()) {
  try {
    const pkg = readJsonIfExists(path.join(root, 'package.json')) || {};
    return pkg.version || '';
  } catch (_) {
    return '';
  }
}

function ascii(value = '') {
  return String(value || '')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2022]/g, '-')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '?');
}

function normalizeStatus(status = '') {
  const raw = String(status || '').toLowerCase();
  if (raw === 'passed' || raw === 'pass') return 'passed';
  if (raw === 'skipped' || raw === 'skip') return 'skipped';
  if (raw === 'timedout' || raw === 'timeout' || raw === 'timedOut'.toLowerCase()) return 'timedOut';
  if (raw === 'interrupted') return 'interrupted';
  return raw || 'failed';
}

function statusLabel(status = '') {
  const normalized = normalizeStatus(status);
  if (normalized === 'passed') return 'PASS';
  if (normalized === 'skipped') return 'SKIP';
  if (normalized === 'timedOut') return 'TIMEOUT';
  if (normalized === 'interrupted') return 'INTERRUPTED';
  return 'FAIL';
}

function formatDuration(ms = 0) {
  const value = Number(ms || 0);
  if (!Number.isFinite(value) || value <= 0) return '0s';
  const seconds = value / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}m ${String(remainder).padStart(2, '0')}s`;
}

function countByStatus(results = []) {
  const counts = { total: 0, passed: 0, failed: 0, timedOut: 0, skipped: 0, interrupted: 0 };
  for (const row of results || []) {
    counts.total += 1;
    const status = normalizeStatus(row.status);
    if (status === 'passed') counts.passed += 1;
    else if (status === 'skipped') counts.skipped += 1;
    else if (status === 'timedOut') counts.timedOut += 1;
    else if (status === 'interrupted') counts.interrupted += 1;
    else counts.failed += 1;
  }
  return counts;
}

function testProjectName(test = {}, fallback = '') {
  if (typeof test.project === 'function') {
    try { return test.project()?.name || fallback || ''; } catch (_) {}
  }
  if (test.projectName) return test.projectName;
  if (test.parent && typeof test.parent.project === 'function') {
    try { return test.parent.project()?.name || fallback || ''; } catch (_) {}
  }
  return fallback || '';
}

function fileLooksLikeSpec(value = '') {
  return /\.spec\.(?:cjs|mjs|js|jsx|ts|tsx)$/i.test(String(value || '').replace(/\\/g, '/'));
}

function compactTitleParts(parts = [], projectName = '', leafTitle = '', specFile = '') {
  const specBase = specFile ? path.basename(specFile.replace(/\\/g, '/')) : '';
  const cleaned = [];
  for (const part of parts || []) {
    const text = String(part || '').trim();
    if (!text) continue;
    if (projectName && text === projectName) continue;
    if (leafTitle && text === leafTitle) continue;
    if (specBase && (text === specBase || text.endsWith(`/${specBase}`) || text.endsWith(`\\${specBase}`))) continue;
    if (fileLooksLikeSpec(text)) continue;
    if (!cleaned.includes(text)) cleaned.push(text);
  }
  return cleaned;
}

function humanTestTitle(test = {}) {
  const leaf = String(test.title || test.exactTestTitle || test.leafTitle || '').trim();
  const projectName = testProjectName(test);
  const specFile = test.location?.file || test.file || test.spec || test.specPath || '';
  let parts = [];
  if (typeof test.titlePath === 'function') {
    try { parts = test.titlePath(); } catch (_) { parts = []; }
  } else if (Array.isArray(test.titlePathParts)) {
    parts = test.titlePathParts;
  } else if (Array.isArray(test.suitePathParts)) {
    parts = [...test.suitePathParts, leaf].filter(Boolean);
  } else if (test.fullSuitePath || test.fullTitle) {
    parts = String(test.fullTitle || `${test.fullSuitePath} > ${leaf}`).split(/\s+>\s+|\s+\|\s+/).filter(Boolean);
  }
  const parents = compactTitleParts(parts, projectName, leaf, specFile).slice(-3);
  return ascii(parents.length ? `${parents.join(' | ')} | ${leaf}` : leaf);
}

function manifestRowTitle(row = {}) {
  const project = row.project || row.projectName || (Array.isArray(row.projects) ? row.projects.join(', ') : '') || 'unknown';
  const spec = row.specPath || row.spec || row.file || '';
  const leaf = row.title || row.exactTestTitle || row.leafTitle || '';
  const suite = row.fullSuitePath || (Array.isArray(row.suitePathParts) ? row.suitePathParts.join(' | ') : '');
  const title = suite ? `${suite} | ${leaf}` : leaf;
  return ascii(`[${project}] ${spec}${title ? ` :: ${title}` : ''}`);
}

function loadSelectionMetadata({ root = process.cwd(), runDir = process.env.CHAOS_RELEASE_GATE_RUN_DIR, selection = null } = {}) {
  if (selection) return selection;
  const selectionJson = readJsonIfExists(path.join(runDir || '', 'failed-and-new-manifest-selection.json'))
    || readJsonIfExists(path.join(runDir || '', 'failed-only-manifest-selection.json'))
    || readJsonIfExists(path.join(runDir || '', 'failed-only-test-manifest.json'))
    || {};
  const manifestJson = readJsonIfExists(path.join(runDir || '', 'failed-only-test-manifest.json')) || {};
  const selected = Array.isArray(selectionJson.selected) ? selectionJson.selected : (Array.isArray(manifestJson.selected) ? manifestJson.selected : []);
  return {
    ...selectionJson,
    selected,
    totalSelected: Number(selectionJson.totalSelected || manifestJson.totalSelected || selected.length || 0),
    desktopSelected: Number(selectionJson.desktopSelected || manifestJson.desktopSelected || selected.filter(row => row.project === 'chromium' || (row.projects || []).includes('chromium')).length || 0),
    mobileSelected: Number(selectionJson.mobileSelected || manifestJson.mobileSelected || selected.filter(row => row.project === 'mobile-chromium' || (row.projects || []).includes('mobile-chromium')).length || 0),
    version: readPackageVersion(root),
  };
}

function createHeaderLines({ mode = 'repair', version = '', preview = '', firebase = '', selection = {}, totalTests = 0, includeIdentities = true } = {}) {
  const selected = Array.isArray(selection.selected) ? selection.selected : [];
  const totalSelected = Number(selection.totalSelected || selected.length || totalTests || 0);
  const lines = [
    LINE,
    `86 CHAOS PLAY STORE ${String(mode || 'release').toUpperCase()}`,
    `Version: ${version || selection.version || 'unknown'}`,
    `Mode: ${mode || selection.mode || 'unknown'}`,
    `Preview: ${preview || process.env.APP_URL || process.env.CHAOS_BASE_URL || 'unknown'}`,
    `Firebase: ${firebase || process.env.REACT_APP_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'unknown'}`,
    '',
    `Previous failures: ${Number(selection.previousFailuresSelected || selection.previousFailuresCount || 0)}`,
    `Previous timeouts: ${Number(selection.previousTimeoutsSelected || selection.previousTimeoutsCount || 0)}`,
    `Current release tests: ${Number(selection.currentReleaseFeatureTestsSelected || selection.newTestsCount || 0)}`,
    `Duplicates removed: ${Number(selection.duplicateIdentitiesRemoved || 0)}`,
    '',
    `TOTAL SELECTED: ${totalSelected || totalTests || 0}`,
    `Desktop Chromium: ${Number(selection.desktopSelected || 0)}`,
    `Mobile Chromium: ${Number(selection.mobileSelected || 0)}`,
    LINE,
  ];
  if (includeIdentities && selected.length) {
    lines.push('');
    lines.push(`86 Chaos ${mode || selection.mode || 'release'} selected tests:`);
    selected.forEach((item, index) => lines.push(`${String(index + 1).padStart(2, '0')}. ${manifestRowTitle(item)}`));
    lines.push('');
  }
  return lines.map(ascii);
}

function createResultLine({ status = '', current = 0, total = 0, project = '', title = '', duration = 0, counts = null } = {}) {
  const label = statusLabel(status);
  let line = `[${label}] ${String(current).padStart(2, '0')}/${total || current} ${project || 'unknown'} | ${title || 'untitled'} | ${formatDuration(duration)}`;
  if (counts) {
    line += ` | running: ${counts.passed || 0} pass, ${counts.failed || 0} fail, ${counts.timedOut || 0} timeout, ${counts.skipped || 0} skip`;
  }
  return ascii(line);
}

function firstUsefulError(error = {}) {
  const message = String(error.message || error.value || error.stack || '').trim();
  if (!message) return 'No error message was captured.';
  const lines = message.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const first = lines.find(line => !/^\s*at\s+/.test(line)) || lines[0] || message;
  return ascii(first.length > 500 ? `${first.slice(0, 497)}...` : first);
}

function attachmentPath(result = {}) {
  const attachments = Array.isArray(result.attachments) ? result.attachments : [];
  const withPath = attachments.find(item => item && item.path);
  if (withPath) return withPath.path;
  return result.outputDir || '';
}

function createFailureBlock({ project = '', spec = '', title = '', error = {}, artifact = '' } = {}) {
  return [
    DASH,
    'FAILED TEST',
    `Project: ${project || 'unknown'}`,
    `Spec: ${spec || 'unknown'}`,
    `Test: ${title || 'untitled'}`,
    '',
    'Error:',
    firstUsefulError(error),
    '',
    `Artifact: ${artifact || 'See Playwright report/artifacts for this test.'}`,
    DASH,
  ].map(ascii);
}

function failedOrTimedOut(results = []) {
  return (results || []).filter(row => {
    const status = normalizeStatus(row.status);
    return status === 'timedOut' || (!['passed', 'skipped'].includes(status));
  });
}

function createCompletedSummaryLines({ results = [], mode = process.env.CHAOS_RELEASE_GATE_SELECTION_MODE || 'release', runDir = process.env.CHAOS_RELEASE_GATE_RUN_DIR || '', nextCommand = 'npm run test:play-store:failed', resultOverride = '', primaryBlockingFailure = '' } = {}) {
  const counts = countByStatus(results);
  const failures = failedOrTimedOut(results);
  const passed = failures.length === 0;
  const resultLabel = resultOverride || (passed ? 'PASSED' : 'FAILED');
  const lines = [
    LINE,
    '86 CHAOS TEST RESULT',
    '',
    `MODE:      ${mode || 'unknown'}`,
    `TOTAL:     ${counts.total}`,
    `PASS:      ${counts.passed}`,
    `FAIL:      ${counts.failed}`,
    `TIMEOUT:   ${counts.timedOut}`,
    `SKIP:      ${counts.skipped}`,
    '',
    `RESULT: ${resultLabel}`,
    ...(primaryBlockingFailure ? ['', `Primary blocker: ${primaryBlockingFailure}`] : []),
    '',
    'Failed / timed-out tests:',
  ];
  if (failures.length) {
    failures.forEach((row, index) => {
      lines.push(`${index + 1}. [${row.project || row.projectName || 'unknown'}] ${row.title || row.fullTitle || row.exactTestTitle || 'untitled'}`);
    });
  } else {
    lines.push('None');
    lines.push('Remaining failures: 0');
  }
  lines.push('');
  lines.push(`Next command: ${passed ? 'None - no failed tests remain.' : nextCommand}`);
  lines.push('');
  lines.push('Artifacts:');
  lines.push(runDir || 'See current release-gate run directory.');
  lines.push(LINE);
  return lines.map(ascii);
}

function createInterruptedSummaryLines({ completed = 0, total = 0, counts = {}, runDir = process.env.CHAOS_RELEASE_GATE_RUN_DIR || '' } = {}) {
  return [
    LINE,
    '86 CHAOS TEST RUN INTERRUPTED',
    '',
    `Completed before interruption: ${completed} / ${total}`,
    `Passed: ${counts.passed || 0}`,
    `Failed: ${counts.failed || 0}`,
    `Timed out: ${counts.timedOut || 0}`,
    `Skipped: ${counts.skipped || 0}`,
    '',
    'THIS RUN IS NOT AUTHORITATIVE.',
    'It will not replace completed failed-only lineage.',
    '',
    `Artifacts: ${runDir || 'current run directory'}`,
    LINE,
  ].map(ascii);
}

function createFailedTestsArtifactLines({ results = [], runId = process.env.CHAOS_RELEASE_GATE_RUN_ID || '', version = readPackageVersion(), mode = process.env.CHAOS_RELEASE_GATE_SELECTION_MODE || '' } = {}) {
  const failures = failedOrTimedOut(results);
  const lines = [
    '86 Chaos Failed Tests',
    `Run: ${runId || 'unknown'}`,
    `Version: ${version || 'unknown'}`,
    `Mode: ${mode || 'unknown'}`,
    '',
  ];
  if (!failures.length) {
    lines.push('No failed or timed-out tests.');
    return lines.map(ascii);
  }
  failures.forEach((row, index) => {
    lines.push(`${index + 1}. [${row.project || row.projectName || 'unknown'}]`);
    lines.push(`   ${row.file || row.spec || row.specPath || 'unknown spec'}`);
    lines.push(`   ${row.title || row.fullTitle || row.exactTestTitle || 'untitled'}`);
    lines.push(`   Status: ${statusLabel(row.status)}`);
    lines.push(`   Error: ${firstUsefulError({ message: row.error || row.message || '' })}`);
    lines.push('');
  });
  return lines.map(ascii);
}

class ChaosReleaseGateReporter {
  constructor(options = {}) {
    this.options = options;
    this.output = typeof options.output === 'function' ? options.output : line => console.log(line);
    this.root = options.root || process.cwd();
    this.runDir = options.runDir || process.env.CHAOS_RELEASE_GATE_RUN_DIR || '';
    this.mode = options.mode || process.env.CHAOS_RELEASE_GATE_SELECTION_MODE || (process.env.CHAOS_FAILED_AND_NEW_RELEASE_GATE === 'true' ? 'failed+new' : 'release');
    this.selection = options.selection || null;
    this.results = [];
    this.counts = { passed: 0, failed: 0, timedOut: 0, skipped: 0, interrupted: 0 };
    this.total = 0;
    this.completed = 0;
    this.manifestPrinted = false;
  }

  emit(line = '') {
    this.output(ascii(line));
  }

  onBegin(config, suite) {
    if (this.manifestPrinted) return;
    this.manifestPrinted = true;
    const tests = suite && typeof suite.allTests === 'function' ? suite.allTests() : [];
    this.total = tests.length || Number(this.selection?.totalSelected || 0);
    const selection = loadSelectionMetadata({ root: this.root, runDir: this.runDir, selection: this.selection });
    const version = this.options.version || selection.version || readPackageVersion(this.root);
    const header = createHeaderLines({
      mode: this.mode,
      version,
      preview: this.options.preview || process.env.APP_URL || process.env.CHAOS_BASE_URL || '',
      firebase: this.options.firebase || process.env.REACT_APP_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || '',
      selection,
      totalTests: this.total,
      includeIdentities: this.options.includeIdentities !== false,
    });
    header.forEach(line => this.emit(line));
  }

  onTestEnd(test, result) {
    const status = normalizeStatus(result?.status || 'failed');
    this.completed += 1;
    if (status === 'passed') this.counts.passed += 1;
    else if (status === 'skipped') this.counts.skipped += 1;
    else if (status === 'timedOut') this.counts.timedOut += 1;
    else if (status === 'interrupted') this.counts.interrupted += 1;
    else this.counts.failed += 1;
    const project = testProjectName(test, result?.projectName || 'unknown');
    const title = humanTestTitle(test);
    const row = {
      project,
      projectName: project,
      title,
      file: test?.location?.file || test?.file || test?.spec || '',
      status,
      duration: result?.duration || 0,
      error: result?.error?.message || '',
    };
    this.results.push(row);
    this.emit(createResultLine({ status, current: this.completed, total: this.total || this.completed, project, title, duration: result?.duration || 0, counts: this.counts }));
    if (!['passed', 'skipped'].includes(status)) {
      createFailureBlock({ project, spec: row.file, title, error: result?.error || {}, artifact: attachmentPath(result || {}) }).forEach(line => this.emit(line));
    }
  }

  onEnd(result = {}) {
    const status = normalizeStatus(result.status || '');
    if (status === 'interrupted') {
      const lines = createInterruptedSummaryLines({ completed: this.completed, total: this.total || this.completed, counts: this.counts, runDir: this.runDir });
      lines.forEach(line => this.emit(line));
      if (this.runDir) {
        try { fs.writeFileSync(path.join(this.runDir, 'TEST-RUN-INTERRUPTED.txt'), lines.join('\n')); } catch (_) {}
      }
      return;
    }
    const summaryLines = createCompletedSummaryLines({ results: this.results, mode: this.mode, runDir: this.runDir });
    const failedLines = createFailedTestsArtifactLines({ results: this.results, runId: process.env.CHAOS_RELEASE_GATE_RUN_ID || '', version: readPackageVersion(this.root), mode: this.mode });
    summaryLines.forEach(line => this.emit(line));
    if (this.runDir) {
      try {
        fs.mkdirSync(this.runDir, { recursive: true });
        fs.writeFileSync(path.join(this.runDir, 'TEST-SUMMARY.txt'), summaryLines.join('\n'));
        fs.writeFileSync(path.join(this.runDir, 'FAILED-TESTS.txt'), failedLines.join('\n'));
      } catch (_) {}
    }
  }
}

module.exports = ChaosReleaseGateReporter;
module.exports.ascii = ascii;
module.exports.statusLabel = statusLabel;
module.exports.formatDuration = formatDuration;
module.exports.countByStatus = countByStatus;
module.exports.humanTestTitle = humanTestTitle;
module.exports.manifestRowTitle = manifestRowTitle;
module.exports.loadSelectionMetadata = loadSelectionMetadata;
module.exports.createHeaderLines = createHeaderLines;
module.exports.createResultLine = createResultLine;
module.exports.createFailureBlock = createFailureBlock;
module.exports.createCompletedSummaryLines = createCompletedSummaryLines;
module.exports.createInterruptedSummaryLines = createInterruptedSummaryLines;
module.exports.createFailedTestsArtifactLines = createFailedTestsArtifactLines;
module.exports.failedOrTimedOut = failedOrTimedOut;
