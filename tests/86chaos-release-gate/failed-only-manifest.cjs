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

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pathPartsForSelection(item = {}) {
  const stripFixture = parts => parts.filter(part => !/^failed(?:-only)? .*fixture$/i.test(String(part || '').trim()));
  if (Array.isArray(item.titlePathParts) && item.titlePathParts.length) return stripFixture(item.titlePathParts);
  const full = String(item.fullTitle || '').split(/\s+>\s+|\s+›\s+/).map(part => part.trim()).filter(Boolean);
  if (full.length) return stripFixture(full);
  return [item.title || item.exactTestTitle || item.leafTitle || ''].filter(Boolean);
}

function selectionsForProject(rows = FAILED_ONLY_TESTS, projectName = '') {
  return (rows || []).filter(item => (item.projects || []).includes(projectName) || item.project === projectName);
}

function titlesForProject(rows = FAILED_ONLY_TESTS, projectName = '') {
  return [...new Set(selectionsForProject(rows, projectName).map(item => pathPartsForSelection(item).join(' > ')).filter(Boolean))];
}

function grepForProject(rows = FAILED_ONLY_TESTS, projectName = '') {
  const selections = selectionsForProject(rows, projectName);
  if (!selections.length) return /$a/;
  return new RegExp(selections.map(item => {
    const parts = pathPartsForSelection(item).map(escapeRegExp).filter(Boolean);
    if (!parts.length) return '$a';
    return `^.*${parts.join('[\\s\\S]*')}$`;
  }).join('|'));
}

module.exports = {
  FAILED_ONLY_TESTS,
  FAILED_ONLY_MANIFEST_PATH: activeManifestPath(),
  FAILED_ONLY_MANIFEST_ERRORS: loaded.errors,
  specsFromManifest,
  titlesForProject,
  grepForProject,
  pathPartsForSelection,
};
