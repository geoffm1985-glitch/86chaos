'use strict';

const CURRENT_RELEASE_VERSION = '17.1.21';
const CURRENT_RELEASE_CARRY_FORWARD_NOTE = '17.1.21 preserves existing application behavior while repairing deterministic source-manifest certification and ensuring both experimental release-target validation passes remain branch-aware.';
const CURRENT_RELEASE_REPAIR_SCOPE = [
  {
    specPath: '86chaos-new-implementations/31-footer-version-copyright.spec.cjs',
    fullSuitePath: '17.1.17 footer version and copyright identity',
    exactTestTitle: 'footer shows the current version together with the copyright on desktop',
  },
  {
    specPath: '86chaos-new-implementations/31-footer-version-copyright.spec.cjs',
    fullSuitePath: '17.1.17 footer version and copyright identity',
    exactTestTitle: 'footer identity remains reachable on mobile above the fixed bottom toolbar',
  },
  {
    specPath: '86chaos-new-implementations/30-navigation-logo-toolbar-fit.spec.cjs',
    fullSuitePath: '17.1.16 navigation, logo, and toolbar fit repair',
    exactTestTitle: 'desktop uses the categorized legacy menu in the new sidebar and Message Board labels stay horizontal',
  },
  {
    specPath: '86chaos-new-implementations/30-navigation-logo-toolbar-fit.spec.cjs',
    fullSuitePath: '17.1.16 navigation, logo, and toolbar fit repair',
    exactTestTitle: 'phone header has no hamburger and 86Voice is the first of six bottom-toolbar slots',
  },
  {
    specPath: '86chaos-new-implementations/29-authenticated-shell-hook-order.spec.cjs',
    fullSuitePath: '17.1.15 authenticated shell hook-order repair',
    exactTestTitle: 'login and session hydration reach the real app shell without a React hook-order crash',
  },
  {
    specPath: '86chaos-new-implementations/28-approved-reference-full-app-parity.spec.cjs',
    fullSuitePath: '17.1.13 approved-reference full-app visual parity',
    exactTestTitle: 'desktop shell matches approved reference hierarchy without duplicate top-right menus',
  },
  {
    specPath: '86chaos-new-implementations/28-approved-reference-full-app-parity.spec.cjs',
    fullSuitePath: '17.1.13 approved-reference full-app visual parity',
    exactTestTitle: 'mobile shell uses the restored six-slot bottom bar with visible 86Voice and clean header',
  },
  {
    specPath: '86chaos-new-implementations/28-approved-reference-full-app-parity.spec.cjs',
    fullSuitePath: '17.1.13 approved-reference full-app visual parity',
    exactTestTitle: 'representative routes and nested pages retain the approved visual frame',
  },
  {
    specPath: '86chaos-new-implementations/27-mobile-voice-pwa-panel.spec.cjs',
    fullSuitePath: '17.1.12 Android installed-PWA 86Voice panel repair',
    exactTestTitle: 'real touchscreen tap renders the Voice panel outside the legacy dock and starts recognition once',
  },
  {
    specPath: '86chaos-new-implementations/26-mobile-voice-physical-touch.spec.cjs',
    fullSuitePath: '17.1.11 mobile 86Voice physical touch repair',
    exactTestTitle: 'real touchscreen tap opens 86Voice and starts one production recognition session',
  },
  {
    specPath: '86chaos-new-implementations/25-mobile-voice-production-parity.spec.cjs',
    fullSuitePath: '17.1.10 production 17.0.29 86Voice parity',
    exactTestTitle: 'first toolbar Voice tap uses the production Web Speech lifecycle inside the new UI',
  },
  {
    specPath: '86chaos-new-implementations/21-mobile-bottom-nav-single-line.spec.cjs',
    fullSuitePath: '17.1.5 mobile bottom navigation label fit',
    exactTestTitle: 'all six bottom-toolbar labels stay on one line at narrow-phone width',
  },
  {
    specPath: '86chaos-new-implementations/20-mobile-workflow-repair.spec.cjs',
    fullSuitePath: '17.1.3 mobile workflow repair',
    exactTestTitle: 'mobile toolbar restores 86Voice as the first of six bottom-toolbar slots',
  },
  {
    specPath: '86chaos-new-implementations/20-mobile-workflow-repair.spec.cjs',
    fullSuitePath: '17.1.3 mobile workflow repair',
    exactTestTitle: 'Schedule Builder day/date row remains pinned while employee rows scroll',
  },
  {
    specPath: '86chaos-new-implementations/20-mobile-workflow-repair.spec.cjs',
    fullSuitePath: '17.1.3 mobile workflow repair',
    exactTestTitle: 'Kitchen Command Center opens without the formatFullDate recovery crash',
  },
  {
    specPath: '86chaos-new-implementations/19-concept1-complete-route-subtab-fidelity.spec.cjs',
    fullSuitePath: '17.1.2 complete Concept 1 route and subtab fidelity',
    exactTestTitle: 'every real routed page uses the complete Concept 1 frame and desktop/mobile geometry',
  },
  {
    specPath: '86chaos-new-implementations/19-concept1-complete-route-subtab-fidelity.spec.cjs',
    fullSuitePath: '17.1.2 complete Concept 1 route and subtab fidelity',
    exactTestTitle: 'representative real subtabs retain the Concept 1 frame after navigation',
  },
  {
    specPath: '86chaos-new-implementations/19-concept1-complete-route-subtab-fidelity.spec.cjs',
    fullSuitePath: '17.1.2 complete Concept 1 route and subtab fidelity',
    exactTestTitle: 'Time Clock & Schedule is first on desktop while Today remains first on mobile',
  },
  {
    specPath: '86chaos-new-implementations/19-concept1-complete-route-subtab-fidelity.spec.cjs',
    fullSuitePath: '17.1.2 complete Concept 1 route and subtab fidelity',
    exactTestTitle: 'nested Labor & Payroll subtabs keep the Concept 1 command surface',
  },
  {
    specPath: '86chaos-new-implementations/19-concept1-complete-route-subtab-fidelity.spec.cjs',
    fullSuitePath: '17.1.2 complete Concept 1 route and subtab fidelity',
    exactTestTitle: 'System Administrator exposes exactly 21 canonical directory cards and featured shortcuts do not duplicate identities',
  },
  {
    specPath: '86chaos-new-implementations/18-app-wide-deep-route-layout.spec.cjs',
    fullSuitePath: '17.1.1 Concept 1 deep route migration',
    exactTestTitle: 'every representative real tab keeps the redesigned route geometry on desktop and mobile',
  },
  {
    specPath: '86chaos-new-implementations/17-app-wide-concept1-layout.spec.cjs',
    fullSuitePath: '17.1.1 app-wide Concept 1 responsive shell',
    exactTestTitle: 'shared desktop/mobile shell keeps real application content wide, touchable, and overflow-safe',
  },
  {
    specPath: '86chaos-new-implementations/16-system-admin-desktop-full-width.spec.cjs',
    fullSuitePath: '17.0.38 System Administrator desktop full-width repair',
    exactTestTitle: 'desktop System Administrator occupies the desktop workspace instead of the retired 232px navigation rail',
  },
  {
    specPath: '86chaos-new-implementations/15-system-admin-desktop-concept1.spec.cjs',
    fullSuitePath: '17.0.37 System Administrator desktop Concept 1 fidelity',
    exactTestTitle: 'desktop keeps the two-two-three featured hierarchy and every admin page stays reachable',
  },
  {
    specPath: '86chaos-new-implementations/14-system-admin-complete-directory-desktop.spec.cjs',
    fullSuitePath: '17.0.36 System Administrator complete directory and desktop repair',
    exactTestTitle: 'main page exposes every internal admin page and subpages never use the native all-tools selector',
  },
  {
    specPath: '86chaos-new-implementations/13-system-admin-subpage-polish.spec.cjs',
    fullSuitePath: '17.0.35 System Administrator subpage polish',
    exactTestTitle: 'admin tools use readable Concept 1 subpages and mobile metrics no longer collapse into cramped two-column tiles',
  },
  {
    specPath: '86chaos-new-implementations/12-system-admin-subpages-back-navigation.spec.cjs',
    fullSuitePath: '17.0.34 System Administrator subpages and navigation',
    exactTestTitle: 'admin subpages share Concept 1 styling and drawer System Administrator returns to the complete home',
  },
  {
    specPath: '86chaos-new-implementations/11-system-admin-concept1-exact.spec.cjs',
    fullSuitePath: '17.0.33 System Administrator Concept 1 exact home',
    exactTestTitle: 'System Administrator home uses the complete Concept 1 directory and removes the attention dashboard',
  },
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
