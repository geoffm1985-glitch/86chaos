#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
let failures = 0;
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function json(file) { return JSON.parse(read(file)); }
function sha(file) { return crypto.createHash('sha256').update(read(file)).digest('hex'); }
function assert(condition, message) {
  if (!condition) { failures += 1; console.error(`FAIL: ${message}`); }
  else console.log(`OK: ${message}`);
}
const pkg = json('package.json');
const lock = json('package-lock.json');
const version = json('public/version.json');
const app = read('src/App.js');
const appCore = read('src/core/appCore.js');
const apiVersion = read('api/_version.js');
const people = read('api/system-admin/people.js');
const peopleSearch = read('api/system-admin/people-search.js');
const workspaces = read('api/system-admin/workspaces.js');
const fakeProfile = read('tests/86chaos-full-audit/utils/fake-restaurant-profile.cjs');
const auditHelpers = read('tests/86chaos-full-audit/utils/audit-helpers.cjs');
const routeMatrix = read('scripts/86chaos-release-gate/route-access-matrix.cjs');
const sinceRunner = read('scripts/run-tests-since-16-0-170.cjs');

assert(pkg.version === '16.0.200', 'package.json version is 16.0.200');
assert(lock.version === '16.0.200' && lock.packages?.['']?.version === '16.0.200', 'package-lock root versions are 16.0.200');
assert(pkg.scripts['test:source'] === 'node scripts/validate-16-0-200.js', 'test:source points to 16.0.200 validator');
assert(version.version === '16.0.200' && version.build === '16.0.200', 'public/version.json version/build are 16.0.200');
assert(version.releaseTitle === 'Runner Target Auto-Resolve and Remaining Surface Reachability Repair', '16.0.200 release title identifies runner target auto-resolve and remaining surface reachability repair');
assert(appCore.includes("CURRENT_VERSION = '16.0.200'"), 'app core CURRENT_VERSION is 16.0.200');
assert(apiVersion.includes("APP_VERSION = '16.0.200'") && apiVersion.includes("SECURITY_SCHEMA_VERSION = '16.0.200'"), 'api version reports 16.0.200');
assert(fs.existsSync(path.join(root, 'scripts/validate-16-0-195.js')), '16.0.195 validator remains available');
assert(fs.existsSync(path.join(root, 'scripts/validate-16-0-193.js')), '16.0.193 validator was preserved');
assert(fs.existsSync(path.join(root, 'scripts/validate-16-0-191.js')), '16.0.191 validator was preserved');

assert(sha('firestore.rules') === '51bfd7d39edd59f680ae41a149c108cec8cd42d00b102d84cb00ee40d90264d9', 'firestore.rules unchanged');
assert(sha('storage.rules') === '174e7e9a140193ff69ccf0f0d3e5c65b81a9e0fbbd612bff45ce57e7a3a7ce9c', 'storage.rules unchanged');
assert(sha('database.rules.json') === '152b5cd3f9839f598c9602706d8205b96759296e865d540b52c780900bfba138', 'database.rules.json unchanged');
assert(sha('firestore.indexes.json') === 'ee666de303988cd269f7c09fa63678a2deb1cfcaa199cb4f1656dd9bddcc4b4b', 'firestore.indexes.json unchanged');
assert(sha('firebase.json') === 'bd837a11c71750d4da6ccfcb725ca54e78dd76008b525ec54c7fe79a5b8a3ca4', 'firebase.json unchanged');

