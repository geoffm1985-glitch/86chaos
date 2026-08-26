const path = require('path');
const { ensureRunDir, readJsonIfExists, writeJson } = require('./run-context.cjs');
const {
  selectFailedOnlyManifestForCurrentRun,
  readPackageVersion,
  targetQualifiedManifest,
  validateManifestForCurrentRun,
  qualifyManifestSelectionsWithCurrentInventory,
  currentInventoryRecords,
} = require('./failed-only-manifest-utils.cjs');
const {
  resolveCurrentReleaseRepairScope,
  buildRepairSelection,
} = require('./current-release-repair-scope.cjs');

const { runDir, runId } = ensureRunDir();
const validationPath = path.join(runDir, 'failed-only-manifest-validation.json');
const modeArg = process.argv.find(arg => /^--mode=/.test(arg));
const selectionMode = String((modeArg ? modeArg.split('=')[1] : '') || process.env.CHAOS_RELEASE_GATE_SELECTION_MODE || (process.env.CHAOS_FAILED_AND_NEW_RELEASE_GATE === 'true' ? 'failed+new' : 'failed-only')).toLowerCase();
const validModes = new Set(['failed+new', 'failed-only', 'repair', 'reported-failed-only', 'partial-resume', 'reported-current-blockers']);
if (!validModes.has(selectionMode)) fail(`Unknown failed selection mode: ${selectionMode}`);

function fail(message, details = []) {
  const errors = [message, ...details].filter(Boolean);
  writeJson(validationPath, {
    ok: false,
    runId,
    runDir,
    mode: selectionMode,
    primaryBlockingFailure: errors[0],
    errors,
    generatedAt: new Date().toISOString(),
  });
  console.error(errors.join('\n'));
  process.exit(1);
}

const preflight = readJsonIfExists(path.join(runDir, 'environment-preflight.json')) || {};
const currentSourceVersion = readPackageVersion();
const currentDeployedVersion = preflight.deployedVersion || preflight.visibleVersion || '';
const firebaseProjectId = preflight.firebaseProjectId || '';
const appUrl = preflight.appUrl || process.env.APP_URL || process.env.CHAOS_BASE_URL || '';
let currentRecords = null;

function loadCurrentRecords() {
  if (currentRecords) return currentRecords;
  currentRecords = currentInventoryRecords(process.cwd(), { allowStaticFallback: selectionMode === 'failed-only' });
  return currentRecords;
}


function reportedProject(row = {}) {
  return row.project || (row.projects || [])[0] || '';
}

function countReportedRows(rows = []) {
  const keys = rows.map(row => row.stableKey || `${row.specPath || row.spec || ''}\u0000${row.fullSuitePath || ''}\u0000${row.leafTitle || row.exactTestTitle || row.title || ''}\u0000${reportedProject(row)}`);
  return {
    total: rows.length,
    chromium: rows.filter(row => reportedProject(row) === 'chromium' || row.projects?.includes('chromium')).length,
    mobileChromium: rows.filter(row => reportedProject(row) === 'mobile-chromium' || row.projects?.includes('mobile-chromium')).length,
    otherProjects: [...new Set(rows.map(reportedProject).filter(project => project && !['chromium', 'mobile-chromium'].includes(project)))],
    timeouts: rows.filter(row => String(row.priorStatus || '').toLowerCase() === 'timedout' || String(row.priorStatus || '').toLowerCase() === 'timeout' || row.selectionReasons?.some(reason => /previous_timeout|timeout/i.test(String(reason)))).length,
    duplicates: rows.length - new Set(keys).size,
  };
}

