const path = require('path');
const { ensureRunDir, readJsonIfExists, writeJson } = require('./run-context.cjs');
const {
  findMostRecentCompletedFullRun,
  generateFailedOnlyManifestFromRun,
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

const fullRunDir = findMostRecentCompletedFullRun({ currentRunDir: runDir });
if (!fullRunDir) {
  fail('No completed full release-gate run with failed Playwright results was found. Run npm run test:play-store before npm run test:play-store:failed.');
}

const preflight = readJsonIfExists(path.join(runDir, 'environment-preflight.json')) || {};
const currentSourceVersion = readPackageVersion();
const currentDeployedVersion = preflight.deployedVersion || preflight.visibleVersion || '';
const firebaseProjectId = preflight.firebaseProjectId || '';
const appUrl = preflight.appUrl || process.env.APP_URL || process.env.CHAOS_BASE_URL || '';

let baselineManifest;
try {
  baselineManifest = generateFailedOnlyManifestFromRun(fullRunDir, { write: false, currentRunDir: runDir });
} catch (error) {
  fail('Failed-only baseline evidence is malformed or unsafe.', [error?.message || String(error)]);
}

const copied = targetQualifiedManifest(baselineManifest, {
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
  totalSelected: copied.totalSelected,
  desktopSelected: copied.desktopSelected,
  mobileSelected: copied.mobileSelected,
  generatedAt: new Date().toISOString(),
});
console.log(`Prepared dynamic failed-only manifest from ${fullRunDir}`);
console.log(`Baseline: ${copied.baselineSourceVersion}/${copied.baselineDeployedVersion}`);
console.log(`Target: ${currentSourceVersion}/${currentDeployedVersion}`);
console.log(`Selected ${copied.selected.length} exact failed project/test combination(s).`);
for (const item of copied.selected) console.log(`- [${item.project || (item.projects || []).join(', ')}] ${item.specPath || item.spec} :: ${item.title || item.exactTestTitle}`);