const switchBlock = app.match(/const switchWorkspace = \(workspace\) => \{[\s\S]*?addToast\('Workspace Switched'/)?.[0] || '';
assert(switchBlock.includes('transitionActiveTabState(nextDefaultTab);'), 'workspace switch uses canonical transitionActiveTabState helper');
assert(!/activeTabStateRef\.current = nextDefaultTab;\s*setActiveTabState\(nextDefaultTab\);/.test(switchBlock), 'workspace switch no longer bypasses schedule-builder query subtab setup');
assert(/if \(normalized === 'schedule'\)[\s\S]*setActiveScheduleSubTab\('schedule-builder'\)/.test(app), 'canonical route helper maps schedule to schedule-builder before render');

for (const [name, source, code, message] of [
  ['people', people, 'system-admin-people-failed', 'Could not load people.'],
  ['people-search', peopleSearch, 'system-admin-people-search-failed', 'Could not search people.'],
  ['workspaces', workspaces, 'system-admin-workspaces-failed', 'Could not load workspaces.'],
]) {
  assert(source.includes("if (req.method !== 'GET')"), `${name} method guard preserved`);
  assert(source.includes('try {') && source.includes('} catch (error) {'), `${name} has controlled unexpected-error boundary`);
  assert(source.includes(`code: '${code}'`) && source.includes(`error: '${message}'`), `${name} returns controlled public 500 shape`);
  assert(!/stack\s*:/.test(source), `${name} does not return stack traces`);
}

assert(/staff:\s*\[[^\]]*'hr-training'[^\]]*\]/s.test(routeMatrix), 'staff route matrix includes hr-training');
assert(fakeProfile.includes('validAllenCurrentWeekShifts') && fakeProfile.includes("date !== tomorrowStr") && fakeProfile.includes('QA fixture requires a valid Allen QA shift date distinct from Sara QA conflict date.'), 'Allen Request Off fixture derives from a real valid Allen shift distinct from Sara conflict');
assert(auditHelpers.includes('\\bInvalid Date\\b(?!s)'), 'BAD_VALUE_RE distinguishes literal Invalid Date from invalid dates prose');

assert(fs.existsSync(path.join(root, 'api/release-gate-16-0-192-source-regressions.test.cjs')), '16.0.192 source regression remains present');
assert(fs.existsSync(path.join(root, 'api/system-admin-controlled-errors-16-0-192.test.cjs')), '16.0.192 System Admin controlled error regression remains present');
assert(sinceRunner.includes('api/release-gate-16-0-192-source-regressions.test.cjs'), 'targeted runner retains 16.0.192 source regression');
assert(sinceRunner.includes('api/system-admin-controlled-errors-16-0-192.test.cjs'), 'targeted runner retains 16.0.192 System Admin controlled error regression');

assert(fs.existsSync(path.join(root, 'api/failed-only-runner-ultimate-universe-16-0-193.test.cjs')), '16.0.193 failed-only runner regression exists');
assert(sinceRunner.includes('api/failed-only-runner-ultimate-universe-16-0-193.test.cjs'), 'targeted runner includes 16.0.193 failed-only runner regression');
for (const file of [
  'test-tools/ultimate-source-inventory.cjs',
  'tests/86chaos-full-audit/13-back-office-document-vault.spec.cjs',
  'tests/86chaos-release-gate/28-exhaustive-route-state-control-graph.spec.cjs',
  'tests/86chaos-release-gate/30-exhaustive-role-route-permission-matrix.spec.cjs',
  'tests/86chaos-release-gate/31-exhaustive-responsive-nested-layout.spec.cjs',
  'tests/86chaos-release-gate/32-exhaustive-nested-accessibility.spec.cjs',
  'tests/86chaos-release-gate/34-ultimate-test-universe-integrity.spec.cjs',
]) assert(fs.existsSync(path.join(root, file)), `Ultimate release-gate file restored: ${file}`);
const failedOnlyPrepare = read('scripts/86chaos-release-gate/prepare-failed-only-manifest.cjs');
const failedOnlyConfig = read('playwright.failed-release.config.cjs');
assert(failedOnlyPrepare.includes('reported-failed-only-20260822-173450.json'), 'failed-only runner preserves the authoritative 16-identity baseline');
assert(failedOnlyPrepare.includes('reported-failed-only-20260823-183916.json'), 'failed-only runner bundles the latest 10-identity failed-only fallback');
assert(failedOnlyPrepare.includes('loadBundledLatestFailedOnlyFallback'), 'failed-only runner can prefer the latest focused failure fallback when local history is missing');
assert(failedOnlyPrepare.includes("allowStaticFallback: selectionMode === 'failed-only'"), 'failed-only manifest validation can fall back to source inventory');
assert(!failedOnlyConfig.includes('generatePlaywrightInventory'), 'focused failed-only config does not rediscover the full Playwright universe');
assert(failedOnlyConfig.includes("discoveryMode: 'failed-only-manifest-selection'"), 'focused failed-only inventory is derived from the validated exact selection');
assert(read('tests/86chaos-full-audit/13-back-office-document-vault.spec.cjs').includes('finish attaching its file before the test refreshes the page'), 'Document Vault failed test waits for file attachment before refresh');
assert(read('tests/86chaos-release-gate/utils/exhaustive-ui-helpers.cjs').includes('navigation-control-visible-descriptor-proven'), 'exhaustive helper records stable navigation descriptors without stale live-index click failures');
assert(/staff:\s*\[[^\]]*'settings'[^\]]*\]/s.test(routeMatrix), 'staff route matrix includes settings when the app exposes staff-safe preferences');
assert(read('tests/e2e/schedule-request-off-management.spec.cjs').includes('Schedule Builder must hydrate seeded QA staff before warning assertions run'), 'Request Off warning test waits for seeded staff hydration');