function loadReportedPartialResumeManifest() {
  const manifestPath = path.join(__dirname, 'reported-partial-resume-20260813-205319.json');
  const manifest = readJsonIfExists(manifestPath);
  if (!manifest || !Array.isArray(manifest.selected)) fail('Partial resume manifest is missing or malformed.', [manifestPath]);
  const selected = manifest.selected || [];
  const counts = countReportedRows(selected);
  const failures = selected.filter(row => String(row.priorStatus || '').toLowerCase() === 'failed').length;
  const timeouts = selected.filter(row => ['timedout', 'timeout'].includes(String(row.priorStatus || '').toLowerCase())).length;
  const notRun = selected.filter(row => ['notrun', 'not_run', 'not-run'].includes(String(row.priorStatus || '').toLowerCase())).length;
  const errors = [];
  if (manifest.mode !== 'partial-resume') errors.push(`Partial resume manifest mode must be partial-resume, got ${manifest.mode || 'missing'}.`);
  if (counts.total !== Number(manifest.totalSelected || 0)) errors.push(`Partial resume totalSelected does not match rows: ${manifest.totalSelected} vs ${counts.total}.`);
  if (counts.chromium !== Number(manifest.desktopSelected || 0)) errors.push(`Partial resume chromium count does not match rows: ${manifest.desktopSelected} vs ${counts.chromium}.`);
  if (counts.mobileChromium !== Number(manifest.mobileSelected || 0)) errors.push(`Partial resume mobile-chromium count does not match rows: ${manifest.mobileSelected} vs ${counts.mobileChromium}.`);
  if (counts.total !== 156 || counts.chromium !== 42 || counts.mobileChromium !== 106) errors.push(`Partial resume manifest must select 156 non-passed identities from the uploaded 16.0.175 partial run (chromium 42, mobile-chromium 106), got total ${counts.total}, chromium ${counts.chromium}, mobile-chromium ${counts.mobileChromium}.`);
  if (failures !== 2 || timeouts !== 3 || notRun !== 151) errors.push(`Partial resume manifest must contain exactly 2 failed, 3 timed-out, and 151 not-run identities; got ${failures}/${timeouts}/${notRun}.`);
  if (counts.duplicates) errors.push(`Partial resume manifest contains ${counts.duplicates} duplicate stable identity key(s).`);
  if (selected.some(row => String(row.priorStatus || '').toLowerCase() === 'passed' || String(row.baselineStatus || '').toLowerCase() === 'passed')) errors.push('Partial resume manifest must not include any passed identities.');
  if (errors.length) fail('Partial resume selection guard failed.', errors);
  return manifest;
}

function loadReportedCurrentBlockersManifest() {
  const manifestPath = path.join(__dirname, 'reported-current-blockers-20260814-064437.json');
  const manifest = readJsonIfExists(manifestPath);
  if (!manifest || !Array.isArray(manifest.selected)) fail('Current blockers manifest is missing or malformed.', [manifestPath]);
  const selected = manifest.selected || [];
  const counts = countReportedRows(selected);
  const failures = selected.filter(row => String(row.priorStatus || '').toLowerCase() === 'failed').length;
  const timeouts = selected.filter(row => ['timedout', 'timeout'].includes(String(row.priorStatus || '').toLowerCase())).length;
  const errors = [];
  if (manifest.mode !== 'reported-current-blockers') errors.push(`Current blockers manifest mode must be reported-current-blockers, got ${manifest.mode || 'missing'}.`);
  if (counts.total !== Number(manifest.totalSelected || 0)) errors.push(`Current blockers totalSelected does not match rows: ${manifest.totalSelected} vs ${counts.total}.`);
  if (counts.chromium !== Number(manifest.desktopSelected || 0)) errors.push(`Current blockers chromium count does not match rows: ${manifest.desktopSelected} vs ${counts.chromium}.`);
  if (counts.mobileChromium !== Number(manifest.mobileSelected || 0)) errors.push(`Current blockers mobile-chromium count does not match rows: ${manifest.mobileSelected} vs ${counts.mobileChromium}.`);
  if (counts.total !== 2 || counts.chromium !== 1 || counts.mobileChromium !== 1) errors.push(`Current blockers manifest must select exactly 2 identities (chromium 1, mobile-chromium 1), got total ${counts.total}, chromium ${counts.chromium}, mobile-chromium ${counts.mobileChromium}.`);
  if (failures !== 2 || timeouts !== 0) errors.push(`Current blockers manifest must contain exactly 2 failed and 0 timed-out identities; got ${failures}/${timeouts}.`);
  if (counts.otherProjects.length) errors.push(`Current blockers manifest contains disallowed projects: ${counts.otherProjects.join(', ')}.`);
  if (counts.duplicates) errors.push(`Current blockers manifest contains ${counts.duplicates} duplicate stable identity key(s).`);
  if (selected.some(row => String(row.priorStatus || '').toLowerCase() === 'passed' || String(row.baselineStatus || '').toLowerCase() === 'passed')) errors.push('Current blockers manifest must not include any passed identities.');
  if (selected.some(row => String(row.priorStatus || '').toLowerCase() === 'skipped' || String(row.baselineStatus || '').toLowerCase() === 'skipped')) errors.push('Current blockers manifest must not include skipped identities.');
  if (selected.some(row => ['notrun', 'not_run', 'not-run'].includes(String(row.priorStatus || '').toLowerCase()))) errors.push('Current blockers manifest must not include not-run identities.');
  if (errors.length) fail('Current blockers selection guard failed.', errors);
  return manifest;
}

