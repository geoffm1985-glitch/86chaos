'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');
const { writeJson } = require('./run-context.cjs');

const INVENTORY_SCHEMA_VERSION = 3;
function normalizeRel(value='') { return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/^tests\//, ''); }
function sha256File(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function stableIdentityKey({ specPath = '', fullSuitePath = '', leafTitle = '', exactTestTitle = '', project = '' } = {}) {
  return [normalizeRel(specPath), String(fullSuitePath || ''), String(leafTitle || exactTestTitle || ''), String(project || '')].join('\u0000');
}
function splitTitlePath(value = '') {
  return String(value || '').split(/\s+›\s+|\s+>\s+/).map(part => part.trim()).filter(Boolean);
}
function parsePlaywrightListLine(line = '', root = process.cwd()) {
  const raw = String(line || '').trim();
  const match = raw.match(/^\[([^\]]+)\]\s+›\s+(.+)$/);
  if (!match) return null;
  const project = match[1].trim();
  const parts = splitTitlePath(match[2]);
  if (parts.length < 2) return null;
  const filePart = parts[0];
  const fileMatch = filePart.match(/^(.*?\.spec\.(?:cjs|js|jsx|ts|tsx))(?:[:#](\d+)(?::(\d+))?)?$/i);
  if (!fileMatch) return null;
  const specPath = normalizeRel(fileMatch[1]);
  const leafTitle = parts[parts.length - 1];
  const suitePathParts = parts.slice(1, -1);
  const fullSuitePath = suitePathParts.join(' > ');
  const fullTitle = [...suitePathParts, leafTitle].join(' > ');
  const specAbs = path.join(root, specPath.startsWith('tests/') ? specPath : path.join('tests', specPath));
  const sourceFileHash = fs.existsSync(specAbs) ? sha256File(specAbs) : '';
  const row = { specPath, suitePathParts, fullSuitePath, leafTitle, exactTestTitle: leafTitle, title: leafTitle, fullTitle, titlePathParts: [...suitePathParts, leafTitle], project, sourceFileHash };
  row.stableKey = stableIdentityKey(row);
  return row;
}
function parsePlaywrightListOutput(output = '', root = process.cwd()) {
  const records = String(output || '').split(/\r?\n/).map(line => parsePlaywrightListLine(line, root)).filter(Boolean);
  const validation = validateInventoryRecords(records);
  if (!validation.ok) {
    const err = new Error(`Duplicate Playwright inventory identities detected: ${validation.duplicateIdentityCount}`);
    err.duplicates = validation.duplicates;
    throw err;
  }
  return records;
}
function findLocalPlaywrightCli(root = process.cwd()) {
  const cli = path.join(root, 'node_modules', '@playwright', 'test', 'cli.js');
  return fs.existsSync(cli) ? cli : '';
}
function discoveryDiagnostic(result, args = []) {
  const stdout = String(result?.stdout || '');
  const stderr = String(result?.stderr || '');
  return {
    command: [process.execPath, ...args].join(' '),
    status: result?.status ?? null,
    signal: result?.signal || '',
    error: result?.error ? (result.error.stack || result.error.message || String(result.error)) : '',
    stderr: stderr.slice(-8000),
    stdoutTail: stdout.slice(-8000),
    timedOut: result?.error && /timeout|ETIMEDOUT/i.test(String(result.error.message || result.error)),
    bufferLimited: /maxBuffer|ENOBUFS/i.test(String(result?.error?.message || ''))
  };
}
function titleContainsTemplate(records = []) {
  return records.filter(row => /\$\{/.test([row.fullTitle, row.fullSuitePath, row.leafTitle, row.exactTestTitle, row.title].filter(Boolean).join(' ')));
}
function discoverWithPlaywrightList({ root = process.cwd(), config = 'playwright.play-store-release.config.cjs', env = {}, timeoutMs = 10 * 60 * 1000, maxBuffer = 96 * 1024 * 1024 } = {}) {
  const cli = findLocalPlaywrightCli(root);
  if (!cli) return { ok: false, error: 'Local Playwright package is not installed.', records: [], diagnostic: { command: '', status: null, error: 'Local Playwright package is not installed.' } };
  const args = [cli, 'test', `--config=${config}`, '--list'];
  const result = childProcess.spawnSync(process.execPath, args, { cwd: root, env: { ...process.env, ...env, CHAOS_INVENTORY_DISCOVERY: '1' }, encoding: 'utf8', timeout: timeoutMs, maxBuffer });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  let records = [];
  try { records = parsePlaywrightListOutput(output, root); }
  catch (error) { return { ok: false, error: error.message || String(error), records: [], output, diagnostic: { ...discoveryDiagnostic(result, args), parserError: error.stack || error.message || String(error) } }; }
  const templateRows = titleContainsTemplate(records);
  if (templateRows.length) return { ok: false, error: `Playwright inventory contains unresolved template titles: ${templateRows.length}`, records, output, diagnostic: { ...discoveryDiagnostic(result, args), templateRows: templateRows.slice(0, 10) } };
  if (result.status !== 0) return { ok: false, error: `Playwright list exited ${result.status ?? 'null'}`, records, output, diagnostic: discoveryDiagnostic(result, args) };
  if (!records.length) return { ok: false, error: 'Playwright list completed but no tests were discovered.', records: [], output, diagnostic: discoveryDiagnostic(result, args) };
  return { ok: true, output, records, diagnostic: discoveryDiagnostic(result, args) };
}
function listSpecFiles(root=process.cwd()) {
  const base = path.join(root, 'tests');
  const out = [];
  const walk = dir => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.spec\.cjs$/.test(entry.name)) out.push(full);
    }
  };
  walk(base);
  return out.sort();
}
function extractStaticTestsFromSpec(source='') {
  const tests = [];
  const describeStack = [];
  const lines = source.split(/\r?\n/);
  const describeRe = /test\.describe\(\s*(['"`])([^'"`]+)\1/;
  const testRe = /(?:^|[\s;{])(?:[A-Za-z_$][\w$]*\.)?test(?:\.(?!describe\b)[A-Za-z]+)?\(\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/;
  for (const line of lines) {
    const d = line.match(describeRe);
    if (d) describeStack.push(d[2]);
    const t = line.match(testRe);
    if (t) tests.push({ suitePathParts: [...describeStack], fullSuitePath: describeStack.join(' > '), leafTitle: t[2].replace(/\\`/g, '`').replace(/\\'/g, "'").replace(/\\"/g, '"') });
    const closes = (line.match(/}\);/g) || []).length;
    for (let i = 0; i < closes && describeStack.length; i += 1) describeStack.pop();
  }
  return tests;
}
const MAIN_PROJECTS = ['chromium', 'mobile-chromium'];
const PWA_PROJECTS = ['edge-pwa', 'firefox-pwa', 'webkit-pwa', 'mobile-webkit-pwa'];
function projectsForSpec(rel) {
  if (/86chaos-release-gate\/(26-pwa-icon-source-deployed-parity|27-pwa-browser-icon-matrix)\.spec\.cjs$/.test(rel)) return [...MAIN_PROJECTS, ...PWA_PROJECTS];
  if (/runtime-code-coverage/i.test(rel)) return ['chromium'];
  return MAIN_PROJECTS;
}
function fallbackStaticInventory({ root = process.cwd() } = {}) {
  const records = [];
  for (const file of listSpecFiles(root)) {
    const rel = normalizeRel(path.relative(path.join(root, 'tests'), file));
    const source = fs.readFileSync(file, 'utf8');
    const sourceFileHash = sha256File(file);
    for (const t of extractStaticTestsFromSpec(source)) {
      for (const project of projectsForSpec(rel)) {
        records.push({ specPath: rel, suitePathParts: t.suitePathParts, fullSuitePath: t.fullSuitePath, leafTitle: t.leafTitle, exactTestTitle: t.leafTitle, title: t.leafTitle, fullTitle: [...t.suitePathParts, t.leafTitle].join(' > '), titlePathParts: [...t.suitePathParts, t.leafTitle], project, sourceFileHash });
      }
    }
  }
  return records;
}
function withKeys(records = [], { generatedAt = new Date().toISOString(), runId = '', sourceVersion = '' } = {}) {
  return records.map(row => {
    const normalized = { ...row, specPath: normalizeRel(row.specPath), project: row.project || row.projectName || '', leafTitle: row.leafTitle || row.exactTestTitle || row.title || '', exactTestTitle: row.exactTestTitle || row.leafTitle || row.title || '', title: row.title || row.leafTitle || row.exactTestTitle || '', fullSuitePath: row.fullSuitePath || (row.suitePathParts || []).join(' > '), suitePathParts: row.suitePathParts || splitTitlePath(row.fullSuitePath || ''), titlePathParts: row.titlePathParts || [...(row.suitePathParts || splitTitlePath(row.fullSuitePath || '')), row.leafTitle || row.exactTestTitle || row.title || ''], generatedAt, runId, sourceVersion };
    normalized.fullTitle = normalized.fullTitle || normalized.titlePathParts.join(' > ');
    normalized.stableKey = row.stableKey || stableIdentityKey(normalized);
    return normalized;
  });
}
function validateInventoryRecords(records = []) {
  const duplicates = [];
  const seen = new Map();
  for (const row of records) {
    const key = row.stableKey || stableIdentityKey(row);
    if (seen.has(key)) duplicates.push({ stableKey: key, first: seen.get(key), duplicate: row });
    else seen.set(key, row);
  }
  const perProject = records.reduce((acc, row) => { acc[row.project] = (acc[row.project] || 0) + 1; return acc; }, {});
  return { ok: duplicates.length === 0, discoveredTestCount: records.length, perProject, duplicateIdentityCount: duplicates.length, duplicates };
}
function generatePlaywrightInventory({ root=process.cwd(), outputPath='', runId='', sourceVersion='', config='playwright.play-store-release.config.cjs', allowStaticFallback = false, releaseMode = true }={}) {
  const generatedAt = new Date().toISOString();
  const discovered = discoverWithPlaywrightList({ root, config });
  let discoveryMode = 'playwright-list';
  let records = discovered.records || [];
  let discoveryError = discovered.error || '';
  let discoveryDiagnosticReport = discovered.diagnostic || {};
  if ((!discovered.ok || !records.length) && allowStaticFallback && !releaseMode) {
    records = fallbackStaticInventory({ root });
    discoveryMode = 'static-fallback-for-source-tests-only';
  }
  records = withKeys(records, { generatedAt, runId, sourceVersion });
  const unresolvedTemplateRows = titleContainsTemplate(records);
  const validation = validateInventoryRecords(records);
  const ok = validation.ok && records.length > 0 && unresolvedTemplateRows.length === 0 && (discovered.ok || (allowStaticFallback && !releaseMode));
  const report = { ok, inventorySchemaVersion: INVENTORY_SCHEMA_VERSION, generatedAt, runId, sourceVersion, config, discoveryMode, discoveryError, discoveryDiagnostic: discoveryDiagnosticReport, count: records.length, discoveredTestCount: validation.discoveredTestCount, perProject: validation.perProject, duplicateIdentityCount: validation.duplicateIdentityCount, unresolvedTemplateTitleCount: unresolvedTemplateRows.length, unresolvedTemplateTitles: unresolvedTemplateRows.slice(0, 25), duplicates: validation.duplicates, records };
  if (outputPath) writeJson(outputPath, report);
  if (releaseMode && !ok) {
    const err = new Error(`Playwright release inventory discovery failed: ${discoveryError || (unresolvedTemplateRows.length ? 'unresolved template titles' : 'inventory invalid')}`);
    err.report = report;
    throw err;
  }
  return report;
}
if (require.main === module) {
  const outputPath = process.argv[2] || path.join(process.cwd(), 'playwright-test-inventory.json');
  const report = generatePlaywrightInventory({ outputPath, releaseMode: true, allowStaticFallback: false });
  console.log(`Wrote Playwright inventory v${INVENTORY_SCHEMA_VERSION}: ${report.count} identities -> ${outputPath}`);
  if (!report.ok) process.exit(1);
}
module.exports = { INVENTORY_SCHEMA_VERSION, normalizeRel, parsePlaywrightListLine, parsePlaywrightListOutput, discoverWithPlaywrightList, generatePlaywrightInventory, validateInventoryRecords, stableIdentityKey, projectsForSpec, MAIN_PROJECTS, PWA_PROJECTS, titleContainsTemplate, discoveryDiagnostic };
