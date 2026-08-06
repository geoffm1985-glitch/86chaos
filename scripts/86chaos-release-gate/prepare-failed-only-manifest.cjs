const path = require('path');
const { ensureRunDir, readJsonIfExists, writeJson } = require('./run-context.cjs');
const {
  selectFailedOnlyManifestForCurrentRun,
  readPackageVersion,
  targetQualifiedManifest,
  validateManifestForCurrentRun,
} = require('./failed-only-manifest-utils.cjs');

const { runDir, runId } = ensureRunDir();
const validationPath = path.join(runDir, 'failed-only-manifest-validation.json');
function fail(message, details = []) {
  const errors = [message, ...details].filter(Boolean);
  writeJson(validationPath, {
    ok: false,
    runId,
    runDir,
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

let selectedSource;
try {
  selectedSource = selectFailedOnlyManifestForCurrentRun({
    currentRunDir: runDir,
    target: {
      targetRunId: runId,
      targetSourceVersion: currentSourceVersion,
      targetDeployedVersion: currentDeployedVersion,
    },
  });
} catch (error) {
  fail('Failed-only baseline evidence is malformed or unsafe.', [error?.message || String(error)]);
}
const fullRunDir = selectedSource.baselineFullRunDir;
const copied = targetQualifiedManifest(selectedSource.manifest, {
  targetRunId: runId,
  targetRunDir: runDir,
  targetSourceVersion: currentSourceVersion,
  targetDeployedVersion: currentDeployedVersion,
});

const validation = validateManifestForCurrentRun(copied, {
  currentRunDir: runDir,
  currentSourceVersion,
  currentDeployedVersion,
  firebaseProjectId,
  appUrl,
});
if (!validation.ok) {
  fail('Refusing unsafe failed-only manifest.', validation.errors);
}

const currentManifestPath = path.join(runDir, 'failed-only-test-manifest.json');
writeJson(currentManifestPath, copied);
writeJson(path.join(runDir, 'failed-only-manifest-selection.json'), {
  ok: true,
  runId,
  mode: 'failed-only',
  sourceFullRunDir: fullRunDir,
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
});
writeJson(validationPath, {
  ok: true,
  runId,
  runDir,
  baselineFullRunDir: fullRunDir,
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
  generatedAt: new Date().toISOString(),
});
console.log(`Prepared dynamic failed-only manifest from ${fullRunDir}`);
if (copied.previousFailedOnlyRunId) console.log(`Narrowed from failed-only descendant: ${copied.previousFailedOnlyRunId} (${copied.previousFailedOnlySourceVersion}/${copied.previousFailedOnlyDeployedVersion})`);
console.log(`Baseline: ${copied.baselineSourceVersion}/${copied.baselineDeployedVersion}`);
console.log(`Target: ${currentSourceVersion}/${currentDeployedVersion}`);
console.log(`Selected ${copied.selected.length} exact failed project/test combination(s).`);
for (const item of copied.selected) console.log(`- [${item.project || (item.projects || []).join(', ')}] ${item.specPath || item.spec} :: ${item.title || item.exactTestTitle}`);