function loadReportedFailedOnlyManifest() {
  const manifestPath = path.join(__dirname, 'reported-failed-only-20260810-015004.json');
  const manifest = readJsonIfExists(manifestPath);
  if (!manifest || !Array.isArray(manifest.selected)) fail('Reported failed-only manifest is missing or malformed.', [manifestPath]);
  const counts = countReportedRows(manifest.selected);
  const errors = [];
  if (manifest.mode !== 'reported-failed-only') errors.push(`Reported manifest mode must be reported-failed-only, got ${manifest.mode || 'missing'}.`);
  if (counts.total !== Number(manifest.totalSelected || 0)) errors.push(`Reported manifest totalSelected does not match rows: ${manifest.totalSelected} vs ${counts.total}.`);
  if (counts.chromium !== Number(manifest.desktopSelected || 0)) errors.push(`Reported manifest chromium count does not match rows: ${manifest.desktopSelected} vs ${counts.chromium}.`);
  if (counts.mobileChromium !== Number(manifest.mobileSelected || 0)) errors.push(`Reported manifest mobile-chromium count does not match rows: ${manifest.mobileSelected} vs ${counts.mobileChromium}.`);
  if (counts.total !== 6 || counts.chromium !== 2 || counts.mobileChromium !== 4) errors.push(`Reported failed-only manifest must select the current 6 FAIL identities (chromium 2, mobile-chromium 4), got total ${counts.total}, chromium ${counts.chromium}, mobile-chromium ${counts.mobileChromium}.`);
  if (counts.otherProjects.length) errors.push(`Reported failed-only manifest contains disallowed projects: ${counts.otherProjects.join(', ')}.`);
  if (counts.timeouts) errors.push('Reported failed-only manifest selected a timeout identity or previous_timeout reason.');
  if (counts.duplicates) errors.push(`Reported failed-only manifest contains ${counts.duplicates} duplicate stable identity key(s).`);
  if ((manifest.selected || []).some(row => String(row.priorStatus || '').toLowerCase() !== 'failed')) errors.push('Every reported failed-only row must have priorStatus failed.');
  if ((manifest.selected || []).some(row => String(row.baselineStatus || '').toLowerCase() !== 'failed')) errors.push('Every reported failed-only row must have baselineStatus failed.');
  if ((manifest.selected || []).some(row => row.selectionReasons?.some(reason => /current_release_feature_test|new_test|repair|previous_timeout/i.test(String(reason))))) errors.push('Reported failed-only rows must not include current-release, new-test, repair, or timeout selection reasons.');
  if (errors.length) fail('Reported failed-only selection guard failed.', errors);
  return manifest;
}

function assertReportedFailedOnlySelection(manifest) {
  const selected = manifest.selected || [];
  const counts = countReportedRows(selected);
  const errors = [];
  const expectedTotal = Number(manifest.totalSelected || 0);
  const expectedChromium = Number(manifest.desktopSelected || 0);
  const expectedMobile = Number(manifest.mobileSelected || 0);
  if (counts.total !== expectedTotal) errors.push(`Expected ${expectedTotal} reported failed-only identities, got ${counts.total}.`);
  if (counts.chromium !== expectedChromium) errors.push(`Expected ${expectedChromium} chromium identities, got ${counts.chromium}.`);
  if (counts.mobileChromium !== expectedMobile) errors.push(`Expected ${expectedMobile} mobile-chromium identities, got ${counts.mobileChromium}.`);
  if (expectedTotal !== 6 || expectedChromium !== 2 || expectedMobile !== 4) errors.push('Current reported failed-only manifest metadata must resolve to total 6, chromium 2, mobile-chromium 4.');
  if (counts.otherProjects.length) errors.push(`Reported failed-only selected unexpected projects: ${counts.otherProjects.join(', ')}.`);
  if (counts.timeouts) errors.push('Reported failed-only selected a timeout identity.');
  if (counts.duplicates) errors.push(`Reported failed-only selected ${counts.duplicates} duplicate identities.`);
  if (selected.some(row => String(row.priorStatus || '').toLowerCase() !== 'failed')) errors.push('Reported failed-only selected a non-failed priorStatus.');
  if (selected.some(row => String(row.baselineStatus || '').toLowerCase() !== 'failed')) errors.push('Reported failed-only selected a non-failed baselineStatus.');
  if (selected.some(row => row.selectionReasons?.some(reason => /previous_timeout|current_release_feature_test|new_test|repair/i.test(String(reason))))) errors.push('Reported failed-only selected timeout/current-release/new/repair reasons.');
  if (errors.length) fail('Reported failed-only selection guard failed after inventory qualification.', errors);
}


