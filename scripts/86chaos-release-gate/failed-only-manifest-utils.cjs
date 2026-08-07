const fs = require('fs');
const path = require('path');
const { getResultsRoot, getRunDir, getFailedOnlyManifestPath, readJsonIfExists, writeJson } = require('./run-context.cjs');

const MANIFEST_SCHEMA_VERSION = 2;

function normalizeRel(value = '') {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/^tests\//, '');
}

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

function loadRunMeta(fullRunDir = '') {
  const summaries = fs.existsSync(fullRunDir)
    ? fs.readdirSync(fullRunDir)
        .filter(name => /^86chaos-play-store-release-gate-summary-.*\.json$/.test(name))
        .map(name => path.join(fullRunDir, name))
    : [];
  summaries.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  const summary = summaries.length ? (readJsonIfExists(summaries[0]) || {}) : {};
  const preflight = readJsonIfExists(path.join(fullRunDir, 'environment-preflight.json')) || {};
  const sourceInventory = readJsonIfExists(path.join(fullRunDir, 'source-inventory.json')) || {};
  const state = readJsonIfExists(path.join(fullRunDir, 'runner-state.json')) || {};
  return {
    fullRunId: summary.runId || state.runId || path.basename(fullRunDir),
    sourceVersion: summary.sourceVersion || preflight.sourceVersion || sourceInventory.version || sourceInventory.packageVersion || '',
    deployedVersion: summary.deployedVersion || preflight.deployedVersion || preflight.visibleVersion || '',
    generatedAt: summary.generatedAt || preflight.generatedAt || state.generatedAt || '',
    firebaseProjectId: summary.firebaseProjectId || preflight.firebaseProjectId || sourceInventory.firebaseProjectId || '',
    appUrl: summary.appUrl || preflight.appUrl || '',
    summary,
    preflight,
    sourceInventory,
    state,
  };
}

function runHasPlaywrightEvidence(dir) {
  const report = readJsonIfExists(path.join(dir, 'playwright-report.json'));
  if (report && Array.isArray(report.suites)) return true;
  const meta = loadRunMeta(dir);
  return Boolean(meta.summary?.playwright && (Array.isArray(meta.summary.playwright.failedTests) || Number(meta.summary.playwright.totalResults || 0) > 0));
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
            const specPath = normalizeRel(spec.file || '');
            entries.push({
              specPath,
              spec: specPath,
              title: exactTitle,
              exactTestTitle: exactTitle,
              fullTitle: [...nextParents, spec.title, t.title].filter(Boolean).join(' > '),
              project: t.projectName || '',
              projects: [t.projectName || ''].filter(Boolean),
              priorStatus: result.status || 'failed',
              baselineFullRunId: meta.fullRunId || '',
              baselineSourceVersion: meta.sourceVersion || '',
              baselineDeployedVersion: meta.deployedVersion || '',
              sourceVersion: meta.sourceVersion || '',
              deployedVersion: meta.deployedVersion || '',
              fullRunId: meta.fullRunId || '',
              duration: result.duration || 0,
              error: result.error?.message || '',
            });
          }
        }
      }
      walkSuites(suite.suites || [], nextParents);
    }
  };
  walkSuites(playwright.suites || []);
  return dedupeSelections(entries);
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
      baselineFullRunId: meta.fullRunId || summary.runId || '',
      baselineSourceVersion: meta.sourceVersion || summary.sourceVersion || '',
      baselineDeployedVersion: meta.deployedVersion || summary.deployedVersion || '',
      sourceVersion: meta.sourceVersion || summary.sourceVersion || '',
      deployedVersion: meta.deployedVersion || summary.deployedVersion || '',
      fullRunId: meta.fullRunId || summary.runId || '',
      duration: row.duration || 0,
      error: row.error || '',
    });
  }
  return dedupeSelections(entries);
}


function loadManifestFromRunDir(runDir = '') {
  if (!runDir) return null;
  return readJsonIfExists(path.join(runDir, 'failed-only-test-manifest.json'))
    || readJsonIfExists(path.join(runDir, 'failed-only-manifest-selection.json'))
    || null;
}

