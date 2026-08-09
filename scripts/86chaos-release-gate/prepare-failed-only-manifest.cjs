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
const validModes = new Set(['failed+new', 'failed-only', 'repair', 'reported-failed-only']);
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
  currentRecords = currentInventoryRecords(process.cwd());
  return currentRecords;
}


function loadReportedFailedOnlyManifest() {
  const manifestPath = path.join(__dirname, 'reported-failed-only-20260809-004632.json');
  const manifest = readJsonIfExists(manifestPath);
  if (!manifest || !Array.isArray(manifest.selected)) fail('Reported failed-only manifest is missing or malformed.', [manifestPath]);
  const runtimeTitle = 'Schedule Builder warning runtime renders without Runtime Recovery or TypeError';
  const projects = new Set((manifest.selected || []).map(row => row.project || (row.projects || [])[0] || ''));
  const desktop = manifest.selected.filter(row => row.project === 'chromium' || row.projects?.includes('chromium')).length;
  const mobile = manifest.selected.filter(row => row.project === 'mobile-chromium' || row.projects?.includes('mobile-chromium')).length;
  const badProjects = [...projects].filter(project => !['chromium', 'mobile-chromium'].includes(project));
  const runtimeSelected = manifest.selected.filter(row => (row.leafTitle || row.exactTestTitle || row.title) === runtimeTitle);
  const errors = [];
  if (manifest.selected.length !== 12) errors.push(`Reported failed-only manifest must select exactly 12 identities, got ${manifest.selected.length}.`);
  if (desktop !== 6) errors.push(`Reported failed-only manifest must select exactly 6 chromium identities, got ${desktop}.`);
  if (mobile !== 6) errors.push(`Reported failed-only manifest must select exactly 6 mobile-chromium identities, got ${mobile}.`);
  if (badProjects.length) errors.push(`Reported failed-only manifest contains disallowed projects: ${badProjects.join(', ')}.`);
  if (runtimeSelected.length) errors.push('Reported failed-only manifest must exclude the already-passing Schedule runtime test.');
  if (errors.length) fail('Reported failed-only selection guard failed.', errors);
  return manifest;
}

function assertReportedFailedOnlySelection(manifest) {
  const runtimeTitle = 'Schedule Builder warning runtime renders without Runtime Recovery or TypeError';
  const selected = manifest.selected || [];
  const desktop = selected.filter(row => row.project === 'chromium' || row.projects?.includes('chromium')).length;
  const mobile = selected.filter(row => row.project === 'mobile-chromium' || row.projects?.includes('mobile-chromium')).length;
  const errors = [];
  if (selected.length !== 12) errors.push(`Expected exactly 12 reported failed-only identities, got ${selected.length}.`);
  if (desktop !== 6) errors.push(`Expected 6 chromium identities, got ${desktop}.`);
  if (mobile !== 6) errors.push(`Expected 6 mobile-chromium identities, got ${mobile}.`);
  if (selected.some(row => (row.leafTitle || row.exactTestTitle || row.title) === runtimeTitle)) errors.push('Already-passing Schedule runtime test was selected.');
  if (selected.some(row => !['chromium', 'mobile-chromium'].includes(row.project || (row.projects || [])[0] || ''))) errors.push('Reported failed-only selected a project outside chromium/mobile-chromium.');
  if (errors.length) fail('Reported failed-only selection guard failed after inventory qualification.', errors);
}

let selectedSource;
try {
  if (selectionMode === 'reported-failed-only') {
    const manifest = loadReportedFailedOnlyManifest();
    selectedSource = {
      manifest: qualifyManifestSelectionsWithCurrentInventory(manifest, { root: process.cwd(), currentRecords: loadCurrentRecords() }),
      baselineFullRunDir: '',
      latestFailedOnlyRunDir: '',
      selectionSource: manifest.selectionSource || 'uploaded-failed-tests-20260809-063843',
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
  if (selectionMode === 'repair' && /No completed full release-gate run/i.test(error?.message || '')) {
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
  copied.source = 'uploaded-failed-tests-20260809-063843';
  copied.selectionSource = 'uploaded-failed-tests-20260809-063843';
  copied.lineageMode = 'none';
  copied.previousFailuresSelected = copied.selected.length;
  copied.previousTimeoutsSelected = 0;
  copied.currentReleaseFeatureTestsSelected = 0;
  copied.duplicateIdentitiesRemoved = 0;
  copied.newTestsCount = 0;
  assertReportedFailedOnlySelection(copied);
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
  console.log('Reported failed-only guard: exactly 12 identities selected (chromium 6, mobile-chromium 6).');
  console.log('Already-passing Schedule runtime tests excluded.');
} else {
  console.log(`Previous failed/timed-out identities selected: ${copied.selected.length}`);
}
for (const item of copied.selected) console.log(`- [${item.project || (item.projects || []).join(', ')}] ${item.specPath || item.spec} :: ${item.fullSuitePath ? item.fullSuitePath + ' :: ' : ''}${item.title || item.exactTestTitle}`);