const headerAndPwaAssets = [
  'public/86chaos-icon-16-v2.png',
  'public/86chaos-icon-32-v2.png',
  'public/86chaos-icon-48-v2.png',
  'public/86chaos-icon-144-v2.png',
  'public/86chaos-icon-180-v2.png',
  'public/86chaos-pwa-192-v4.png',
  'public/86chaos-icon-256-v2.png',
  'public/86chaos-icon-384-v2.png',
  'public/86chaos-pwa-512-v4.png',
  'public/86chaos-maskable-192-v4.png',
  'public/86chaos-maskable-512-v4.png',
  'public/6139.png'
];
const manifest = json('public/manifest.json');
const indexHtml = read('public/index.html');
const common = read('src/components/common.jsx');
const cheersLogo = read('src/components/CheersLogo.js');
for (const file of headerAndPwaAssets) {
  const assetPath = path.join(root, file);
  assert(fs.existsSync(assetPath), `required 86 Chaos public image asset exists: ${file}`);
  if (fs.existsSync(assetPath)) {
    assert(fs.statSync(assetPath).size > 0, `required 86 Chaos public image asset is non-empty: ${file}`);
  }
}
assert(common.includes('src="/86chaos-icon-48-v2.png"') && common.includes('src="/6139.png"'), 'primary header brand still references restored app icon and 86 Chaos wordmark');
assert(cheersLogo.includes('src="/86chaos-icon-48-v2.png"') && cheersLogo.includes('src="/6139.png"'), 'alternate CheersLogo header brand still references restored app icon and wordmark');
assert(indexHtml.includes('/86chaos-icon-16-v2.png') && indexHtml.includes('/86chaos-icon-32-v2.png') && indexHtml.includes('/86chaos-icon-48-v2.png') && indexHtml.includes('/86chaos-icon-180-v2.png'), 'index.html references restored favicon and Apple touch icon assets');
for (const src of ['/86chaos-icon-16-v2.png','/86chaos-icon-32-v2.png','/86chaos-icon-48-v2.png','/86chaos-icon-144-v2.png','/86chaos-icon-180-v2.png','/86chaos-pwa-192-v4.png','/86chaos-icon-256-v2.png','/86chaos-icon-384-v2.png','/86chaos-pwa-512-v4.png','/86chaos-maskable-192-v4.png','/86chaos-maskable-512-v4.png']) {
  assert((manifest.icons || []).some(icon => icon.src === src), `manifest references restored PWA asset: ${src}`);
}
assert(sinceRunner.includes('api/public-icon-assets-16-0-195.test.cjs'), 'targeted runner includes the public icon regression while 16.0.200 validates app-source failed-only repairs');

const exhaustiveHelper = read('tests/86chaos-release-gate/utils/exhaustive-ui-helpers.cjs');
const scheduleFeature = read('src/features/schedule.jsx');
const managementFeature = read('src/features/management.jsx');
const inventoryFeature = read('src/features/inventory.jsx');
const prepFeature = read('src/features/operations.jsx');
assert(exhaustiveHelper.includes('locatorFromFormDescriptor') && exhaustiveHelper.includes('restoreAndObserve(page,'), '16.0.200 uses stable form-control descriptors for failed-only form probes');
assert(managementFeature.includes('aria-label={tab.label}') && managementFeature.includes('title={tab.label}'), '16.0.200 exposes full System Administrator mobile tab labels to release-gate coverage');
assert(managementFeature.includes('role="tab" aria-label={label} title={label}') && managementFeature.includes('onClick={() => setSubTab(id)}'), '16.0.200 exposes Back Office nested tab labels to release-gate coverage');
assert(scheduleFeature.includes('aria-label={label} title={label} onClick={() => setActiveTool(id)}'), '16.0.200 exposes Schedule Builder nested tool labels to release-gate coverage');