function selectionKey(row = {}) {
  const normalized = normalizeSelection(row);
  return `${normalized.specPath}\u0000${normalized.title}\u0000${normalized.project}`;
}

function countPlaywrightResults(playwright = {}) {
  const counts = { total: 0, passed: 0, failed: 0, timedOut: 0, skipped: 0, unexpected: 0 };
  const walkSuites = (suites = []) => {
    for (const suite of suites || []) {
      for (const spec of suite.specs || []) {
        for (const t of spec.tests || []) {
          for (const result of t.results || []) {
            const status = String(result.status || '');
            counts.total += 1;
            if (status === 'passed') counts.passed += 1;
            else if (status === 'skipped') counts.skipped += 1;
            else if (status === 'timedOut' || /timeout/i.test(String(result.error?.message || ''))) {
              counts.timedOut += 1;
              counts.unexpected += 1;
            } else {
              counts.failed += 1;
              counts.unexpected += 1;
            }
          }
        }
      }
      walkSuites(suite.suites || []);
    }
  };
  walkSuites(playwright.suites || []);
  return counts;
}

function getManifestBaselineId(manifest = {}) {
  return manifest?.baselineFullRunId || manifest?.baseline?.fullRunId || manifest?.fullRunId || '';
}

function findLatestCompletedFailedOnlyDescendant({ baselineFullRunId = '', currentRunDir = getRunDir(), resultsRoot = getResultsRoot() } = {}) {
  const current = path.resolve(currentRunDir || '');
  return listRunDirs(resultsRoot).find(dir => {
    if (path.resolve(dir) === current) return false;
    if (!isFailedOnlyRun(dir)) return false;
    const playwright = readJsonIfExists(path.join(dir, 'playwright-report.json'));
    if (!playwright || !Array.isArray(playwright.suites)) return false;
    const counts = countPlaywrightResults(playwright);
    if (counts.total <= 0) return false;
    const manifest = loadManifestFromRunDir(dir) || {};
    const rowBaseline = getManifestBaselineId(manifest);
    if (baselineFullRunId && rowBaseline && rowBaseline !== baselineFullRunId) return false;
    if (baselineFullRunId && !rowBaseline) return false;
    const state = readJsonIfExists(path.join(dir, 'runner-state.json')) || {};
    if (state.playwrightStarted === false) return false;
    return true;
  }) || '';
}

