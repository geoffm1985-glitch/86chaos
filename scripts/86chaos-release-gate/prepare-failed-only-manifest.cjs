const fs = require('fs');
const path = require('path');
const { ensureRunDir, getFailedOnlyManifestPath, readJsonIfExists, writeJson } = require('./run-context.cjs');
const { findMostRecentCompletedFullRun, generateFailedOnlyManifestFromRun, readPackageVersion, validateManifestForCurrentRun } = require('./failed-only-manifest-utils.cjs');

const { runDir, runId } = ensureRunDir();
const fullRunDir = findMostRecentCompletedFullRun({ currentRunDir: runDir });
if (!fullRunDir) {
  console.error('No completed full release-gate run with a Playwright report was found. Run npm run test:play-store before npm run test:play-store:failed.');
  process.exit(1);
}
const manifest = generateFailedOnlyManifestFromRun(fullRunDir, { write: true });
const preflight = readJsonIfExists(path.join(runDir, 'environment-preflight.json')) || {};
const currentSourceVersion = readPackageVersion();
const currentDeployedVersion = preflight.deployedVersion || preflight.visibleVersion || '';
const validation = validateManifestForCurrentRun(manifest, { currentSourceVersion, currentDeployedVersion });
if (!validation.ok) {
  console.error(`Refusing stale or invalid failed-only manifest:\n${validation.errors.join('\n')}`);
  process.exit(1);
}
const currentManifestPath = getFailedOnlyManifestPath(runId);
fs.copyFileSync(path.join(fullRunDir, 'failed-only-test-manifest.json'), currentManifestPath);
const copied = { ...manifest, copiedToRunId: runId, copiedToRunDir: runDir, copiedAt: new Date().toISOString(), currentSourceVersion, currentDeployedVersion };
writeJson(currentManifestPath, copied);
writeJson(path.join(runDir, 'failed-only-manifest-selection.json'), { ok: true, runId, sourceFullRunDir: fullRunDir, manifestPath: currentManifestPath, selected: copied.selected });
console.log(`Prepared dynamic failed-only manifest from ${fullRunDir}`);
console.log(`Selected ${copied.selected.length} exact failed project/test combination(s).`);
for (const item of copied.selected) console.log(`- [${item.project || (item.projects || []).join(', ')}] ${item.specPath || item.spec} :: ${item.title || item.exactTestTitle}`);