assert(inventoryFeature.includes('const [parDrafts, setParDrafts] = useState({});') && inventoryFeature.includes('const [pendingQtyDrafts, setPendingQtyDrafts] = useState({});'), '16.0.200 keeps decimal inventory edits in local draft state while Firestore snapshots catch up');
assert(inventoryFeature.includes('const parseInventoryQuantity = (value, fallback = 0) =>') && inventoryFeature.includes('Number.parseFloat(cleaned)'), '16.0.200 uses a decimal-safe inventory quantity parser');
assert(inventoryFeature.includes('step="0.01" inputMode="decimal" aria-label={`Inventory par for') && inventoryFeature.includes('value={Object.prototype.hasOwnProperty.call(parDrafts, item.id)'), '16.0.200 makes inventory PAR inputs decimal-safe, locally controlled, and accessible');
assert(inventoryFeature.includes('step="0.01" inputMode="decimal" aria-label={`Order quantity for') && inventoryFeature.includes('parseInventoryQuantity(e.target.value, 0)'), '16.0.200 order quantity inputs accept decimal probe values instead of truncating them');
assert(inventoryFeature.includes('setPendingQtyDrafts') && inventoryFeature.includes('label: "Pending quantity", data: { pendingQty: parsed }'), '16.0.200 pending delivery quantity input uses the same decimal-safe path');
assert(!inventoryFeature.includes('setOrderOverrides(p=>({...p, [item.id]: parseInt(e.target.value)||0}))'), '16.0.200 removed parseInt truncation from order quantity controls');
assert(scheduleFeature.includes("'trade-board'") && scheduleFeature.includes("tab === 'trade-board' ? 'Trade Board'"), '16.0.200 exposes Trade Board in the persistent schedule subtab navigation');
assert(scheduleFeature.includes("openCopilotTool('template-editor')") && scheduleFeature.includes("openCopilotTool('drag')"), '16.0.200 exposes Create Template and Drag Board from the Schedule Copilot launcher');
assert(prepFeature.includes("const stateLabel = tab === 'prep' ? 'prep'") && prepFeature.includes('aria-label={stateLabel}'), '16.0.200 keeps Prep reachable by the declared /^prep$/ nested-state label');
assert(managementFeature.includes('flex flex-wrap gap-2 pb-2 border-b border-[#2A353D]') && managementFeature.includes('["quickbooks","QuickBooks"]'), '16.0.200 keeps QuickBooks visible in wrapped Back Office nested navigation');