function buildNarrowedManifestFromFailedOnlyRun(failedOnlyRunDir, { baselineManifest = null, target = {}, currentRunDir = getRunDir() } = {}) {
  if (!fs.existsSync(failedOnlyRunDir)) throw new Error(`Previous failed-only run directory does not exist: ${failedOnlyRunDir}`);
  const previousManifest = loadManifestFromRunDir(failedOnlyRunDir) || {};
  const playwright = readJsonIfExists(path.join(failedOnlyRunDir, 'playwright-report.json'));
  if (!playwright || !Array.isArray(playwright.suites)) throw new Error(`Previous failed-only run has no readable Playwright report: ${failedOnlyRunDir}`);
  const previousMeta = loadRunMeta(failedOnlyRunDir);
  const counts = countPlaywrightResults(playwright);
  if (counts.total <= 0) throw new Error('Previous failed-only run did not execute any Playwright tests.');
  if (counts.unexpected <= 0) throw new Error('Latest compatible failed-only run has zero failed or timed-out tests. Run the complete npm run test:play-store instead of creating a zero-test failed-only run.');
  const originalByKey = new Map(dedupeSelections(previousManifest.selected || []).map(row => [selectionKey(row), row]));
  const baseline = baselineManifest || previousManifest;
  const selected = collectFailedEntriesFromPlaywright(playwright, previousMeta).map((row) => {
    const normalized = normalizeSelection(row);
    const original = originalByKey.get(selectionKey(normalized)) || {};
    const baselineFullRunId = original.baselineFullRunId || baseline.baselineFullRunId || previousManifest.baselineFullRunId || '';
    const baselineSourceVersion = original.baselineSourceVersion || baseline.baselineSourceVersion || previousManifest.baselineSourceVersion || '';
    const baselineDeployedVersion = original.baselineDeployedVersion || baseline.baselineDeployedVersion || previousManifest.baselineDeployedVersion || '';
    return {
      ...normalized,
      priorStatus: normalized.priorStatus || 'failed',
      baselineFullRunId,
      baselineSourceVersion,
      baselineDeployedVersion,
      sourceVersion: baselineSourceVersion,
      deployedVersion: baselineDeployedVersion,
      fullRunId: baselineFullRunId,
      previousFailedOnlyRunId: previousMeta.fullRunId || path.basename(failedOnlyRunDir),
      previousFailedOnlySourceVersion: previousMeta.sourceVersion || previousManifest.targetSourceVersion || previousManifest.sourceVersion || '',
      previousFailedOnlyDeployedVersion: previousMeta.deployedVersion || previousManifest.targetDeployedVersion || previousManifest.deployedVersion || '',
    };
  });
  const deduped = dedupeSelections(selected);
  const previousFailedOnlyRunId = previousMeta.fullRunId || path.basename(failedOnlyRunDir);
  const previousFailedOnlySourceVersion = previousMeta.sourceVersion || previousManifest.targetSourceVersion || previousManifest.sourceVersion || '';
  const previousFailedOnlyDeployedVersion = previousMeta.deployedVersion || previousManifest.targetDeployedVersion || previousManifest.deployedVersion || '';
  return {
    ok: deduped.length > 0,
    manifestSchemaVersion: MANIFEST_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    source: 'dynamic-latest-compatible-failed-only-playwright-report',
    selectionSource: 'latest-compatible-failed-only-result',
    baselineFullRunId: baseline.baselineFullRunId || previousManifest.baselineFullRunId || '',
    baselineFullRunDir: baseline.baselineFullRunDir || previousManifest.baselineFullRunDir || '',
    baselineSourceVersion: baseline.baselineSourceVersion || previousManifest.baselineSourceVersion || '',
    baselineDeployedVersion: baseline.baselineDeployedVersion || previousManifest.baselineDeployedVersion || '',
    baselineGeneratedAt: baseline.baselineGeneratedAt || previousManifest.baselineGeneratedAt || '',
    previousFailedOnlyRunId,
    previousFailedOnlyRunDir: failedOnlyRunDir,
    previousFailedOnlySourceVersion,
    previousFailedOnlyDeployedVersion,
    previousFailedOnlyCounts: counts,
    targetRunId: target.targetRunId || '',
    targetSourceVersion: target.targetSourceVersion || '',
    targetDeployedVersion: target.targetDeployedVersion || '',
    currentRunDir,
    selected: deduped,
    totalSelected: deduped.length,
    desktopSelected: deduped.filter(item => item.project === 'chromium' || item.projects?.includes('chromium')).length,
    mobileSelected: deduped.filter(item => item.project === 'mobile-chromium' || item.projects?.includes('mobile-chromium')).length,
    fullRunId: baseline.baselineFullRunId || previousManifest.baselineFullRunId || '',
    fullRunDir: baseline.baselineFullRunDir || previousManifest.baselineFullRunDir || '',
    sourceVersion: baseline.baselineSourceVersion || previousManifest.baselineSourceVersion || '',
    deployedVersion: baseline.baselineDeployedVersion || previousManifest.baselineDeployedVersion || '',
    note: 'Failed-only success is diagnostic only. Complete npm run test:play-store is still required for release approval.',
  };
}

