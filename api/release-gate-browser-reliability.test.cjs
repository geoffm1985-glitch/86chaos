const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('operations intelligence listener is empty-safe and tenant constrained without a direct missing-document read', () => {
  const source = read('src/features/operations.jsx');
  assert.doesNotMatch(source, /useLiveCollectionState\('opsIntelligenceReports'/);
  assert.match(source, /useLiveCollection\('opsIntelligenceReports'/);
  assert.match(source, /live:\s*false/);
  assert.match(source, /debugLabel:\s*'today:current-ops-intelligence:snapshot-latest'/);
  assert.match(source, /canUsePythonIntelligence/);
  assert.doesNotMatch(source, /useLiveDocument\('opsIntelligenceReports'/);
});

test('personal reminders use one canonical participant-scoped API reader without legacy listeners', () => {
  const source = read('src/core/personalReminderQueries.js');
  const api = read('api/personal-reminder-list.js');
  assert.match(source, /\['participantSchemaVersion',\s*'==',\s*1\]/);
  assert.match(source, /\['participantUserIds',\s*'array-contains',\s*safeUid\]/);
  assert.match(source, /\/api\/personal-reminder-list/);
  assert.match(source, /requestPersonalReminderRefresh/);
  assert.match(source, /__getPersonalReminderReaderDiagnostics/);
  assert.doesNotMatch(source, /useLiveCollection\('personalReminders'/);
  assert.doesNotMatch(source, /legacy-user-id|legacy-assigned-to|legacy-created-by/);
  assert.match(api, /where\('participantSchemaVersion',\s*'==',\s*1\)/);
  assert.match(api, /where\('participantUserIds',\s*'array-contains',\s*uid\)/);
  assert.match(api, /verifyIdToken/);
});

test('QA reminder seed preserves canonical participants and separate QA ownership metadata', () => {
  const seed = read('scripts/86chaos-full-audit/seed-fake-restaurant.cjs');
  const api = read('api/full-audit-qa-seed.js');
  assert.match(seed, /participantSchemaVersion:\s*1/);
  assert.match(seed, /participantUserIds/);
  assert.match(seed, /qaCreatedBy:\s*'86chaos-full-audit'/);
  assert.match(api, /createdBy must be a legitimate verified QA role-account UID/);
  assert.match(api, /separate qaCreatedBy\/qaSeedSource ownership marker/);
});

test('staff protected-control evaluator does not call catch on Array.map output', () => {
  const source = read('tests/86chaos-full-audit/02-permission-role-security.spec.cjs');
  assert.match(source, /const collectProtectedControls = async/);
  assert.doesNotMatch(source, /nodes\.map\([^\n]+\)\.catch/);
});

test('86Voice close controls have distinct accessible names and tests do not hide duplicates with first close locator', () => {
  const source = read('src/components/common.jsx');
  const spec = read('tests/86chaos-full-audit/11-mobile-desktop-voice-upload.spec.cjs');
  assert.match(source, /Close 86Voice panel/);
  assert.match(source, /Hide 86Voice assistant/);
  assert.match(spec, /Close 86Voice panel/);
  assert.match(spec, /Hide 86Voice assistant/);
  assert.doesNotMatch(spec, /getByRole\('button',\s*\{ name:\s*\/close 86voice\/i \}\)\.first\(\)/i);
});


test('86Voice lifecycle test measures concurrent active recognition sessions instead of lifetime instances', () => {
  const spec = read('tests/86chaos-full-audit/11-mobile-desktop-voice-upload.spec.cjs');
  assert.match(spec, /maxConcurrentActive/);
  assert.match(spec, /activeIds/);
  assert.match(spec, /duplicate simultaneous recognition sessions/i);
  assert.doesNotMatch(spec, /__voiceRecognitionInstances\.length,\s*1/);
});

test('testing-preview overlay helper is limited to Vercel overlays and does not remove app dialogs', () => {
  const helpers = read('tests/86chaos-full-audit/utils/audit-helpers.cjs');
  const spec = read('tests/86chaos-full-audit/11-mobile-desktop-voice-upload.spec.cjs');
  assert.match(helpers, /neutralizeTestingPreviewOverlays/);
  assert.match(helpers, /vercel-live-feedback/);
  assert.match(helpers, /vercel-toolbar/);
  assert.match(helpers, /pointerEvents\s*=\s*'none'/);
  assert.doesNotMatch(helpers, /chaos-modal-backdrop.*remove/);
  assert.match(spec, /neutralizeTestingPreviewOverlays\(page/);
});


test('86Voice test dismisses legitimate blocking dialogs before interacting with the dock', () => {
  const helpers = read('tests/86chaos-full-audit/utils/audit-helpers.cjs');
  const spec = read('tests/86chaos-full-audit/11-mobile-desktop-voice-upload.spec.cjs');
  assert.match(helpers, /async function dismissBlockingDialogs/);
  assert.match(helpers, /\[role="dialog"\]:visible/);
  assert.match(helpers, /Skip and don\'t show again|Skip and don't show again/);
  assert.match(helpers, /chaos-modal-backdrop/);
  assert.doesNotMatch(helpers, /\.evaluate\(\(\) => document\.querySelector\('\.chaos-modal-backdrop'\)\.remove/);
  assert.match(spec, /dismissBlockingDialogs\(page/);
  assert.match(spec, /voice-modal-dismissal/);
});

test('mobile maintenance action controls keep compact icons with 42px mobile tap targets', () => {
  const source = read('src/features/operations.jsx');
  const styles = read('src/styles.css');
  assert.match(source, /aria-label="Edit maintenance record"/);
  assert.match(source, /aria-label="Delete maintenance record"/);
  assert.match(source, /maintenance-record-action-button/);
  assert.match(styles, /\.maintenance-record-action-button/);
  assert.match(styles, /width:\s*42px/);
  assert.match(styles, /height:\s*42px/);
  assert.match(styles, /min-width:\s*42px/);
  assert.match(styles, /min-height:\s*42px/);
});

test('Audit route owns a named focusable scroll region instead of relying on test-side injection', () => {
  const management = read('src/features/management.jsx');
  const standalone = read('src/components/TabAuditLog.js');
  for (const source of [management, standalone]) {
    assert.match(source, /role="region"/);
    assert.match(source, /aria-label="System audit log entries"/);
    assert.match(source, /tabIndex=\{0\}/);
  }
});

test('chunk recovery writes stable state before automatic navigation and keeps a manual recovery surface', () => {
  const source = read('src/App.js');
  assert.match(source, /writeChunkRecoveryState\(\{\s*stage:\s*'auto-recovery-started'/s);
  assert.match(source, /renderImmediateChunkRecoverySurface/);
  assert.match(source, /autoReloadCount:\s*1/);
  assert.match(source, /manual-recovery-required/);
  assert.match(source, /Recovering app shell/);
});

test('failed-only manifest is generated dynamically from the most recent full run and target-qualified', () => {
  const helper = read('scripts/86chaos-release-gate/failed-only-manifest-utils.cjs');
  const prepare = read('scripts/86chaos-release-gate/prepare-failed-only-manifest.cjs');
  const manifest = read('tests/86chaos-release-gate/failed-only-manifest.cjs');
  assert.match(helper, /findMostRecentCompletedFullRun/);
  assert.match(helper, /findLatestCompletedFailedOnlyDescendant/);
  assert.match(helper, /selectionSource:\s*'latest-compatible-failed-only-result'/);
  assert.match(helper, /generateFailedOnlyManifestFromRun/);
  assert.match(prepare, /targetQualifiedManifest/);
  assert.doesNotMatch(manifest, /const FAILED_ONLY_TESTS = \[/);
});


test('release-gate collector rewrites runner-state from authoritative seed and cleanup artifacts', () => {
  const collector = read('scripts/86chaos-release-gate/collect-release-gate-report.cjs');
  assert.match(collector, /runnerStateReconciled/);
  assert.match(collector, /fs\.writeFileSync\(artifact\['runner-state\.json'\]/);
  assert.match(collector, /seedReportPresent/);
  assert.match(collector, /cleanupReportPresent/);
});
