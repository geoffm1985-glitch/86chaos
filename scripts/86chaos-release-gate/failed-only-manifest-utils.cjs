const fs = require('fs');
const path = require('path');
const { getResultsRoot, getRunDir, getFailedOnlyManifestPath, readJsonIfExists, writeJson } = require('./run-context.cjs');

function normalizeRel(value = '') { return String(value || '').replace(/\\/g, '/').replace(/^tests\//, ''); }
function readPackageVersion(root = process.cwd()) {
  try { return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version || ''; } catch (_) { return ''; }
}
function listRunDirs(resultsRoot = getResultsRoot()) {
  if (!fs.existsSync(resultsRoot)) return [];
  return fs.readdirSync(resultsRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(resultsRoot, entry.name))
    .filter(dir => fs.existsSync(path.join(dir, 'runner-state.json')) || fs.existsSync(path.join(dir, 'playwright-report.json')))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
}
function isFailedOnlyRun(dir) {
  const state = readJsonIfExists(path.join(dir, 'runner-state.json')) || {};
  return String(state.mode || '').toLowerCase() === 'failed-only' || fs.existsSync(path.join(dir, 'failed-only', 'playwright-artifacts'));
}
function findMostRecentCompletedFullRun({ currentRunDir = getRunDir(), resultsRoot = getResultsRoot() } = {}) {
  const current = path.resolve(currentRunDir || '');
  return listRunDirs(resultsRoot).find(dir => {
    const resolved = path.resolve(dir);
    if (resolved === current) return false;
    if (isFailedOnlyRun(dir)) return false;
    if (!fs.existsSync(path.join(dir, 'playwright-report.json'))) return false;
    const state = readJsonIfExists(path.join(dir, 'runner-state.json')) || {};
    if (state.playwrightStarted === false) return false;
    return true;
  }) || '';
}
function collectFailedEntriesFromPlaywright(playwright = {}, meta = {}) {
  const entries = [];
  const walkSuites = (suites = [], parents = []) => {
    for (const suite of suites || []) {
      const nextParents = suite.title ? [...parents, suite.title] : parents;
      for (const spec of suite.specs || []) {
        for (const t of spec.tests || []) {
          const failed = (t.results || []).filter(result => !['passed', 'skipped'].includes(String(result.status || '')));
          for (const result of failed) {
            const exactTitle = t.title || spec.title || '';
            entries.push({
              specPath: normalizeRel(spec.file || ''),
              spec: normalizeRel(spec.file || ''),
              title: exactTitle,
              exactTestTitle: exactTitle,
              fullTitle: [...nextParents, spec.title, t.title].filter(Boolean).join(' > '),
              project: t.projectName || '',
              projects: [t.projectName || ''].filter(Boolean),
              priorStatus: result.status || 'failed',
              sourceVersion: meta.sourceVersion || '',
              deployedVersion: meta.deployedVersion || '',
              fullRunId: meta.fullRunId || '',
              duration: result.duration || 0,
              error: result.error?.message || ''
            });
          }
        }
      }
      walkSuites(suite.suites || [], nextParents);
    }
  };
  walkSuites(playwright.suites || []);
  const deduped = [];
  const seen = new Set();
  for (const row of entries) {
    const key = `${row.specPath}\u0000${row.title}\u0000${row.project}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }
  return deduped;
}

function collectFailedEntriesFromSummary(summary = {}, meta = {}) {
  const rows = summary?.playwright?.failedTests || [];
  const entries = [];
  for (const row of rows) {
    const fullTitle = String(row.title || '');
    const parts = fullTitle.split(' > ').map(part => part.trim()).filter(Boolean);
    const exactTitle = parts[parts.length - 1] || fullTitle;
    const specPath = normalizeRel(row.file || (parts[0] || '').replace(/\\/g, '/'));
    entries.push({
      specPath,
      spec: specPath,
      title: exactTitle,
      exactTestTitle: exactTitle,
      fullTitle,
      project: row.projectName || row.project || '',
      projects: [row.projectName || row.project || ''].filter(Boolean),
      priorStatus: row.status || 'failed',
      sourceVersion: meta.sourceVersion || summary.sourceVersion || '',
      deployedVersion: meta.deployedVersion || summary.deployedVersion || '',
      fullRunId: meta.fullRunId || summary.runId || '',
      duration: row.duration || 0,
      error: row.error || ''
    });
  }
  const deduped = [];
  const seen = new Set();
  for (const row of entries) {
    const key = `${row.specPath}\u0000${row.title}\u0000${row.project}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }
  return deduped;
}

function loadRunMeta(fullRunDir = '') {
  const summaries = fs.existsSync(fullRunDir) ? fs.readdirSync(fullRunDir).filter(name => /^86chaos-play-store-release-gate-summary-.*\.json$/.test(name)).map(name => path.join(fullRunDir, name)) : [];
  summaries.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  const summary = summaries.length ? (readJsonIfExists(summaries[0]) || {}) : {};
  const preflight = readJsonIfExists(path.join(fullRunDir, 'environment-preflight.json')) || {};
  const state = readJsonIfExists(path.join(fullRunDir, 'runner-state.json')) || {};
  return {
    fullRunId: summary.runId || state.runId || path.basename(fullRunDir),
    sourceVersion: summary.sourceVersion || preflight.sourceVersion || '',
    deployedVersion: summary.deployedVersion || preflight.deployedVersion || preflight.visibleVersion || '',
    summary,
    preflight,
    state
  };
}
function generateFailedOnlyManifestFromRun(fullRunDir, { write = true } = {}) {
  const reportPath = path.join(fullRunDir, 'playwright-report.json');
  const playwright = readJsonIfExists(reportPath);
  const meta = loadRunMeta(fullRunDir);
  const selected = playwright ? collectFailedEntriesFromPlaywright(playwright, meta) : collectFailedEntriesFromSummary(meta.summary, meta);
  if (!playwright && selected.length === 0) throw new Error(`No Playwright JSON report or failed-test summary found in ${fullRunDir}`);
  const manifest = {
    ok: selected.length > 0,
    generatedAt: new Date().toISOString(),
    source: 'dynamic-most-recent-full-playwright-report',
    fullRunId: meta.fullRunId,
    fullRunDir,
    sourceVersion: meta.sourceVersion,
    deployedVersion: meta.deployedVersion,
    selected,
    totalSelected: selected.length,
    desktopSelected: selected.filter(item => item.project === 'chromium' || item.projects?.includes('chromium')).length,
    mobileSelected: selected.filter(item => item.project === 'mobile-chromium' || item.projects?.includes('mobile-chromium')).length,
    note: 'Failed-only success is diagnostic only. Complete npm run test:play-store is still required for release approval.'
  };
  if (write) writeJson(path.join(fullRunDir, 'failed-only-test-manifest.json'), manifest);
  return manifest;
}
function loadFailedOnlyManifest(manifestPath = getFailedOnlyManifestPath()) {
  const manifest = readJsonIfExists(manifestPath) || null;
  if (!manifest) return { ok: false, manifest: null, selected: [], errors: [`Missing failed-only manifest at ${manifestPath}`] };
  const selected = Array.isArray(manifest.selected) ? manifest.selected.map(row => ({
    spec: normalizeRel(row.spec || row.specPath || row.file || ''),
    specPath: normalizeRel(row.specPath || row.spec || row.file || ''),
    title: row.title || row.exactTestTitle || '',
    exactTestTitle: row.exactTestTitle || row.title || '',
    fullTitle: row.fullTitle || row.title || '',
    projects: Array.isArray(row.projects) && row.projects.length ? row.projects : [row.project || row.projectName || ''].filter(Boolean),
    project: row.project || row.projectName || (Array.isArray(row.projects) ? row.projects[0] : '') || '',
    priorStatus: row.priorStatus || row.status || '',
    sourceVersion: row.sourceVersion || manifest.sourceVersion || '',
    deployedVersion: row.deployedVersion || manifest.deployedVersion || '',
    fullRunId: row.fullRunId || manifest.fullRunId || '',
  })).filter(row => row.spec && row.title && row.projects.length) : [];
  const errors = [];
  if (!selected.length) errors.push('Failed-only manifest selected zero tests.');
  return { ok: errors.length === 0, manifest, selected, errors };
}
function validateManifestForCurrentRun(manifest, { currentSourceVersion = readPackageVersion(), currentDeployedVersion = '' } = {}) {
  const errors = [];
  if (!manifest || !Array.isArray(manifest.selected) || manifest.selected.length === 0) errors.push('Failed-only manifest is missing or empty.');
  if (currentSourceVersion && manifest?.sourceVersion && currentSourceVersion !== manifest.sourceVersion) errors.push(`Stale failed-only manifest: source ${manifest.sourceVersion} does not match current source ${currentSourceVersion}.`);
  if (currentDeployedVersion && manifest?.deployedVersion && currentDeployedVersion !== manifest.deployedVersion) errors.push(`Stale failed-only manifest: deployed ${manifest.deployedVersion} does not match target preview ${currentDeployedVersion}.`);
  return { ok: errors.length === 0, errors };
}

module.exports = {
  normalizeRel,
  readPackageVersion,
  findMostRecentCompletedFullRun,
  generateFailedOnlyManifestFromRun,
  loadFailedOnlyManifest,
  validateManifestForCurrentRun,
  collectFailedEntriesFromPlaywright,
  collectFailedEntriesFromSummary,
};