function selectFailedOnlyManifestForCurrentRun({ currentRunDir = getRunDir(), resultsRoot = getResultsRoot(), target = {} } = {}) {
  const baselineFullRunDir = findMostRecentCompletedFullRun({ currentRunDir, resultsRoot });
  if (!baselineFullRunDir) throw new Error('No completed full release-gate run with failed Playwright results was found. Run npm run test:play-store before npm run test:play-store:failed.');
  const baselineManifest = generateFailedOnlyManifestFromRun(baselineFullRunDir, { write: false, currentRunDir });
  const latestFailedOnlyRunDir = findLatestCompletedFailedOnlyDescendant({ baselineFullRunId: baselineManifest.baselineFullRunId, currentRunDir, resultsRoot });
  if (latestFailedOnlyRunDir) {
    const narrowed = buildNarrowedManifestFromFailedOnlyRun(latestFailedOnlyRunDir, { baselineManifest, target, currentRunDir });
    return { manifest: narrowed, baselineFullRunDir, latestFailedOnlyRunDir, selectionSource: narrowed.selectionSource };
  }
  return { manifest: baselineManifest, baselineFullRunDir, latestFailedOnlyRunDir: '', selectionSource: baselineManifest.source || 'dynamic-most-recent-full-playwright-report' };
}

