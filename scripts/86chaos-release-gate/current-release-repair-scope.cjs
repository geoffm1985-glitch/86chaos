'use strict';

const CURRENT_RELEASE_VERSION = '16.0.153';
const CURRENT_RELEASE_REPAIR_SCOPE = [
  'Schedule Builder requested-off warning shows employee name and never Someone',
  'Schedule Builder coverage warnings show under and over target math',
  'Schedule Builder warning dismissal hides only the warning',
  'Request Off employee filter narrows and clears manager-visible requests',
  'Approve All Visible updates only filtered visible pending requests',
  'Archive All Visible archives only filtered visible eligible requests',
].flatMap(title => ['chromium', 'mobile-chromium'].map(project => ({
  specPath: 'e2e/schedule-request-off-management.spec.cjs',
  fullSuitePath: '16.0.153 Schedule warnings and Request Off management',
  exactTestTitle: title,
  title,
  leafTitle: title,
  project,
  projects: [project],
})));

function normalizeRel(value = '') {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/^tests\//, '');
}

function keyOf(row = {}) {
  return [normalizeRel(row.specPath || row.spec || ''), String(row.fullSuitePath || ''), String(row.exactTestTitle || row.title || row.leafTitle || ''), String(row.project || row.projectName || '')].join('\u0000');
}

function normalizeSelection(row = {}) {
  const title = row.exactTestTitle || row.title || row.leafTitle || '';
  const fullSuitePath = row.fullSuitePath || (Array.isArray(row.suitePathParts) ? row.suitePathParts.join(' > ') : '');
  const project = row.project || row.projectName || (Array.isArray(row.projects) ? row.projects[0] : '') || '';
  return {
    ...row,
    spec: normalizeRel(row.specPath || row.spec || ''),
    specPath: normalizeRel(row.specPath || row.spec || ''),
    title,
    exactTestTitle: title,
    leafTitle: row.leafTitle || title,
    fullSuitePath,
    suitePathParts: Array.isArray(row.suitePathParts) ? row.suitePathParts : fullSuitePath.split(' > ').filter(Boolean),
    titlePathParts: Array.isArray(row.titlePathParts) && row.titlePathParts.length ? row.titlePathParts : [...fullSuitePath.split(' > ').filter(Boolean), title].filter(Boolean),
    fullTitle: row.fullTitle || [...fullSuitePath.split(' > ').filter(Boolean), title].filter(Boolean).join(' > '),
    project,
    projects: [project].filter(Boolean),
    stableKey: row.stableKey || keyOf({ ...row, exactTestTitle: title, fullSuitePath, project }),
  };
}

function dedupe(rows = []) {
  const out = [];
  const seen = new Set();
  for (const row of rows || []) {
    const normalized = normalizeSelection(row);
    const key = normalized.stableKey || keyOf(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

function resolveCurrentReleaseRepairScope({ currentRecords = [], explicitScope = CURRENT_RELEASE_REPAIR_SCOPE } = {}) {
  const inventory = new Map((currentRecords || []).map(row => [keyOf(row), normalizeSelection(row)]));
  const selected = [];
  const missing = [];
  for (const desired of explicitScope || []) {
    const key = keyOf(desired);
    const match = inventory.get(key);
    if (!match) missing.push(desired);
    else selected.push({ ...match, selectionReasons: ['current_release_feature_test'], currentReleaseVersion: CURRENT_RELEASE_VERSION });
  }
  return {
    ok: missing.length === 0,
    version: CURRENT_RELEASE_VERSION,
    selected: dedupe(selected),
    totalSelected: dedupe(selected).length,
    missing,
    missingCount: missing.length,
    explicitScopeCount: (explicitScope || []).length,
  };
}

function buildRepairSelection({ failedOnlySelected = [], currentReleaseSelected = [] } = {}) {
  const previous = dedupe((failedOnlySelected || []).map(row => ({ ...row, selectionReasons: row.selectionReasons || ['previous_failure'] })));
  const features = dedupe((currentReleaseSelected || []).map(row => ({ ...row, selectionReasons: row.selectionReasons || ['current_release_feature_test'] })));
  const selected = dedupe([...previous, ...features]);
  return {
    mode: 'repair',
    previousFailuresSelected: previous.length,
    currentReleaseFeatureTestsSelected: features.length,
    duplicateIdentitiesRemoved: previous.length + features.length - selected.length,
    totalSelected: selected.length,
    selected,
  };
}

module.exports = {
  CURRENT_RELEASE_VERSION,
  CURRENT_RELEASE_REPAIR_SCOPE,
  normalizeRel,
  keyOf,
  normalizeSelection,
  dedupe,
  resolveCurrentReleaseRepairScope,
  buildRepairSelection,
};
