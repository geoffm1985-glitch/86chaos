'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const exists = file => fs.existsSync(path.join(root, file));

test('17.0.30 makes testing.86chaos.com the canonical testing target without weakening production guards', () => {
  const runner = read('RUN_86CHAOS_FAILED_AND_NEW_RELEASE_GATE.ps1');
  const fullRunner = read('RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1');
  const targets = require('../scripts/86chaos-release-gate/vercel-targets.cjs');
  const safety = require('../scripts/86chaos-release-gate/mutation-safety.cjs');
  assert.match(runner, /\$canonicalPreviewUrl = 'https:\/\/testing\.86chaos\.com\/'/);
  assert.match(fullRunner, /\$CanonicalTestingUrl = 'https:\/\/testing\.86chaos\.com'/);
  assert.match(fullRunner, /\$env:APP_URL = \$CanonicalTestingUrl/);
  assert.match(fullRunner, /\$env:CHAOS_BASE_URL = \$CanonicalTestingUrl/);
  assert.equal(targets.TESTING_HOST, 'testing.86chaos.com');
  assert.equal(targets.isTestingHost('testing.86chaos.com'), true);
  const accepted = targets.validateReleaseTarget({ appUrl: 'https://testing.86chaos.com', chaosBaseUrl: 'https://testing.86chaos.com/', expectedVersion: '17.0.30', sourceVersion: '17.0.30', deployedVersion: '17.0.30' });
  assert.equal(accepted.ok, true, accepted.errors.join('\n'));
  assert.equal(safety.isProductionHost('testing.86chaos.com'), false);
  assert.equal(safety.isTestingPreviewHost('testing.86chaos.com'), true);
  for (const host of ['86chaos.com', 'www.86chaos.com', 'app.86chaos.com', 'staging.86chaos.com', 'testing-copy.86chaos.com']) assert.equal(safety.isProductionHost(host), true, `${host} must stay production-blocked`);
});

test('17.0.30 browser Firebase routing explicitly locks testing.86chaos.com to the testing project', () => {
  const core = read('src/core/appCore.js');
  assert.match(core, /currentHostname === 'testing\.86chaos\.com'/);
  assert.match(core, /chaos-test-d1601/);
  assert.match(core, /PROD_FIREBASE_HOSTS = \['app\.86chaos\.com', '86chaos\.com', 'www\.86chaos\.com'\]/);
  assert.doesNotMatch(core, /firebase\/database|getDatabase\(|statusSummary|startLowCostPresenceSession|useLowCostPresenceSummary/);
});

test('17.0.30 retires presence listeners, APIs, rules, and online/last-seen UI end to end', () => {
  for (const file of ['api/_presence-diagnostics.cjs','api/presence-heartbeat.js','api/presence-snapshot.js','api/presence-workspace-summary.js']) assert.equal(exists(file), false, `${file} must be removed`);
  const app = read('src/App.js');
  const management = read('src/features/management.jsx');
  const legacyTeam = read('src/components/TabTeam.js');
  const legacyGodMode = read('src/components/TabGodMode.js');
  const trainingManual = read('src/features/trainingManual.js');
  const safeRows = read('api/system-admin-safe-rows.cjs');
  const firestore = read('firestore.rules');
  const rtdb = JSON.parse(read('database.rules.json'));
  const retention = read('functions/src/retention.ts') + '\n' + read('functions/lib/retention.js');
  for (const source of [app, management, legacyTeam, legacyGodMode, trainingManual]) {
    assert.doesNotMatch(source, /presence-workspace-summary|presence-snapshot|presence-heartbeat|startLowCostPresenceSession|useLowCostPresenceSummary|Online \/ Last Seen|Last online|Online now|Recently Active|Presence Snapshot/i);
  }
  assert.doesNotMatch(safeRows, /lastOnline\s*:|lastSeen\s*:|activeHost\s*:|activeTab\s*:|lastActive\s*:/);
  assert.doesNotMatch(firestore, /presenceSessions|livePresence|presenceSessionKeys|livePresenceWriteIsSafe/);
  assert.deepEqual(rtdb, { rules: { '.read': false, '.write': false } });
  assert.doesNotMatch(retention, /presenceSessions|livePresence/);
  assert.doesNotMatch(read('api/health-checks.js'), /presence-heartbeat|presence-snapshot|presence-workspace-summary/);
  assert.doesNotMatch(read('api/_firebase-project-admin.js'), /databaseURL|getDatabaseUrlForProject/);
  assert.doesNotMatch(management, /selectedClientOnline|online users|online count|last heartbeat/i);
});

test('17.0.30 gives only the testing PWA the installed name 86chaos testing', () => {
  const production = JSON.parse(read('public/manifest.json'));
  const testing = JSON.parse(read('public/manifest-testing.json'));
  const index = read('public/index.html');
  assert.equal(production.name, '86 Chaos');
  assert.equal(production.short_name, '86 Chaos');
  assert.equal(production.id, '/86-chaos-pwa');
  assert.equal(testing.name, '86chaos testing');
  assert.equal(testing.short_name, '86chaos testing');
  assert.equal(testing.id, '/86-chaos-testing-pwa');
  assert.match(index, /window\.location\.hostname === 'testing\.86chaos\.com'/);
  assert.match(index, /id="app-manifest"[^>]+href="%PUBLIC_URL%\/manifest\.json"/);
  assert.match(index, /manifest\.setAttribute\('href', '\/manifest-testing\.json'\)/);
  assert.match(index, /apple-mobile-web-app-title/);
  assert.match(index, /86chaos testing/);
});

test('17.0.30 retires only the passed delta-baseline regression, not the delta workflow', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(exists('api/release-gate-delta-clean-baseline-17-0-25.test.cjs'), false);
  assert.equal(pkg.scripts['test:delta-clean-baseline'], undefined);
  assert.doesNotMatch(pkg.scripts['test:current-release-targeted'], /release-gate-delta-clean-baseline-17-0-25/);
  assert.match(pkg.scripts['test:play-store:delta'], /^npm run test:current-release-targeted && powershell /);
});