function dedupeSelections(rows = []) {
  const deduped = [];
  const seen = new Set();
  for (const row of rows || []) {
    const normalized = normalizeSelection(row);
    const key = `${normalized.specPath}\u0000${normalized.title}\u0000${normalized.project}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(normalized);
  }
  return deduped;
}

function normalizeSelection(row = {}, manifest = {}) {
  const specPath = normalizeRel(row.specPath || row.spec || row.file || '');
  const projects = Array.isArray(row.projects) && row.projects.length ? row.projects : [row.project || row.projectName || ''].filter(Boolean);
  const project = row.project || row.projectName || projects[0] || '';
  const title = row.title || row.exactTestTitle || '';
  const baselineFullRunId = row.baselineFullRunId || row.fullRunId || manifest.baselineFullRunId || manifest.fullRunId || '';
  const baselineSourceVersion = row.baselineSourceVersion || row.sourceVersion || manifest.baselineSourceVersion || manifest.sourceVersion || '';
  const baselineDeployedVersion = row.baselineDeployedVersion || row.deployedVersion || manifest.baselineDeployedVersion || manifest.deployedVersion || '';
  return {
    spec: specPath,
    specPath,
    title,
    exactTestTitle: row.exactTestTitle || title,
    fullTitle: row.fullTitle || title,
    project,
    projects,
    priorStatus: row.priorStatus || row.status || '',
    baselineFullRunId,
    baselineSourceVersion,
    baselineDeployedVersion,
    sourceVersion: row.sourceVersion || baselineSourceVersion,
    deployedVersion: row.deployedVersion || baselineDeployedVersion,
    fullRunId: row.fullRunId || baselineFullRunId,
    duration: row.duration || 0,
    error: row.error || '',
  };
}

function findMostRecentCompletedFullRun({ currentRunDir = getRunDir(), resultsRoot = getResultsRoot() } = {}) {
  const current = path.resolve(currentRunDir || '');
  return listRunDirs(resultsRoot).find(dir => {
    const resolved = path.resolve(dir);
    if (resolved === current) return false;
    if (isFailedOnlyRun(dir)) return false;
    if (!runHasPlaywrightEvidence(dir)) return false;
    const meta = loadRunMeta(dir);
    if (meta.state.playwrightStarted === false) return false;
    const generated = generateFailedOnlyManifestFromRun(dir, { write: false, validateBaseline: false });
    return generated.selected.length > 0;
  }) || '';
}

function buildFailedOnlyManifest(fullRunDir, { target = {}, currentRunDir = getRunDir() } = {}) {
  const reportPath = path.join(fullRunDir, 'playwright-report.json');
  const playwright = readJsonIfExists(reportPath);
  const meta = loadRunMeta(fullRunDir);
  const selected = playwright ? collectFailedEntriesFromPlaywright(playwright, meta) : collectFailedEntriesFromSummary(meta.summary, meta);
  return {
    ok: selected.length > 0,
    manifestSchemaVersion: MANIFEST_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    source: 'dynamic-most-recent-full-playwright-report',
    baselineFullRunId: meta.fullRunId,
    baselineFullRunDir: fullRunDir,
    baselineSourceVersion: meta.sourceVersion,
    baselineDeployedVersion: meta.deployedVersion,
    baselineGeneratedAt: meta.generatedAt,
    targetRunId: target.targetRunId || '',
    targetSourceVersion: target.targetSourceVersion || '',
    targetDeployedVersion: target.targetDeployedVersion || '',
    currentRunDir,
    selected,
    totalSelected: selected.length,
    desktopSelected: selected.filter(item => item.project === 'chromium' || item.projects?.includes('chromium')).length,
    mobileSelected: selected.filter(item => item.project === 'mobile-chromium' || item.projects?.includes('mobile-chromium')).length,
    // Compatibility aliases used by older summaries. These describe the baseline, never the repaired target.
    fullRunId: meta.fullRunId,
    fullRunDir,
    sourceVersion: meta.sourceVersion,
    deployedVersion: meta.deployedVersion,
    note: 'Failed-only success is diagnostic only. Complete npm run test:play-store is still required for release approval.',
  };
}

function generateFailedOnlyManifestFromRun(fullRunDir, { write = true, target = {}, currentRunDir = getRunDir(), validateBaseline = true } = {}) {
  if (!fs.existsSync(fullRunDir)) throw new Error(`Baseline full-run directory does not exist: ${fullRunDir}`);
  const manifest = buildFailedOnlyManifest(fullRunDir, { target, currentRunDir });
  if (validateBaseline) {
    const baseline = validateBaselineManifest(manifest, { currentRunDir });
    if (!baseline.ok) throw new Error(baseline.errors.join('\n'));
  }
  if (write) writeJson(path.join(fullRunDir, 'failed-only-test-manifest.json'), manifest);
  return manifest;
}

function loadFailedOnlyManifest(manifestPath = getFailedOnlyManifestPath()) {
  const manifest = readJsonIfExists(manifestPath) || null;
  if (!manifest) return { ok: false, manifest: null, selected: [], errors: [`Missing failed-only manifest at ${manifestPath}`] };
  const selected = Array.isArray(manifest.selected) ? dedupeSelections(manifest.selected.map(row => normalizeSelection(row, manifest))).filter(row => row.spec && row.title && row.projects.length) : [];
  const errors = [];
  if (!selected.length) errors.push('Failed-only manifest selected zero tests.');
  return { ok: errors.length === 0, manifest, selected, errors };
}

function validateBaselineManifest(manifest, { currentRunDir = getRunDir() } = {}) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object') return { ok: false, errors: ['Failed-only manifest is missing or malformed.'] };
  const baselineDir = manifest.baselineFullRunDir || manifest.fullRunDir || '';
  const baselineState = baselineDir ? (readJsonIfExists(path.join(baselineDir, 'runner-state.json')) || {}) : {};
  const baselinePlaywright = baselineDir ? readJsonIfExists(path.join(baselineDir, 'playwright-report.json')) : null;
  if (!baselineDir) errors.push('Baseline full-run directory is missing.');
  if (baselineDir && !fs.existsSync(baselineDir)) errors.push(`Baseline full-run directory does not exist: ${baselineDir}`);
  if (baselineDir && fs.existsSync(baselineDir) && !runHasPlaywrightEvidence(baselineDir)) errors.push('Baseline has no readable Playwright report or structured failed-test summary.');
  if (baselineDir && path.resolve(baselineDir) === path.resolve(currentRunDir || '')) errors.push('Baseline run directory is the current failed-only run directory.');
  if (baselineDir && isFailedOnlyRun(baselineDir)) errors.push('Baseline run is a failed-only run; expected a completed full release-gate run.');
  if (baselineState.playwrightStarted === false) errors.push('Baseline Playwright execution did not start.');
  if (!baselinePlaywright && !(manifest.selected || []).length) errors.push('Baseline selected zero failed or timed-out tests.');
  const baselineSource = manifest.baselineSourceVersion || manifest.sourceVersion || '';
  const baselineDeployed = manifest.baselineDeployedVersion || manifest.deployedVersion || '';
  if (!baselineSource) errors.push('Baseline source version is missing.');
  if (!baselineDeployed) errors.push('Baseline deployed version is missing.');
  if (baselineSource && baselineDeployed && baselineSource !== baselineDeployed) errors.push(`Baseline source/deployed versions do not match: ${baselineSource} vs ${baselineDeployed}.`);
  if (!Array.isArray(manifest.selected) || manifest.selected.length === 0) errors.push('Baseline selected zero failed or timed-out tests.');
  if (manifest.selected?.some(row => !row.specPath && !row.spec)) errors.push('One or more selected tests are missing a spec path.');
  if (manifest.selected?.some(row => !(row.title || row.exactTestTitle))) errors.push('One or more selected tests are missing an exact title.');
  if (manifest.selected?.some(row => !(row.project || row.projectName || (Array.isArray(row.projects) && row.projects.length)))) errors.push('One or more selected tests are missing a Playwright project.');
  return { ok: errors.length === 0, errors };
}

function compareVersions(a = '', b = '') {
  const pa = String(a).split('.').map(n => Number(n));
  const pb = String(b).split('.').map(n => Number(n));
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const da = Number.isFinite(pa[i]) ? pa[i] : 0;
    const db = Number.isFinite(pb[i]) ? pb[i] : 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

function isProductionUrl(value = '') {
  const url = String(value || '').toLowerCase();
  return /app\.86chaos\.com|cheers-34b8d|--prod\b|production/.test(url);
}

function validateTargetManifestContext({ currentSourceVersion = readPackageVersion(), currentDeployedVersion = '', firebaseProjectId = '', appUrl = '', targetUrl = '' } = {}) {
  const errors = [];
  if (!currentSourceVersion) errors.push('Target source version is missing.');
  if (!currentDeployedVersion) errors.push('Target deployed preview version is missing.');
  if (currentSourceVersion && currentDeployedVersion && currentSourceVersion !== currentDeployedVersion) errors.push(`Target source/deployed versions do not match: ${currentSourceVersion} vs ${currentDeployedVersion}.`);
  if (firebaseProjectId && firebaseProjectId !== 'chaos-test-d1601') errors.push(`Target Firebase project must be chaos-test-d1601, got ${firebaseProjectId}.`);
  const url = targetUrl || appUrl || '';
  if (url && isProductionUrl(url)) errors.push(`Refusing failed-only run against production-looking target URL: ${url}`);
  return { ok: errors.length === 0, errors };
}

function readProjectNames(root = process.cwd(), configRel = 'playwright.failed-release.config.cjs') {
  const file = path.join(root, configRel);
  if (!fs.existsSync(file)) return [];
  const source = fs.readFileSync(file, 'utf8');
  return [...source.matchAll(/name:\s*['"]([^'"]+)['"]/g)].map(match => match[1]);
}

function specCandidates(root, specPath) {
  const normalized = normalizeRel(specPath);
  return [
    path.join(root, normalized),
    path.join(root, 'tests', normalized),
  ].filter((value, index, all) => all.indexOf(value) === index);
}

function resolveSpecFile(root, specPath) {
  return specCandidates(root, specPath).find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || '';
}

function extractTestTitlesFromSpec(source = '') {
  const titles = [];
  const re = /(?:^|[\n;])\s*(?:base\.)?test(?:\.(?!describe\b)[A-Za-z]+)?\(\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
  let match;
  while ((match = re.exec(source))) {
    titles.push(match[2].replace(/\\`/g, '`').replace(/\\'/g, "'").replace(/\\"/g, '"'));
  }
  return titles;
}

