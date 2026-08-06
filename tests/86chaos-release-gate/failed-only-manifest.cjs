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

function titlesForProject(rows = FAILED_ONLY_TESTS, projectName = '') {
  return [...new Set((rows || [])
    .filter(item => (item.projects || []).includes(projectName) || item.project === projectName)
    .map(item => item.title || item.exactTestTitle)
    .filter(Boolean))];
}

function grepForProject(rows = FAILED_ONLY_TESTS, projectName = '') {
  const titles = titlesForProject(rows, projectName);
  if (!titles.length) return /$a/;

  // Playwright grep is applied to the test title path. Depending on the
  // reporter/runtime, that string may be joined with spaces instead of
  // the human-readable " > " delimiter. Keep the match exact to the
  // selected test title, but allow any title-path prefix that ends with
  // whitespace so failed-only runs do not produce a false "No tests found".
  return new RegExp(titles
    .map(title => {
      const escaped = escapeRegExp(title);
      return `(?:^${escaped}$|[\\s\\S]*\\s${escaped}$)`;
    })
    .join('|'));
}

module.exports = {
  FAILED_ONLY_TESTS,
  FAILED_ONLY_MANIFEST_PATH: activeManifestPath(),
  FAILED_ONLY_MANIFEST_ERRORS: loaded.errors,
  specsFromManifest,
  titlesForProject,
  grepForProject,
};
