const fs = require('fs');
const path = require('path');
const { getResultsRoot, getRunDir, getFailedOnlyManifestPath, readJsonIfExists, writeJson } = require('./run-context.cjs');

const MANIFEST_SCHEMA_VERSION = 3;

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

function isFocusedSelectionRun(dir) {
  const state = readJsonIfExists(path.join(dir, 'runner-state.json')) || {};
  const mode = String(state.mode || '').toLowerCase();
  return ['failed-only', 'repair', 'failed+new'].includes(mode) || fs.existsSync(path.join(dir, 'failed-only', 'playwright-artifacts'));
}

function isFailedOnlyRun(dir) {
  return isFocusedSelectionRun(dir);
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
            const fullSuitePath = suitePathFromParents(nextParents, spec, t);
            const titlePathParts = [...(fullSuitePath ? fullSuitePath.split(' > ') : []), exactTitle];
            entries.push({
              specPath,
              spec: specPath,
              title: exactTitle,
              leafTitle: exactTitle,
              exactTestTitle: exactTitle,
              fullSuitePath,
              suitePathParts: fullSuitePath ? fullSuitePath.split(' > ') : [],
              fullTitle: titlePathParts.join(' > '),
              titlePathParts,
              stableKey: identityKeyFromParts(specPath, exactTitle, t.projectName || '', fullSuitePath),
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
    const fullSuitePath = parts.slice(0, -1).filter(part => !/\.spec\./.test(part)).join(' > ');
    entries.push({
      specPath,
      spec: specPath,
      title: exactTitle,
      leafTitle: exactTitle,
      exactTestTitle: exactTitle,
      fullSuitePath,
      suitePathParts: fullSuitePath ? fullSuitePath.split(' > ') : [],
      fullTitle,
      titlePathParts: [...(fullSuitePath ? fullSuitePath.split(' > ') : []), exactTitle],
      stableKey: identityKeyFromParts(specPath, exactTitle, row.projectName || row.project || '', fullSuitePath),
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
  return normalized.stableKey || `${normalized.specPath}\u0000${normalized.fullSuitePath || ''}\u0000${normalized.title}\u0000${normalized.project}`;
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
            else if (status === 'timedOut') {
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

function listSummaryFiles(fullRunDir = '') {
  if (!fullRunDir || !fs.existsSync(fullRunDir)) return [];
  return fs.readdirSync(fullRunDir)
    .filter(name => /^86chaos-play-store-release-gate-summary-.*\.json$/.test(name))
    .map(name => path.join(fullRunDir, name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
}

function hasCompletedReleaseGateEvidence(dir = '') {
  if (!dir || !fs.existsSync(dir)) return { ok: false, reason: 'missing-run-dir', counts: countPlaywrightResults({}) };
  const playwright = readJsonIfExists(path.join(dir, 'playwright-report.json'));
  if (!playwright || !Array.isArray(playwright.suites)) return { ok: false, reason: 'missing-playwright-report', counts: countPlaywrightResults({}) };
  const counts = countPlaywrightResults(playwright);
  if (counts.total <= 0) return { ok: false, reason: 'zero-playwright-results', counts };
  const state = readJsonIfExists(path.join(dir, 'runner-state.json')) || {};
  if (state.playwrightStarted !== true) return { ok: false, reason: 'playwright-not-started', counts };
  const summaries = listSummaryFiles(dir);
  if (!summaries.length) return { ok: false, reason: 'missing-completed-summary', counts };
  if (String(state.blockingReason || '').trim()) return { ok: false, reason: 'runner-blocked-before-normal-collection', counts };
  const phase = String(state.currentPhase || '').toLowerCase();
  if (['created', 'playwright'].includes(phase)) return { ok: false, reason: `abandoned-mid-${phase}`, counts };
  return { ok: true, reason: 'latest compatible completed Playwright run', counts, summaryPath: summaries[0] };
}

function getManifestBaselineId(manifest = {}) {
  return manifest?.baselineFullRunId || manifest?.baseline?.fullRunId || manifest?.fullRunId || '';
}

function findLatestCompletedFocusedRun({ currentRunDir = getRunDir(), resultsRoot = getResultsRoot() } = {}) {
  const current = path.resolve(currentRunDir || '');
  return listRunDirs(resultsRoot).find(dir => {
    if (path.resolve(dir) === current) return false;
    if (!isFocusedSelectionRun(dir)) return false;
    const completed = hasCompletedReleaseGateEvidence(dir);
    if (!completed.ok) return false;
    const manifest = loadManifestFromRunDir(dir);
    return Boolean(manifest && Array.isArray(manifest.selected));
  }) || '';
}

function findLatestCompletedFailedOnlyDescendant({ baselineFullRunId = '', currentRunDir = getRunDir(), resultsRoot = getResultsRoot() } = {}) {
  const current = path.resolve(currentRunDir || '');
  return listRunDirs(resultsRoot).find(dir => {
    if (path.resolve(dir) === current) return false;
    if (!isFailedOnlyRun(dir)) return false;
    const completed = hasCompletedReleaseGateEvidence(dir);
    if (!completed.ok) return false;
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
  const baseline = baselineManifest || previousManifest;
  const previousFailedOnlyRunId = previousMeta.fullRunId || path.basename(failedOnlyRunDir);
  const previousFailedOnlySourceVersion = previousMeta.sourceVersion || previousManifest.targetSourceVersion || previousManifest.sourceVersion || '';
  const previousFailedOnlyDeployedVersion = previousMeta.deployedVersion || previousManifest.targetDeployedVersion || previousManifest.deployedVersion || '';
  if (counts.unexpected <= 0) return {
    ok: true,
    noFailedOrTimedOutTestsRemain: true,
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
    selected: [],
    totalSelected: 0,
    desktopSelected: 0,
    mobileSelected: 0,
    fullRunId: baseline.baselineFullRunId || previousManifest.baselineFullRunId || '',
    fullRunDir: baseline.baselineFullRunDir || previousManifest.baselineFullRunDir || '',
    sourceVersion: baseline.baselineSourceVersion || previousManifest.baselineSourceVersion || '',
    deployedVersion: baseline.baselineDeployedVersion || previousManifest.baselineDeployedVersion || '',
    note: 'No failed or timed-out Playwright tests remain.',
  };
  const originalByKey = new Map(dedupeSelections(previousManifest.selected || []).map(row => [selectionKey(row), row]));
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

function identityKeyFromParts(specPath = '', title = '', project = '', fullSuitePath = '') {
  return `${normalizeRel(specPath)}\u0000${String(fullSuitePath || '')}\u0000${String(title || '')}\u0000${String(project || '')}`;
}


const RESPONSIVE_MATRIX_SPEC = '86chaos-release-gate/31-exhaustive-responsive-nested-layout.spec.cjs';
const LEGACY_RESPONSIVE_LEAF_TITLE = 'every route and nested surface fits phone/tablet/laptop/desktop without unusable overflow or tap targets';
const RESPONSIVE_VIEWPORT_NAMES = ['narrow-phone', 'phone', 'tablet', 'laptop', 'desktop'];

function isLegacyResponsiveMatrixSelection(row = {}) {
  const spec = normalizeRel(row.specPath || row.spec || '');
  if (spec !== RESPONSIVE_MATRIX_SPEC) return false;
  const title = String(row.exactTestTitle || row.title || row.leafTitle || '').trim();
  const fullTitle = String(row.fullTitle || '').trim();
  return title === LEGACY_RESPONSIVE_LEAF_TITLE || fullTitle.includes(LEGACY_RESPONSIVE_LEAF_TITLE);
}

function resolveLegacyResponsiveMatrixSelection(row = {}, manifest = {}, lookup = {}) {
  if (!isLegacyResponsiveMatrixSelection(row)) return [];
  const normalized = normalizeSelection(row, manifest);
  const project = normalized.project || 'chromium';
  const candidates = (lookup.records || []).filter(candidate => {
    const spec = normalizeRel(candidate.specPath || candidate.spec || '');
    if (spec !== RESPONSIVE_MATRIX_SPEC) return false;
    if (String(candidate.project || candidate.projectName || '') !== project) return false;
    const title = String(candidate.exactTestTitle || candidate.title || candidate.leafTitle || '');
    return title.startsWith(LEGACY_RESPONSIVE_LEAF_TITLE)
      && RESPONSIVE_VIEWPORT_NAMES.some(viewport => title.endsWith(`[${viewport}]`));
  });
  const byViewport = new Map();
  for (const candidate of candidates) {
    const title = String(candidate.exactTestTitle || candidate.title || candidate.leafTitle || '');
    const viewport = RESPONSIVE_VIEWPORT_NAMES.find(name => title.endsWith(`[${name}]`));
    if (viewport && !byViewport.has(viewport)) byViewport.set(viewport, candidate);
  }
  if (byViewport.size !== RESPONSIVE_VIEWPORT_NAMES.length) return [];
  return RESPONSIVE_VIEWPORT_NAMES.map(viewport => ({
    ...inventorySelectionFromRow(byViewport.get(viewport), normalized, manifest),
    migratedFromLegacyIdentity: true,
    migratedFromLegacyResponsiveMatrix: true,
    migrationSourceStableKey: normalized.stableKey || selectionKey(normalized),
    selectionReasons: normalized.selectionReasons || ['previous_timeout', 'responsive_matrix_partition_migration'],
  }));
}

function suitePathFromParents(parents = [], spec = {}, t = {}) {
  const ignore = part => !/^failed(?:-only)? .*fixture$/i.test(String(part || '').trim());
  const raw = Array.isArray(t.titlePath) ? t.titlePath : [];
  if (raw.length > 1) return raw.slice(0, -1).filter(Boolean).filter(ignore).join(' > ');
  return (parents || []).filter(Boolean).filter(ignore).join(' > ');
}

function inventoryFromPlaywrightReport(playwright = {}) {
  const records = [];
  const walkSuites = (suites = [], parents = []) => {
    for (const suite of suites || []) {
      const nextParents = suite.title ? [...parents, suite.title] : parents;
      for (const spec of suite.specs || []) {
        for (const t of spec.tests || []) {
          const specPath = normalizeRel(spec.file || '');
          const title = t.title || spec.title || '';
          const project = t.projectName || '';
          const fullSuitePath = suitePathFromParents(nextParents, spec, t);
          if (specPath && title && project) {
            const fullTitle = [...fullSuitePath.split(' > ').filter(Boolean), title].join(' > ');
            records.push({ specPath, exactTestTitle: title, title, leafTitle: title, fullSuitePath, suitePathParts: fullSuitePath ? fullSuitePath.split(' > ') : [], fullTitle, titlePathParts: [...(fullSuitePath ? fullSuitePath.split(' > ') : []), title], project, stableKey: identityKeyFromParts(specPath, title, project, fullSuitePath) });
          }
        }
      }
      walkSuites(suite.suites || [], nextParents);
    }
  };
  walkSuites(playwright.suites || []);
  return records;
}

function currentInventoryRecords(root = process.cwd(), { allowStaticFallback = false } = {}) {
  const fallbackAllowed = allowStaticFallback || process.env.CHAOS_ALLOW_SOURCE_INVENTORY_FALLBACK === '1';
  try {
    const { generatePlaywrightInventory } = require('./playwright-inventory.cjs');
    return generatePlaywrightInventory({ root, releaseMode: !fallbackAllowed, allowStaticFallback: fallbackAllowed }).records || [];
  } catch (error) {
    error.message = `Current Playwright inventory discovery failed for release delta: ${error.message || error}`;
    throw error;
  }
}

function priorInventoryRecordsFromRun(dir = '') {
  const inventory = readJsonIfExists(path.join(dir, 'playwright-test-inventory.json'));
  if (inventory && Array.isArray(inventory.records)) return inventory.records;
  const playwright = readJsonIfExists(path.join(dir, 'playwright-report.json'));
  return playwright ? inventoryFromPlaywrightReport(playwright) : [];
}

function latestKnownStatuses({ baselineFullRunDir = '', baselineFullRunId = '', resultsRoot = getResultsRoot(), currentRunDir = getRunDir() } = {}) {
  const map = new Map();
  const applyReport = (dir) => {
    const report = readJsonIfExists(path.join(dir, 'playwright-report.json'));
    if (!report || !Array.isArray(report.suites)) return;
    const walkSuites = (suites = [], parents = []) => {
      for (const suite of suites || []) {
        const nextParents = suite.title ? [...parents, suite.title] : parents;
        for (const spec of suite.specs || []) {
          for (const t of spec.tests || []) {
            for (const result of t.results || []) {
              const fullSuitePath = suitePathFromParents(nextParents, spec, t);
              const key = identityKeyFromParts(spec.file || '', t.title || spec.title || '', t.projectName || '', fullSuitePath);
              if (key) map.set(key, { status: String(result.status || ''), dir, duration: result.duration || 0, error: result.error?.message || '' });
            }
          }
        }
        walkSuites(suite.suites || [], nextParents);
      }
    };
    walkSuites(report.suites || []);
  };
  if (baselineFullRunDir) applyReport(baselineFullRunDir);
  for (const dir of listRunDirs(resultsRoot).reverse()) {
    if (path.resolve(dir) === path.resolve(currentRunDir || '')) continue;
    if (!isFailedOnlyRun(dir)) continue;
    const manifest = loadManifestFromRunDir(dir) || {};
    if (baselineFullRunId && getManifestBaselineId(manifest) !== baselineFullRunId) continue;
    applyReport(dir);
  }
  return map;
}


function inventorySelectionFromRow(inventoryRow = {}, sourceRow = {}, manifest = {}) {
  const normalized = normalizeSelection({
    specPath: inventoryRow.specPath || inventoryRow.spec,
    spec: inventoryRow.specPath || inventoryRow.spec,
    title: inventoryRow.exactTestTitle || inventoryRow.leafTitle || inventoryRow.title,
    exactTestTitle: inventoryRow.exactTestTitle || inventoryRow.leafTitle || inventoryRow.title,
    leafTitle: inventoryRow.leafTitle || inventoryRow.exactTestTitle || inventoryRow.title,
    fullSuitePath: inventoryRow.fullSuitePath || '',
    suitePathParts: inventoryRow.suitePathParts || [],
    titlePathParts: inventoryRow.titlePathParts || [],
    fullTitle: inventoryRow.fullTitle || '',
    stableKey: inventoryRow.stableKey || '',
    project: inventoryRow.project || inventoryRow.projectName || sourceRow.project || '',
    projects: [inventoryRow.project || inventoryRow.projectName || sourceRow.project || ''].filter(Boolean),
    priorStatus: sourceRow.priorStatus || sourceRow.status || '',
    baselineStatus: sourceRow.baselineStatus || '',
    baselineFullRunId: sourceRow.baselineFullRunId || sourceRow.fullRunId || manifest.baselineFullRunId || manifest.fullRunId || '',
    baselineSourceVersion: sourceRow.baselineSourceVersion || sourceRow.sourceVersion || manifest.baselineSourceVersion || manifest.sourceVersion || '',
    baselineDeployedVersion: sourceRow.baselineDeployedVersion || sourceRow.deployedVersion || manifest.baselineDeployedVersion || manifest.deployedVersion || '',
    sourceVersion: sourceRow.sourceVersion || manifest.baselineSourceVersion || manifest.sourceVersion || '',
    deployedVersion: sourceRow.deployedVersion || manifest.baselineDeployedVersion || manifest.deployedVersion || '',
    duration: sourceRow.duration || 0,
    error: sourceRow.error || '',
    selectionReasons: sourceRow.selectionReasons,
  }, manifest);
  return {
    ...normalized,
    sourceFileHash: inventoryRow.sourceFileHash || sourceRow.sourceFileHash || '',
    migratedFromLegacyIdentity: Boolean(sourceRow.migratedFromLegacyIdentity || sourceRow.migratedFromLegacyAmbiguousIdentity),
    migrationSourceStableKey: sourceRow.stableKey || '',
  };
}

function inventoryLookup(records = []) {
  const byKey = new Map();
  const byLooseKey = new Map();
  for (const row of records || []) {
    const key = row.stableKey || identityKeyFromParts(row.specPath || row.spec, row.exactTestTitle || row.title || row.leafTitle, row.project || row.projectName, row.fullSuitePath || '');
    if (key) byKey.set(key, row);
    const loose = [normalizeRel(row.specPath || row.spec || ''), String(row.exactTestTitle || row.title || row.leafTitle || ''), String(row.project || row.projectName || '')].join('\u0000');
    const rows = byLooseKey.get(loose) || [];
    rows.push(row);
    byLooseKey.set(loose, rows);
  }
  return { byKey, byLooseKey, records: records || [] };
}

function resolveSelectionRowsAgainstInventory(row = {}, manifest = {}, lookup = inventoryLookup([])) {
  const normalized = normalizeSelection(row, manifest);
  const stable = normalized.stableKey || selectionKey(normalized);
  const exact = lookup.byKey.get(stable);
  if (exact) return [inventorySelectionFromRow(exact, normalized, manifest)];
  const loose = [normalizeRel(normalized.specPath || ''), String(normalized.exactTestTitle || normalized.title || normalized.leafTitle || ''), String(normalized.project || '')].join('\u0000');
  const looseMatches = lookup.byLooseKey.get(loose) || [];
  if (looseMatches.length === 1) {
    return [{ ...inventorySelectionFromRow(looseMatches[0], normalized, manifest), migratedFromLegacyIdentity: true }];
  }
  if (looseMatches.length > 1) {
    const suite = String(normalized.fullSuitePath || '').trim();
    const titlePath = String(normalized.fullTitle || '').trim();
    const narrowed = looseMatches.filter(candidate => {
      const candidateSuite = String(candidate.fullSuitePath || '').trim();
      const candidateFull = String(candidate.fullTitle || '').trim();
      return (suite && candidateSuite === suite) || (titlePath && candidateFull === titlePath);
    });
    const matches = narrowed.length ? narrowed : looseMatches;
    return matches.map(candidate => ({
      ...inventorySelectionFromRow(candidate, normalized, manifest),
      migratedFromLegacyIdentity: true,
      migratedFromLegacyAmbiguousIdentity: !narrowed.length,
      legacyAmbiguousMatchCount: looseMatches.length,
    }));
  }
  const responsiveMigration = resolveLegacyResponsiveMatrixSelection(normalized, manifest, lookup);
  if (responsiveMigration.length) return responsiveMigration;
  return [normalized];
}

function qualifyManifestSelectionsWithCurrentInventory(manifest = {}, { root = process.cwd(), currentRecords = null, allowStaticFallback = false } = {}) {
  const current = currentRecords || currentInventoryRecords(root, { allowStaticFallback });
  const lookup = inventoryLookup(current);
  const expanded = [];
  for (const row of manifest.selected || []) expanded.push(...resolveSelectionRowsAgainstInventory(row, manifest, lookup));
  const selected = dedupeSelections(expanded);
  return {
    ...manifest,
    selected,
    totalSelected: selected.length,
    desktopSelected: selected.filter(item => item.project === 'chromium' || item.projects?.includes('chromium')).length,
    mobileSelected: selected.filter(item => item.project === 'mobile-chromium' || item.projects?.includes('mobile-chromium')).length,
    currentInventoryCount: current.length,
    legacyIdentityMigration: {
      attempted: true,
      expandedAmbiguousCount: selected.filter(item => item.migratedFromLegacyAmbiguousIdentity).length,
      migratedCount: selected.filter(item => item.migratedFromLegacyIdentity).length,
    },
  };
}

function addNewInventorySelections(manifest, { baselineFullRunDir = '', baselineFullRunId = '', resultsRoot = getResultsRoot(), currentRunDir = getRunDir(), root = process.cwd() } = {}) {
  const priorRecords = priorInventoryRecordsFromRun(baselineFullRunDir);
  const priorKeys = new Set(priorRecords.map(r => r.stableKey || identityKeyFromParts(r.specPath || r.spec, r.exactTestTitle || r.title, r.project, r.fullSuitePath || '')));
  const known = latestKnownStatuses({ baselineFullRunDir, baselineFullRunId, resultsRoot, currentRunDir });
  const selectedKeys = new Set((manifest.selected || []).map(row => selectionKey(row)));
  const current = currentInventoryRecords(root);
  const newSelections = [];
  for (const row of current) {
    const key = row.stableKey || identityKeyFromParts(row.specPath, row.exactTestTitle || row.title, row.project, row.fullSuitePath || '');
    if (!key || priorKeys.has(key)) continue;
    const latest = known.get(key);
    if (latest && latest.status === 'passed') continue;
    const normalized = normalizeSelection({ specPath: row.specPath, exactTestTitle: row.exactTestTitle, title: row.exactTestTitle, leafTitle: row.leafTitle, fullSuitePath: row.fullSuitePath || '', suitePathParts: row.suitePathParts || [], titlePathParts: row.titlePathParts || [], stableKey: row.stableKey, project: row.project, projects: [row.project], priorStatus: latest?.status || 'new', fullTitle: row.fullTitle || row.exactTestTitle }, manifest);
    const sKey = selectionKey(normalized);
    if (selectedKeys.has(sKey)) continue;
    normalized.selectionReasons = latest?.status === 'timedOut' ? ['previous_timeout', 'new_test'] : latest?.status === 'failed' ? ['previous_failure', 'new_test'] : ['new_test'];
    normalized.priorStatus = latest?.status || 'new';
    selectedKeys.add(sKey);
    newSelections.push(normalized);
  }
  const selected = dedupeSelections([...(manifest.selected || []), ...newSelections].map(row => {
    const normalized = normalizeSelection(row, manifest);
    if (row.selectionReasons) normalized.selectionReasons = row.selectionReasons;
    return normalized;
  }));
  const previousFailures = selected.filter(row => row.selectionReasons?.includes('previous_failure') || row.priorStatus === 'failed').length;
  const previousTimeouts = selected.filter(row => row.selectionReasons?.includes('previous_timeout') || row.priorStatus === 'timedOut').length;
  const newTests = selected.filter(row => row.selectionReasons?.includes('new_test') || row.priorStatus === 'new').length;
  return {
    ...manifest,
    mode: 'failed+new',
    source: manifest.source || 'dynamic-failed-and-new',
    selected,
    totalSelected: selected.length,
    desktopSelected: selected.filter(item => item.project === 'chromium' || item.projects?.includes('chromium')).length,
    mobileSelected: selected.filter(item => item.project === 'mobile-chromium' || item.projects?.includes('mobile-chromium')).length,
    priorInventoryCount: priorKeys.size,
    currentInventoryCount: current.length,
    previousFailuresCount: previousFailures,
    previousTimeoutsCount: previousTimeouts,
    newTestsCount: newTests,
    newProjectCombinationsCount: 0,
    removedTestsCount: Math.max(0, priorKeys.size - current.length),
    possibleRenameCount: 0,
  };
}

function selectFailedOnlyManifestForCurrentRun({ currentRunDir = getRunDir(), resultsRoot = getResultsRoot(), target = {}, root = process.cwd(), includeNewInventory = true, currentRecords = null } = {}) {
  const baselineFullRunDir = findMostRecentCompletedFullRun({ currentRunDir, resultsRoot });
  let baselineManifest = null;
  let latestFailedOnlyRunDir = '';
  let manifest;
  let selectionSource;
  let lineageMode = 'full-baseline';

  if (baselineFullRunDir) {
    baselineManifest = generateFailedOnlyManifestFromRun(baselineFullRunDir, { write: false, currentRunDir });
    latestFailedOnlyRunDir = findLatestCompletedFailedOnlyDescendant({ baselineFullRunId: baselineManifest.baselineFullRunId, currentRunDir, resultsRoot });
    if (latestFailedOnlyRunDir) {
      const narrowed = buildNarrowedManifestFromFailedOnlyRun(latestFailedOnlyRunDir, { baselineManifest, target, currentRunDir });
      manifest = narrowed;
      selectionSource = narrowed.selectionSource;
    } else {
      manifest = baselineManifest;
      selectionSource = baselineManifest.source || 'dynamic-most-recent-full-playwright-report';
    }
  } else if (!includeNewInventory) {
    latestFailedOnlyRunDir = findLatestCompletedFocusedRun({ currentRunDir, resultsRoot });
    if (!latestFailedOnlyRunDir) {
      throw new Error('No completed full release-gate run or completed focused repair/failed-only run with Playwright evidence was found. Canceled, blocked, and incomplete runs are ignored.');
    }
    const previousManifest = loadManifestFromRunDir(latestFailedOnlyRunDir) || {};
    manifest = buildNarrowedManifestFromFailedOnlyRun(latestFailedOnlyRunDir, { baselineManifest: previousManifest, target, currentRunDir });
    selectionSource = 'latest-compatible-focused-result-with-pruned-full-baseline';
    lineageMode = 'focused';
  } else {
    throw new Error('No completed full release-gate run with Playwright evidence was found. Failed+new delta selection requires a completed full baseline. Canceled, blocked, and incomplete runs are ignored.');
  }
  manifest.selected = (manifest.selected || []).map(row => {
    const normalized = normalizeSelection(row, manifest);
    if (!normalized.selectionReasons) {
      normalized.selectionReasons = normalized.priorStatus === 'timedOut' ? ['previous_timeout'] : ['previous_failure'];
    }
    return normalized;
  });
  if (includeNewInventory) {
    manifest = addNewInventorySelections(manifest, { baselineFullRunDir, baselineFullRunId: baselineManifest.baselineFullRunId, resultsRoot, currentRunDir, root });
    manifest.selectionSource = manifest.newTestsCount > 0 ? 'failed-and-new-latest-known-results-plus-current-inventory' : selectionSource;
  } else {
    manifest = qualifyManifestSelectionsWithCurrentInventory(manifest, { root, currentRecords });
    manifest.mode = 'failed-only';
    manifest.selectionSource = selectionSource || 'strict-failed-only-latest-compatible-result';
    manifest.previousFailuresCount = manifest.selected.filter(row => row.selectionReasons?.includes('previous_failure') || row.priorStatus === 'failed' || row.priorStatus === 'interrupted').length;
    manifest.previousTimeoutsCount = manifest.selected.filter(row => row.selectionReasons?.includes('previous_timeout') || row.priorStatus === 'timedOut').length;
    manifest.newTestsCount = 0;
  }
  if (manifest.totalSelected <= 0 && includeNewInventory) {
    throw new Error('No failed or new Playwright tests remain. Run the complete release gate.');
  }
  manifest.lineageMode = lineageMode;
  if (lineageMode === 'focused') manifest.selectionSource = selectionSource;
  return { manifest, baselineFullRunDir, latestFailedOnlyRunDir, selectionSource: manifest.selectionSource, lineageMode };
}

function dedupeSelections(rows = []) {
  const deduped = [];
  const seen = new Set();
  for (const row of rows || []) {
    const normalized = normalizeSelection(row);
    const key = normalized.stableKey || `${normalized.specPath}\u0000${normalized.fullSuitePath || ''}\u0000${normalized.title}\u0000${normalized.project}`;
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
  const title = row.title || row.exactTestTitle || row.leafTitle || '';
  const suitePathParts = Array.isArray(row.suitePathParts) ? row.suitePathParts : String(row.fullSuitePath || '').split(' > ').filter(Boolean);
  const fullSuitePath = row.fullSuitePath || suitePathParts.join(' > ');
  const titlePathParts = Array.isArray(row.titlePathParts) && row.titlePathParts.length ? row.titlePathParts : [...suitePathParts, title].filter(Boolean);
  const fullTitle = row.fullTitle || titlePathParts.join(' > ') || title;
  const baselineFullRunId = row.baselineFullRunId || row.fullRunId || manifest.baselineFullRunId || manifest.fullRunId || '';
  const baselineSourceVersion = row.baselineSourceVersion || row.sourceVersion || manifest.baselineSourceVersion || manifest.sourceVersion || '';
  const baselineDeployedVersion = row.baselineDeployedVersion || row.deployedVersion || manifest.baselineDeployedVersion || manifest.deployedVersion || '';
  const stableKey = row.stableKey || identityKeyFromParts(specPath, title, project, fullSuitePath);
  return {
    spec: specPath,
    specPath,
    title,
    leafTitle: row.leafTitle || title,
    exactTestTitle: row.exactTestTitle || title,
    fullSuitePath,
    suitePathParts,
    titlePathParts,
    fullTitle,
    stableKey,
    project,
    projects,
    priorStatus: row.priorStatus || row.status || '',
    baselineStatus: row.baselineStatus || '',
    baselineFullRunId,
    baselineSourceVersion,
    baselineDeployedVersion,
    sourceVersion: row.sourceVersion || baselineSourceVersion,
    deployedVersion: row.deployedVersion || baselineDeployedVersion,
    fullRunId: row.fullRunId || baselineFullRunId,
    duration: row.duration || 0,
    error: row.error || '',
    selectionReasons: row.selectionReasons,
    migratedFromLegacyIdentity: Boolean(row.migratedFromLegacyIdentity),
    migratedFromLegacyAmbiguousIdentity: Boolean(row.migratedFromLegacyAmbiguousIdentity),
    migratedFromLegacyResponsiveMatrix: Boolean(row.migratedFromLegacyResponsiveMatrix),
    legacyAmbiguousMatchCount: row.legacyAmbiguousMatchCount || 0,
    migrationSourceStableKey: row.migrationSourceStableKey || '',
    sourceFileHash: row.sourceFileHash || '',
  };
}

function findMostRecentCompletedFullRun({ currentRunDir = getRunDir(), resultsRoot = getResultsRoot() } = {}) {
  const current = path.resolve(currentRunDir || '');
  return listRunDirs(resultsRoot).find(dir => {
    const resolved = path.resolve(dir);
    if (resolved === current) return false;
    if (isFailedOnlyRun(dir)) return false;
    const completed = hasCompletedReleaseGateEvidence(dir);
    if (!completed.ok) return false;
    const meta = loadRunMeta(dir);
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
  const re = /(?:^|[\n;{])\s*(?:base\.)?test(?:\.(?!describe\b)[A-Za-z]+)?\(\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
  let match;
  while ((match = re.exec(source))) {
    titles.push(match[2].replace(/\\`/g, '`').replace(/\\'/g, "'").replace(/\\"/g, '"'));
  }
  return titles;
}

function validateManifestTestIdentities(manifest, { root = process.cwd(), projectNames = readProjectNames(root), allowStaticFallback = false } = {}) {
  const errors = [];
  const selected = dedupeSelections(manifest?.selected || []);
  if (!selected.length) errors.push('Failed-only manifest selected zero tests.');
  const availableProjects = new Set(projectNames || []);
  const current = currentInventoryRecords(root, { allowStaticFallback });
  const lookup = inventoryLookup(current);
  const valid = [];
  for (const row of selected) {
    const normalized = normalizeSelection(row, manifest);
    const specFile = resolveSpecFile(root, normalized.specPath);
    if (!specFile) {
      errors.push(`Selected test spec no longer exists: ${normalized.specPath}`);
      continue;
    }
    if (availableProjects.size && !availableProjects.has(normalized.project)) {
      errors.push(`Selected test project no longer exists: ${normalized.project} (${normalized.specPath} :: ${normalized.fullTitle || normalized.title})`);
      continue;
    }
    const resolved = resolveSelectionRowsAgainstInventory(normalized, manifest, lookup);
    const unresolved = resolved.length === 1 && !lookup.byKey.has(resolved[0].stableKey || selectionKey(resolved[0]));
    if (unresolved) {
      errors.push(`Selected test title no longer exists in Playwright discovery: ${normalized.specPath} :: ${normalized.fullTitle || normalized.title} [${normalized.project}]`);
      continue;
    }
    valid.push(...resolved);
  }
  const dedupedValid = dedupeSelections(valid);
  if (selected.length && dedupedValid.length === 0) errors.push('Every selected failed-only test was removed or disabled in the current source.');
  return { ok: errors.length === 0, errors, selected: dedupedValid, totalSelected: dedupedValid.length };
}

function validateManifestForCurrentRun(manifest, options = {}) {
  const errors = [];
  const baselineMode = options.baselineMode || manifest?.lineageMode || 'full-baseline';
  if (baselineMode === 'bundled-full-baseline-fallback') {
    const baselineSource = manifest?.baselineSourceVersion || manifest?.sourceVersion || '';
    const baselineDeployed = manifest?.baselineDeployedVersion || manifest?.deployedVersion || '';
    if (!manifest?.baselineFullRunId) errors.push('Bundled baseline run ID is missing.');
    if (!baselineSource) errors.push('Bundled baseline source version is missing.');
    if (!baselineDeployed) errors.push('Bundled baseline deployed version is missing.');
    if (baselineSource && baselineDeployed && baselineSource !== baselineDeployed) {
      errors.push(`Bundled baseline source/deployed versions do not match: ${baselineSource} vs ${baselineDeployed}.`);
    }
    if (!Array.isArray(manifest?.selected) || manifest.selected.length === 0) {
      errors.push('Bundled baseline selected zero failed or timed-out tests.');
    }
    if (manifest?.selected?.some(row => !row.specPath && !row.spec)) errors.push('One or more bundled baseline tests are missing a spec path.');
    if (manifest?.selected?.some(row => !(row.title || row.exactTestTitle || row.leafTitle))) errors.push('One or more bundled baseline tests are missing an exact title.');
    if (manifest?.selected?.some(row => !(row.project || row.projectName || (Array.isArray(row.projects) && row.projects.length)))) errors.push('One or more bundled baseline tests are missing a Playwright project.');
  } else if (baselineMode === 'focused') {
    const focusedDir = manifest?.previousFailedOnlyRunDir || '';
    const isBundledFocusedFallback = String(manifest?.selectionSource || '') === 'bundled-latest-failed-only-20260823-183916-fail-only'
      || String(manifest?.selectionSource || '') === 'bundled-latest-failed-only-20260825-125909-fail-only'
      || String(manifest?.source || '') === 'uploaded-failed-only-20260823-183916'
      || String(manifest?.source || '') === 'authoritative-failed-only-run-20260825-125909';
    if (!focusedDir && isBundledFocusedFallback) {
      const sourceVersion = manifest?.previousFailedOnlySourceVersion || '';
      const deployedVersion = manifest?.previousFailedOnlyDeployedVersion || '';
      if (!manifest?.previousFailedOnlyRunId) errors.push('Bundled focused fallback source run ID is missing.');
      if (!sourceVersion) errors.push('Bundled focused fallback source version is missing.');
      if (!deployedVersion) errors.push('Bundled focused fallback deployed version is missing.');
      if (sourceVersion && deployedVersion && sourceVersion !== deployedVersion) errors.push(`Bundled focused fallback source/deployed versions do not match: ${sourceVersion} vs ${deployedVersion}.`);
      if (!Array.isArray(manifest?.selected) || manifest.selected.length === 0) errors.push('Bundled focused fallback selected zero failed tests.');
      const targetVersion = options.currentSourceVersion || '';
      if (sourceVersion && targetVersion && compareVersions(targetVersion, sourceVersion) < 0) errors.push(`Target version ${targetVersion} is older than bundled focused lineage version ${sourceVersion}.`);
    } else if (!focusedDir) {
      errors.push('Focused lineage source run directory is missing.');
    } else if (!fs.existsSync(focusedDir)) {
      errors.push(`Focused lineage source run directory does not exist: ${focusedDir}`);
    } else {
      const completed = hasCompletedReleaseGateEvidence(focusedDir);
      if (!completed.ok) errors.push(`Focused lineage source run is not completed Playwright evidence: ${completed.reason}.`);
      const focusedMeta = loadRunMeta(focusedDir);
      const sourceVersion = manifest?.previousFailedOnlySourceVersion || focusedMeta.sourceVersion || '';
      const deployedVersion = manifest?.previousFailedOnlyDeployedVersion || focusedMeta.deployedVersion || '';
      if (!sourceVersion) errors.push('Focused lineage source version is missing.');
      if (!deployedVersion) errors.push('Focused lineage deployed version is missing.');
      if (sourceVersion && deployedVersion && sourceVersion !== deployedVersion) errors.push(`Focused lineage source/deployed versions do not match: ${sourceVersion} vs ${deployedVersion}.`);
      const targetVersion = options.currentSourceVersion || '';
      if (sourceVersion && targetVersion && compareVersions(targetVersion, sourceVersion) < 0) errors.push(`Target version ${targetVersion} is older than focused lineage version ${sourceVersion}.`);
    }
  } else if (baselineMode !== 'none') {
    const baseline = validateBaselineManifest(manifest, { currentRunDir: options.currentRunDir || getRunDir() });
    if (!baseline.ok) errors.push(...baseline.errors);
  }
  const target = validateTargetManifestContext(options);
  if (!target.ok) errors.push(...target.errors);
  if (baselineMode !== 'focused' && baselineMode !== 'none') {
    const baselineVersion = manifest?.baselineSourceVersion || manifest?.sourceVersion || '';
    const targetVersion = options.currentSourceVersion || '';
    if (baselineVersion && targetVersion && compareVersions(targetVersion, baselineVersion) < 0) {
      errors.push(`Target version ${targetVersion} is older than baseline failure version ${baselineVersion}.`);
    }
  }
  if (options.validateIdentities !== false) {
    const identities = validateManifestTestIdentities(manifest, { root: options.root || process.cwd(), projectNames: options.projectNames, allowStaticFallback: options.allowStaticFallback === true });
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
  findLatestCompletedFocusedRun,
  findLatestCompletedFailedOnlyDescendant,
  hasCompletedReleaseGateEvidence,
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
  inventoryFromPlaywrightReport,
  addNewInventorySelections,
  currentInventoryRecords,
  qualifyManifestSelectionsWithCurrentInventory,
  resolveSelectionRowsAgainstInventory,
  dedupeSelections,
  selectionKey,
};
