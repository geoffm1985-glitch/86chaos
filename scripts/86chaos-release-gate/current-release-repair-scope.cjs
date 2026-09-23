'use strict';

const CURRENT_RELEASE_VERSION = '17.0.31';
const CURRENT_RELEASE_CARRY_FORWARD_NOTE = '17.0.31 carries forward Schedule Builder assignment and browser-safe i18n coverage while refreshing the System Administrator shell, extending Spanish Phase 2 into that experience, and keeping the stale testing-target blocker guidance aligned with testing.86chaos.com.';
const CURRENT_RELEASE_REPAIR_SCOPE = [
  {
    specPath: '86chaos-full-audit/10-presence-system-admin.spec.cjs',
    fullSuitePath: '10 System Administrator without online tracking',
    exactTestTitle: 'System Administrator and Staff Roster do not expose online or last-seen status',
  },
  {
    specPath: '86chaos-new-implementations/08-phase1-spanish-interface.spec.cjs',
    fullSuitePath: '17.0.26 Phase 1 Spanish interface',
    exactTestTitle: 'a user can switch their own interface to Spanish and core Phase 1 navigation follows it',
  },
  {
    specPath: '86chaos-new-implementations/09-schedule-builder-shift-assignment.spec.cjs',
    fullSuitePath: '17.0.27 Schedule Builder shift assignment emergency repair',
    exactTestTitle: 'manager can assign one future shift through Schedule Builder and remove the QA shift afterward',
  },
  {
    specPath: '86chaos-new-implementations/10-app-bootstrap-i18n-runtime.spec.cjs',
    fullSuitePath: '17.0.28 browser-safe i18n bootstrap repair',
    exactTestTitle: 'application boots through the i18n provider without a translation runtime crash',
  },
].flatMap(row => ['chromium', 'mobile-chromium'].map(project => ({
  ...row,
  title: row.exactTestTitle,
  leafTitle: row.exactTestTitle,
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
    else selected.push({ ...match, selectionReasons: ['current_release_feature_test'], currentReleaseVersion: CURRENT_RELEASE_VERSION, carryForwardNote: CURRENT_RELEASE_CARRY_FORWARD_NOTE });
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

function isTimeoutSelection(row = {}) {
  return row.priorStatus === 'timedOut' || (Array.isArray(row.selectionReasons) && row.selectionReasons.includes('previous_timeout'));
}

function isFailureSelection(row = {}) {
  return !isTimeoutSelection(row) && (row.priorStatus === 'failed' || row.priorStatus === 'interrupted' || (Array.isArray(row.selectionReasons) && row.selectionReasons.includes('previous_failure')));
}

function buildRepairSelection({ failedOnlySelected = [], currentReleaseSelected = [] } = {}) {
  const previous = dedupe((failedOnlySelected || []).map(row => ({ ...row, selectionReasons: row.selectionReasons || ['previous_failure'] })));
  const features = dedupe((currentReleaseSelected || []).map(row => ({ ...row, selectionReasons: row.selectionReasons || ['current_release_feature_test'] })));
  const selected = dedupe([...previous, ...features]);
  return {
    mode: 'repair',
    previousFailuresSelected: previous.filter(isFailureSelection).length,
    previousTimeoutsSelected: previous.filter(isTimeoutSelection).length,
    currentReleaseFeatureTestsSelected: features.length,
    duplicateIdentitiesRemoved: previous.length + features.length - selected.length,
    totalSelected: selected.length,
    selected,
  };
}

module.exports = {
  CURRENT_RELEASE_VERSION,
  CURRENT_RELEASE_CARRY_FORWARD_NOTE,
  CURRENT_RELEASE_REPAIR_SCOPE,
  normalizeRel,
  keyOf,
  normalizeSelection,
  dedupe,
  resolveCurrentReleaseRepairScope,
  isTimeoutSelection,
  isFailureSelection,
  buildRepairSelection,
};