function loadBundledUltimateFailedOnlyFallback() {
  const manifestPath = path.join(__dirname, 'reported-failed-only-20260822-173450.json');
  const manifest = readJsonIfExists(manifestPath);
  if (!manifest || !Array.isArray(manifest.selected)) {
    throw new Error(`Bundled 20260822-173450 failed-only fallback is missing or malformed: ${manifestPath}`);
  }
  const selected = manifest.selected || [];
  const counts = countReportedRows(selected);
  const failures = selected.filter(row => String(row.priorStatus || '').toLowerCase() === 'failed').length;
  const timeouts = selected.filter(row => ['timedout', 'timeout'].includes(String(row.priorStatus || '').toLowerCase())).length;
  const errors = [];
  if (counts.total !== 16 || counts.chromium !== 9 || counts.mobileChromium !== 7) {
    errors.push(`Bundled fallback must contain exactly 16 identities (chromium 9, mobile-chromium 7); got ${counts.total}/${counts.chromium}/${counts.mobileChromium}.`);
  }
  if (failures !== 14 || timeouts !== 2) {
    errors.push(`Bundled fallback must contain exactly 14 FAIL and 2 TIMEOUT identities; got ${failures}/${timeouts}.`);
  }
  if (counts.otherProjects.length) errors.push(`Bundled fallback contains unexpected projects: ${counts.otherProjects.join(', ')}.`);
  if (counts.duplicates) errors.push(`Bundled fallback contains ${counts.duplicates} duplicate identities.`);
  if (selected.some(row => ['passed', 'skipped', 'notrun', 'not_run', 'not-run'].includes(String(row.priorStatus || '').toLowerCase()))) {
    errors.push('Bundled fallback contains a PASS/SKIP/NOT-RUN identity.');
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return qualifyManifestSelectionsWithCurrentInventory(manifest, {
    root: process.cwd(),
    currentRecords: loadCurrentRecords(),
    allowStaticFallback: true,
  });
}


function loadBundledLatestFailedOnlyFallback() {
  const manifestPath = path.join(__dirname, 'reported-failed-only-20260823-183916.json');
  const manifest = readJsonIfExists(manifestPath);
  if (!manifest || !Array.isArray(manifest.selected)) {
    throw new Error(`Bundled 20260823-183916 failed-only fallback is missing or malformed: ${manifestPath}`);
  }
  const selected = manifest.selected || [];
  const counts = countReportedRows(selected);
  const failures = selected.filter(row => String(row.priorStatus || '').toLowerCase() === 'failed').length;
  const timeouts = selected.filter(row => ['timedout', 'timeout'].includes(String(row.priorStatus || '').toLowerCase())).length;
  const errors = [];
  if (counts.total !== 10 || counts.chromium !== 6 || counts.mobileChromium !== 4) {
    errors.push(`Latest bundled fallback must contain exactly 10 identities (chromium 6, mobile-chromium 4); got ${counts.total}/${counts.chromium}/${counts.mobileChromium}.`);
  }
  if (failures !== 10 || timeouts !== 0) {
    errors.push(`Latest bundled fallback must contain exactly 10 FAIL and 0 TIMEOUT identities; got ${failures}/${timeouts}.`);
  }
  if (counts.otherProjects.length) errors.push(`Latest bundled fallback contains unexpected projects: ${counts.otherProjects.join(', ')}.`);
  if (counts.duplicates) errors.push(`Latest bundled fallback contains ${counts.duplicates} duplicate identities.`);
  if (selected.some(row => ['passed', 'skipped', 'notrun', 'not_run', 'not-run'].includes(String(row.priorStatus || '').toLowerCase()))) {
    errors.push('Latest bundled fallback contains a PASS/SKIP/NOT-RUN identity.');
  }
  if (errors.length) throw new Error(errors.join('\n'));
  const qualified = qualifyManifestSelectionsWithCurrentInventory(manifest, {
    root: process.cwd(),
    currentRecords: loadCurrentRecords(),
    allowStaticFallback: true,
  });
  qualified.lineageMode = 'focused';
  qualified.selectionSource = 'bundled-latest-failed-only-20260823-183916-fail-only';
  return qualified;
}


function loadBundledFiveFailureFailedOnlyFallback() {
  const manifestPath = path.join(__dirname, 'reported-failed-only-20260825-125909.json');
  const manifest = readJsonIfExists(manifestPath);
  if (!manifest || !Array.isArray(manifest.selected)) {
    throw new Error(`Bundled 20260825-125909 failed-only fallback is missing or malformed: ${manifestPath}`);
  }
  const selected = manifest.selected || [];
  const counts = countReportedRows(selected);
  const failures = selected.filter(row => String(row.priorStatus || '').toLowerCase() === 'failed').length;
  const timeouts = selected.filter(row => ['timedout', 'timeout'].includes(String(row.priorStatus || '').toLowerCase())).length;
  const passes = selected.filter(row => String(row.priorStatus || '').toLowerCase() === 'passed').length;
  const skips = selected.filter(row => String(row.priorStatus || '').toLowerCase() === 'skipped').length;
  const notRun = selected.filter(row => ['notrun', 'not_run', 'not-run'].includes(String(row.priorStatus || '').toLowerCase())).length;
  const errors = [];
  if (counts.total !== 5 || counts.chromium !== 3 || counts.mobileChromium !== 2) {
    errors.push(`Five-failure bundled fallback must contain exactly 5 identities (chromium 3, mobile-chromium 2); got ${counts.total}/${counts.chromium}/${counts.mobileChromium}.`);
  }
  if (failures !== 5 || timeouts !== 0 || passes !== 0 || skips !== 0 || notRun !== 0) {
    errors.push(`Five-failure bundled fallback must contain exactly 5 FAIL, 0 TIMEOUT, 0 PASS, 0 SKIP, and 0 NOT-RUN identities; got ${failures}/${timeouts}/${passes}/${skips}/${notRun}.`);
  }
  if (counts.otherProjects.length) errors.push(`Five-failure bundled fallback contains unexpected projects: ${counts.otherProjects.join(', ')}.`);
  if (counts.duplicates) errors.push(`Five-failure bundled fallback contains ${counts.duplicates} duplicate identities.`);
  if (errors.length) throw new Error(errors.join('\n'));
  const qualified = qualifyManifestSelectionsWithCurrentInventory(manifest, {
    root: process.cwd(),
    currentRecords: loadCurrentRecords(),
    allowStaticFallback: true,
  });
  qualified.lineageMode = 'focused';
  qualified.selectionSource = 'bundled-latest-failed-only-20260825-125909-fail-only';
  return qualified;
}


function loadBundledCurrentFailedOnlyFallback() {
  const manifestPath = path.join(__dirname, 'reported-failed-only-20260824-002634.json');
  const manifest = readJsonIfExists(manifestPath);
  if (!manifest || !Array.isArray(manifest.selected)) {
    throw new Error(`Bundled 20260824-002634 failed-only fallback is missing or malformed: ${manifestPath}`);
  }
  const selected = manifest.selected || [];
  const counts = countReportedRows(selected);
  const failures = selected.filter(row => String(row.priorStatus || '').toLowerCase() === 'failed').length;
  const timeouts = selected.filter(row => ['timedout', 'timeout'].includes(String(row.priorStatus || '').toLowerCase())).length;
  const errors = [];
  if (counts.total !== 7 || counts.chromium !== 4 || counts.mobileChromium !== 3) {
    errors.push(`Current bundled fallback must contain exactly 7 identities (chromium 4, mobile-chromium 3); got ${counts.total}/${counts.chromium}/${counts.mobileChromium}.`);
  }
  if (failures !== 7 || timeouts !== 0) {
    errors.push(`Current bundled fallback must contain exactly 7 FAIL and 0 TIMEOUT identities; got ${failures}/${timeouts}.`);
  }
  if (counts.otherProjects.length) errors.push(`Current bundled fallback contains unexpected projects: ${counts.otherProjects.join(', ')}.`);
  if (counts.duplicates) errors.push(`Current bundled fallback contains ${counts.duplicates} duplicate identities.`);
  if (selected.some(row => ['passed', 'skipped', 'notrun', 'not_run', 'not-run'].includes(String(row.priorStatus || '').toLowerCase()))) {
    errors.push('Current bundled fallback contains a PASS/SKIP/NOT-RUN identity.');
  }
  if (errors.length) throw new Error(errors.join('\n'));
  const qualified = qualifyManifestSelectionsWithCurrentInventory(manifest, {
    root: process.cwd(),
    currentRecords: loadCurrentRecords(),
    allowStaticFallback: true,
  });
  qualified.lineageMode = 'focused';
  qualified.selectionSource = 'bundled-latest-failed-only-20260824-002634-fail-only';
  return qualified;
}

let selectedSource;
try {
  if (selectionMode === 'reported-failed-only') {
    const manifest = loadReportedFailedOnlyManifest();
    selectedSource = {
      manifest: qualifyManifestSelectionsWithCurrentInventory(manifest, { root: process.cwd(), currentRecords: loadCurrentRecords() }),
      baselineFullRunDir: '',
      latestFailedOnlyRunDir: '',
      selectionSource: manifest.selectionSource || 'uploaded-failed-tests-20260810-015004',
      lineageMode: 'none',
    };
  } else if (selectionMode === 'partial-resume') {
    const manifest = loadReportedPartialResumeManifest();
    selectedSource = {
      manifest: qualifyManifestSelectionsWithCurrentInventory(manifest, { root: process.cwd(), currentRecords: loadCurrentRecords() }),
      baselineFullRunDir: '',
      latestFailedOnlyRunDir: '',
      selectionSource: manifest.selectionSource || 'uploaded-partial-release-gate-20260813-205319',
      lineageMode: 'none',
    };
  } else if (selectionMode === 'reported-current-blockers') {
    const manifest = loadReportedCurrentBlockersManifest();
    selectedSource = {
      manifest: qualifyManifestSelectionsWithCurrentInventory(manifest, { root: process.cwd(), currentRecords: loadCurrentRecords() }),
      baselineFullRunDir: '',
      latestFailedOnlyRunDir: '',
      selectionSource: manifest.selectionSource || 'uploaded-current-blockers-20260814-064437',
      lineageMode: 'none',
    };
  } else {
    selectedSource = selectFailedOnlyManifestForCurrentRun({
      currentRunDir: runDir,
      includeNewInventory: selectionMode === 'failed+new',
      currentRecords: selectionMode === 'failed+new' ? null : loadCurrentRecords(),
      target: {
        targetRunId: runId,
        targetSourceVersion: currentSourceVersion,
        targetDeployedVersion: currentDeployedVersion,
      },
    });
  }
} catch (error) {
  if (selectionMode === 'failed-only' && /No completed full release-gate run|No completed full release-gate run or completed focused|Focused lineage source run directory is missing/i.test(error?.message || '')) {
    let manifest;
    try {
      manifest = loadBundledFiveFailureFailedOnlyFallback();
    } catch (_) {
      try {
        manifest = loadBundledCurrentFailedOnlyFallback();
      } catch (__) {
        manifest = loadBundledLatestFailedOnlyFallback();
      }
    }
    selectedSource = {
      manifest,
      baselineFullRunDir: '',
      latestFailedOnlyRunDir: manifest.previousFailedOnlyRunDir || '',
      selectionSource: manifest.selectionSource || 'bundled-latest-failed-only-fail-only',
      lineageMode: 'focused',
    };
  } else if (selectionMode === 'repair' && /No completed full release-gate run/i.test(error?.message || '')) {
    selectedSource = {
      manifest: { ok: true, selected: [], totalSelected: 0, mode: 'failed-only', lineageMode: 'none', selectionSource: 'no-compatible-previous-failures-feature-scope-only' },
      baselineFullRunDir: '',
      latestFailedOnlyRunDir: '',
      selectionSource: 'no-compatible-previous-failures-feature-scope-only',
      lineageMode: 'none',
    };
  } else {
    fail(`${selectionMode} baseline evidence is malformed or unsafe.`, [error?.message || String(error)]);
  }
}

let copied = targetQualifiedManifest(selectedSource.manifest, {
  targetRunId: runId,
  targetRunDir: runDir,
  targetSourceVersion: currentSourceVersion,
  targetDeployedVersion: currentDeployedVersion,
});
copied.lineageMode = copied.lineageMode || selectedSource.lineageMode || 'full-baseline';
if (selectionMode === 'reported-failed-only') {
  copied.mode = 'reported-failed-only';
  copied.source = 'uploaded-failed-tests-20260810-015004';
  copied.selectionSource = 'uploaded-failed-tests-20260810-015004';
  copied.lineageMode = 'none';
  copied.previousFailuresSelected = copied.selected.length;
  copied.previousTimeoutsSelected = 0;
  copied.currentReleaseFeatureTestsSelected = 0;
  copied.duplicateIdentitiesRemoved = 0;
  copied.newTestsCount = 0;
  assertReportedFailedOnlySelection(copied);
}
if (selectionMode === 'partial-resume') {
  copied.mode = 'partial-resume';
  copied.source = 'uploaded-partial-release-gate-20260813-205319';
  copied.selectionSource = 'uploaded-partial-release-gate-20260813-205319-fail-timeout-not-run';
  copied.lineageMode = 'none';
  copied.previousFailuresSelected = copied.selected.filter(row => String(row.priorStatus || '').toLowerCase() === 'failed').length;
  copied.previousTimeoutsSelected = copied.selected.filter(row => ['timedout', 'timeout'].includes(String(row.priorStatus || '').toLowerCase())).length;
  copied.partialNotRunSelected = copied.selected.filter(row => ['notrun', 'not_run', 'not-run'].includes(String(row.priorStatus || '').toLowerCase())).length;
  copied.currentReleaseFeatureTestsSelected = 0;
  copied.duplicateIdentitiesRemoved = 0;
  copied.newTestsCount = 0;
}
if (selectionMode === 'reported-current-blockers') {
  copied.mode = 'reported-current-blockers';
  copied.source = 'uploaded-current-blockers-20260814-064437';
  copied.selectionSource = 'uploaded-current-blockers-20260814-064437-fail-only';
  copied.lineageMode = 'none';
  copied.previousFailuresSelected = copied.selected.filter(row => String(row.priorStatus || '').toLowerCase() === 'failed').length;
  copied.previousTimeoutsSelected = copied.selected.filter(row => ['timedout', 'timeout'].includes(String(row.priorStatus || '').toLowerCase())).length;
  copied.partialNotRunSelected = 0;
  copied.currentReleaseFeatureTestsSelected = 0;
  copied.duplicateIdentitiesRemoved = 0;
  copied.newTestsCount = 0;
}

try {
  if (selectionMode === 'failed+new') {
    copied = qualifyManifestSelectionsWithCurrentInventory(copied, { root: process.cwd() });
  }
} catch (error) {
  fail(`${selectionMode} current Playwright inventory could not be used to qualify selections.`, [error?.message || String(error)]);
}

let repairStats = null;
if (selectionMode === 'repair') {
  const scope = resolveCurrentReleaseRepairScope({ currentRecords: loadCurrentRecords() });
  if (!scope.ok) fail('Current-release repair scope could not be resolved against Playwright discovery.', scope.missing.map(row => `${row.project} ${row.specPath} :: ${row.fullSuitePath} :: ${row.exactTestTitle}`));
  repairStats = buildRepairSelection({ failedOnlySelected: copied.selected || [], currentReleaseSelected: scope.selected });
  copied = {
    ...copied,
    mode: 'repair',
    source: 'strict-failed-only-plus-current-release-repair-scope',
    selectionSource: 'failed-only-union-current-release-scope',
    selected: repairStats.selected,
    totalSelected: repairStats.totalSelected,
    desktopSelected: repairStats.selected.filter(item => item.project === 'chromium' || item.projects?.includes('chromium')).length,
    mobileSelected: repairStats.selected.filter(item => item.project === 'mobile-chromium' || item.projects?.includes('mobile-chromium')).length,
    previousFailuresSelected: repairStats.previousFailuresSelected,
    previousTimeoutsSelected: repairStats.previousTimeoutsSelected,
    currentReleaseFeatureTestsSelected: repairStats.currentReleaseFeatureTestsSelected,
    duplicateIdentitiesRemoved: repairStats.duplicateIdentitiesRemoved,
  };
}

const validation = copied.totalSelected === 0 && selectionMode === 'failed-only'
  ? { ok: true, errors: [] }
  : validateManifestForCurrentRun(copied, {
    currentRunDir: runDir,
    currentSourceVersion,
    currentDeployedVersion,
    firebaseProjectId,
    appUrl,
    allowStaticFallback: selectionMode === 'failed-only',
  });
if (!validation.ok) {
  fail(`Refusing unsafe ${selectionMode} manifest.`, validation.errors);
}

const currentManifestPath = path.join(runDir, 'failed-only-test-manifest.json');
writeJson(currentManifestPath, copied);
const failedAndNewSelectionPath = path.join(runDir, 'failed-and-new-manifest-selection.json');
const failedOnlySelectionPath = path.join(runDir, 'failed-only-manifest-selection.json');
const selectionPayload = {
  ok: true,
  runId,
  mode: selectionMode,
  lineageMode: copied.lineageMode || 'full-baseline',
  sourceFullRunDir: selectedSource.baselineFullRunDir,
  previousFailedOnlyRunDir: selectedSource.latestFailedOnlyRunDir || '',
  selectionSource: copied.selectionSource || selectedSource.selectionSource || '',
  manifestPath: currentManifestPath,
  baseline: {
    fullRunId: copied.baselineFullRunId,
    fullRunDir: copied.baselineFullRunDir,
    sourceVersion: copied.baselineSourceVersion,
    deployedVersion: copied.baselineDeployedVersion,
  },
  target: {
    runId,
    runDir,
    sourceVersion: currentSourceVersion,
    deployedVersion: currentDeployedVersion,
  },
  selected: copied.selected,
  totalSelected: copied.selected.length,
  desktopSelected: copied.desktopSelected,
  mobileSelected: copied.mobileSelected,
  previousFailuresSelected: copied.previousFailuresSelected ?? copied.previousFailuresCount ?? 0,
  previousTimeoutsSelected: copied.previousTimeoutsSelected ?? copied.previousTimeoutsCount ?? 0,
  currentReleaseFeatureTestsSelected: copied.currentReleaseFeatureTestsSelected || 0,
  duplicateIdentitiesRemoved: copied.duplicateIdentitiesRemoved || 0,
  newTestsCount: copied.newTestsCount || 0,
  partialNotRunSelected: copied.partialNotRunSelected || 0,
  noFailedOrTimedOutTestsRemain: copied.noFailedOrTimedOutTestsRemain === true || (selectionMode === 'failed-only' && copied.totalSelected === 0),
};
writeJson(failedAndNewSelectionPath, selectionPayload);
writeJson(failedOnlySelectionPath, selectionPayload);
writeJson(validationPath, {
  ok: true,
  runId,
  runDir,
  mode: selectionMode,
  lineageMode: copied.lineageMode || 'full-baseline',
  baselineFullRunDir: selectedSource.baselineFullRunDir,
  baselineSourceVersion: copied.baselineSourceVersion,
  baselineDeployedVersion: copied.baselineDeployedVersion,
  targetSourceVersion: currentSourceVersion,
  targetDeployedVersion: currentDeployedVersion,
  selectionSource: copied.selectionSource || selectedSource.selectionSource || '',
  previousFailedOnlyRunId: copied.previousFailedOnlyRunId || '',
  previousFailedOnlySourceVersion: copied.previousFailedOnlySourceVersion || '',
  previousFailedOnlyDeployedVersion: copied.previousFailedOnlyDeployedVersion || '',
  totalSelected: copied.totalSelected,
  desktopSelected: copied.desktopSelected,
  mobileSelected: copied.mobileSelected,
  previousFailuresSelected: selectionPayload.previousFailuresSelected,
  previousTimeoutsSelected: selectionPayload.previousTimeoutsSelected,
  currentReleaseFeatureTestsSelected: selectionPayload.currentReleaseFeatureTestsSelected,
  duplicateIdentitiesRemoved: selectionPayload.duplicateIdentitiesRemoved,
  newTestsCount: selectionPayload.newTestsCount,
  partialNotRunSelected: selectionPayload.partialNotRunSelected,
  noFailedOrTimedOutTestsRemain: selectionPayload.noFailedOrTimedOutTestsRemain,
  generatedAt: new Date().toISOString(),
});

console.log(`Prepared ${selectionMode} manifest from ${selectedSource.baselineFullRunDir || 'no previous failure source'}`);
if (copied.previousFailedOnlyRunId) console.log(`Narrowed from failed-only descendant: ${copied.previousFailedOnlyRunId} (${copied.previousFailedOnlySourceVersion}/${copied.previousFailedOnlyDeployedVersion})`);
if (selectionPayload.noFailedOrTimedOutTestsRemain) console.log('No failed or timed-out Playwright tests remain.');
console.log(`Failed-only source run: ${copied.previousFailedOnlyRunId || copied.baselineFullRunId || 'none'}`);
console.log(`Source reason: ${copied.selectionSource || selectedSource.selectionSource || 'latest compatible completed Playwright run'}`);
console.log(`Baseline: ${copied.baselineSourceVersion || 'none'}/${copied.baselineDeployedVersion || 'none'}`);
console.log(`Target: ${currentSourceVersion}/${currentDeployedVersion}`);
console.log(`Previous failed identities selected: ${selectionPayload.previousFailuresSelected}`);
console.log(`Previous timed-out identities selected: ${selectionPayload.previousTimeoutsSelected}`);
if (selectionMode === 'repair') {
  console.log(`Current release feature tests selected: ${selectionPayload.currentReleaseFeatureTestsSelected}`);
  console.log(`Duplicate identities removed: ${selectionPayload.duplicateIdentitiesRemoved}`);
  console.log(`Total repair tests selected: ${copied.selected.length}`);
} else if (selectionMode === 'reported-failed-only') {
  console.log('Reported failed-only guard: exactly 6 FAIL identities selected');
  console.log('chromium 2');
  console.log('mobile-chromium 4');
  console.log('timeouts 0');
} else if (selectionMode === 'partial-resume') {
  console.log('Partial resume guard: excludes all 65 passed tests from 20260813-205319');
  console.log(`Failed identities selected: ${copied.previousFailuresSelected || 0}`);
  console.log(`Timed-out identities selected: ${copied.previousTimeoutsSelected || 0}`);
  console.log(`Not-run identities selected: ${copied.partialNotRunSelected || 0}`);
} else if (selectionMode === 'reported-current-blockers') {
  console.log('Current blockers guard: exactly 2 current FAIL identities selected from 20260814-064437');
  console.log(`Failed identities selected: ${copied.previousFailuresSelected || 0}`);
  console.log(`Timed-out identities selected: ${copied.previousTimeoutsSelected || 0}`);
  console.log('Passed and skipped identities selected: 0');
} else {
  console.log(`Previous failed/timed-out identities selected: ${copied.selected.length}`);
}
for (const item of copied.selected) console.log(`- [${item.project || (item.projects || []).join(', ')}] ${item.specPath || item.spec} :: ${item.fullSuitePath ? item.fullSuitePath + ' :: ' : ''}${item.title || item.exactTestTitle}`);