const exhaustiveMatrix = read('tests/86chaos-release-gate/exhaustive-surface-matrix.cjs');
const currentFailedOnlyFallback = read('scripts/86chaos-release-gate/reported-failed-only-20260825-230842.json');
assert(exhaustiveHelper.includes("else if (type === 'color') sample = '#123456';"), '16.0.200 probes color inputs with a legal six-digit hex value');
assert(!/byLabel\.or\(/.test(exhaustiveHelper), '16.0.200 form descriptors do not use ambiguous byLabel.or(selector).first resolution');
assert(exhaustiveHelper.includes('structuralKey') && exhaustiveHelper.includes('selectorOrdinal') && exhaustiveHelper.includes('.nth(Number(row.selectorOrdinal || 0))'), '16.0.200 resolves form controls by deterministic structural descriptor and ordinal');
assert(exhaustiveHelper.includes("const STATE_INTERACTIVE_SELECTOR = 'button, a, [role=\"button\"], [role=\"tab\"], [role=\"menuitem\"]';"), '16.0.200 discovers state controls before Playwright visible geometry filtering');
assert(!/rect\.width > 0 && rect\.height > 0 && style\.visibility !== 'hidden' && style\.display !== 'none'/.test(exhaustiveHelper), '16.0.200 state control discovery no longer rejects candidates solely for zero current geometry');
assert(exhaustiveHelper.includes("el.hidden || el.getAttribute('aria-hidden') === 'true'") && exhaustiveHelper.includes("style.visibility === 'hidden' || style.display === 'none'"), '16.0.200 still rejects genuinely hidden state controls');
const alreadyVisibleSource = exhaustiveHelper.slice(exhaustiveHelper.indexOf('async function stateLabelAlreadyVisible'), exhaustiveHelper.indexOf('async function applyStatePath'));
assert(!alreadyVisibleSource.includes('bodyText(') && !alreadyVisibleSource.includes('\\b(?:Open\\s+)?'), '16.0.200 active-state evidence no longer comes from arbitrary body prose');
assert(alreadyVisibleSource.includes('aria-selected') && alreadyVisibleSource.includes('aria-current') && alreadyVisibleSource.includes('h1, h2, h3, h4, h5, h6'), '16.0.200 active-state evidence remains structural');
assert(exhaustiveMatrix.indexOf("['Schedule Builder', 'Open Copilot Tools']") > exhaustiveMatrix.indexOf("['Schedule Builder'],") && exhaustiveMatrix.indexOf("['Schedule Builder', 'Open Copilot Tools']") < exhaustiveMatrix.indexOf("['Schedule Builder', 'Coverage']"), '16.0.200 tests Open Copilot Tools before Copilot-opening Schedule Builder states');
for (const required of ["['Schedule Builder', 'Coverage']", "['Schedule Builder', 'Templates']", "['Schedule Builder', /Create Template|Edit Template/i]", "['Schedule Builder', 'Drag Board']", "['Schedule Builder', 'Warnings']", "['Schedule Builder', 'Edit Presets']", "['Schedule Builder', 'Auto-Fill']", "['Schedule Builder', /^Event$/i]"]) {
  assert(exhaustiveMatrix.includes(required), `16.0.200 keeps Schedule Builder state in matrix: ${required}`);
}
assert(exhaustiveMatrix.includes("['QuickBooks']"), '16.0.200 keeps QuickBooks declared in Back Office route states');
assert(managementFeature.includes('["quickbooks","QuickBooks"]') && managementFeature.includes('aria-label={label}'), '16.0.200 keeps the real accessible QuickBooks Back Office navigation button');
assert(prepFeature.includes('maintenance-record-action-button w-9 h-9') && (prepFeature.match(/maintenance-record-action-button w-9 h-9/g) || []).length >= 2, '16.0.200 applies existing PM mobile tap-target class to Preventative Maintenance edit/delete controls');
assert(read('src/styles.css').includes('width: 42px !important;') && read('src/styles.css').includes('@media (min-width: 640px)') && read('src/styles.css').includes('width: 32px !important;'), '16.0.200 preserves existing mobile 42px and desktop compact maintenance action sizing');
assert(currentFailedOnlyFallback.includes('2026-08-25T23-08-42') && currentFailedOnlyFallback.includes('"totalSelected": 5') && currentFailedOnlyFallback.includes('"desktopSelected": 3') && currentFailedOnlyFallback.includes('"mobileSelected": 2'), '16.0.200 bundles the authoritative five-failure failed-only fallback');
assert(read('scripts/86chaos-release-gate/prepare-failed-only-manifest.cjs').includes('reported-failed-only-20260825-230842.json'), '16.0.200 failed-only fallback plumbing prefers the latest five-failure evidence');
assert(sinceRunner.includes('api/failed-only-browser-gate-16-0-200.test.cjs'), 'targeted runner includes the 16.0.200 failed-only browser gate regression');


const runnerPs1 = read('RUN_86CHAOS_FAILED_AND_NEW_RELEASE_GATE.ps1');
assert(scheduleFeature.includes('schedule-copilot-compact') && scheduleFeature.includes('aria-label="Open Copilot Tools"') && scheduleFeature.includes('data-chaos-current-state="true"'), '16.0.200 exposes already-open Schedule Copilot as structural current-state evidence for Open Copilot Tools');
assert(scheduleFeature.includes('aria-selected={activeTool===id}') && scheduleFeature.includes("data-chaos-current-state={activeTool===id ? 'true' : undefined}"), '16.0.200 marks active Schedule Copilot nested tool buttons structurally');
assert(managementFeature.includes('role="tab" aria-label={label} title={label} aria-selected={subTab === id}') && managementFeature.includes("data-chaos-current-state={subTab === id ? 'true' : undefined}"), '16.0.200 marks active Back Office nested tabs structurally');
assert(exhaustiveHelper.includes('const cssString =') && exhaustiveHelper.includes('const exactSelector = [') && exhaustiveHelper.includes('button[aria-label="${cssString(raw)}"]'), '16.0.200 resolves exact aria/title state controls before role fallback');
assert(runnerPs1.includes('function Resolve-ReleaseTargets') && runnerPs1.includes('Read-PackageVersion') && runnerPs1.includes('canonical testing Preview URL'), '16.0.200 runner auto-resolves stale process/.env release target conflicts');
assert(!runnerPs1.includes('Assert-NoReleaseTargetConflicts $EnvTestLocal $EnvLocal'), '16.0.200 runner no longer aborts before browsers for resolvable stale target conflicts');
assert(sinceRunner.includes('api/failed-only-browser-gate-16-0-200.test.cjs'), 'targeted runner includes the 16.0.200 failed-only browser gate regression');

if (failures) {
  console.error(`16.0.200 source validation failed with ${failures} failure(s).`);
  process.exit(1);
}
console.log('16.0.200 source validation passed.');