function validateManifestTestIdentities(manifest, { root = process.cwd(), projectNames = readProjectNames(root) } = {}) {
  const errors = [];
  const selected = dedupeSelections(manifest?.selected || []);
  if (!selected.length) errors.push('Failed-only manifest selected zero tests.');
  const availableProjects = new Set(projectNames || []);
  const seen = new Set();
  const valid = [];
  for (const row of selected) {
    const key = `${row.specPath}\u0000${row.title}\u0000${row.project}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const specFile = resolveSpecFile(root, row.specPath);
    if (!specFile) {
      errors.push(`Selected test spec no longer exists: ${row.specPath}`);
      continue;
    }
    if (availableProjects.size && !availableProjects.has(row.project)) {
      errors.push(`Selected test project no longer exists: ${row.project} (${row.specPath} :: ${row.title})`);
      continue;
    }
    const titles = extractTestTitlesFromSpec(fs.readFileSync(specFile, 'utf8'));
    const matches = titles.filter(title => title === row.title || title === row.exactTestTitle);
    if (matches.length === 0) {
      errors.push(`Selected test title no longer exists: ${row.specPath} :: ${row.title}`);
      continue;
    }
    if (matches.length > 1) {
      errors.push(`Selected test title is ambiguous in current source: ${row.specPath} :: ${row.title}`);
      continue;
    }
    valid.push(row);
  }
  if (selected.length && valid.length === 0) errors.push('Every selected failed-only test was removed or disabled in the current source.');
  return { ok: errors.length === 0, errors, selected: valid, totalSelected: valid.length };
}

function validateManifestForCurrentRun(manifest, options = {}) {
  const errors = [];
  const baseline = validateBaselineManifest(manifest, { currentRunDir: options.currentRunDir || getRunDir() });
  if (!baseline.ok) errors.push(...baseline.errors);
  const target = validateTargetManifestContext(options);
  if (!target.ok) errors.push(...target.errors);
  const baselineVersion = manifest?.baselineSourceVersion || manifest?.sourceVersion || '';
  const targetVersion = options.currentSourceVersion || '';
  if (baselineVersion && targetVersion && compareVersions(targetVersion, baselineVersion) < 0) {
    errors.push(`Target version ${targetVersion} is older than baseline failure version ${baselineVersion}.`);
  }
  if (options.validateIdentities !== false) {
    const identities = validateManifestTestIdentities(manifest, { root: options.root || process.cwd(), projectNames: options.projectNames });
    if (!identities.ok) errors.push(...identities.errors);
  }
  return { ok: errors.length === 0, errors };
}

function targetQualifiedManifest(manifest, { targetRunId = '', targetRunDir = '', targetSourceVersion = '', targetDeployedVersion = '' } = {}) {
  const selected = dedupeSelections((manifest.selected || []).map(row => normalizeSelection(row, manifest)));
  return {
    ...manifest,
    targetRunId,
    targetRunDir,
    targetSourceVersion,
    targetDeployedVersion,
    copiedToRunId: targetRunId,
    copiedToRunDir: targetRunDir,
    copiedAt: new Date().toISOString(),
    selected,
    totalSelected: selected.length,
    desktopSelected: selected.filter(item => item.project === 'chromium' || item.projects?.includes('chromium')).length,
    mobileSelected: selected.filter(item => item.project === 'mobile-chromium' || item.projects?.includes('mobile-chromium')).length,
  };
}

module.exports = {
  MANIFEST_SCHEMA_VERSION,
  normalizeRel,
  readPackageVersion,
  findMostRecentCompletedFullRun,
  findLatestCompletedFailedOnlyDescendant,
  buildNarrowedManifestFromFailedOnlyRun,
  selectFailedOnlyManifestForCurrentRun,
  countPlaywrightResults,
  generateFailedOnlyManifestFromRun,
  buildFailedOnlyManifest,
  targetQualifiedManifest,
  loadFailedOnlyManifest,
  validateBaselineManifest,
  validateTargetManifestContext,
  validateManifestForCurrentRun,
  validateManifestTestIdentities,
  collectFailedEntriesFromPlaywright,
  collectFailedEntriesFromSummary,
  readProjectNames,
  extractTestTitlesFromSpec,
  compareVersions,
};
