const path = require('path');
const { getFailedOnlyManifestPath, getRunId } = require('../../scripts/86chaos-release-gate/run-context.cjs');
const { loadFailedOnlyManifest } = require('../../scripts/86chaos-release-gate/failed-only-manifest-utils.cjs');

function activeManifestPath() {
  return process.env.CHAOS_FAILED_ONLY_MANIFEST_PATH || getFailedOnlyManifestPath(getRunId());
}

const loaded = loadFailedOnlyManifest(activeManifestPath());
const FAILED_ONLY_TESTS = loaded.selected;

function specsFromManifest(rows = FAILED_ONLY_TESTS) {
  return [...new Set((rows || []).map(item => item.spec || item.specPath).filter(Boolean).map(spec => spec.replace(/^tests[\\/]/, '').replace(/\\/g, '/')))].map(spec => spec.startsWith('**/') ? spec : `**/${spec}`);
}

module.exports = {
  FAILED_ONLY_TESTS,
  FAILED_ONLY_MANIFEST_PATH: activeManifestPath(),
  FAILED_ONLY_MANIFEST_ERRORS: loaded.errors,
  specsFromManifest,
};
