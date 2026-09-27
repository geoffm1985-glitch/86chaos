#!/usr/bin/env node
'use strict';
<<<<<<< HEAD

const fs = require('fs');
const assert = require('assert');
const path = require('path');
const { captureSourceIdentity, hash } = require('./86chaos-release-gate/source-identity.cjs');

=======
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
>>>>>>> 1fb9648590016d97432aa4c21a1d5758ab3b8992
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const exists = file => fs.existsSync(path.join(root, file));
<<<<<<< HEAD
const pkg = json('package.json');
const lock = json('package-lock.json');
const version = json('public/version.json');

assert.equal(pkg.version, '17.0.31');
assert.equal(lock.version, pkg.version);
assert.equal(lock.packages[''].version, pkg.version);
assert.equal(version.version, pkg.version);
assert.equal(version.build, pkg.version);
assert.equal(version.releaseTitle, 'System Administrator Refresh and Spanish Phase 2');
assert.equal(pkg.scripts['test:source'], 'node scripts/validate-17-0-31.js');
assert.equal(pkg.scripts['validate:17.0.31'], 'node scripts/validate-17-0-31.js');
assert(pkg.scripts['test:repair:17.0.31']?.includes('test:current-release-targeted'));
assert(pkg.scripts['test:current-release-targeted']?.includes('api/system-admin-refresh-spanish-phase2-17-0-31.test.cjs'));
assert(pkg.scripts['test:current-release-targeted']?.includes('api/presence-retirement-testing-domain-17-0-30.test.cjs'));
assert(!pkg.scripts['test:current-release-targeted']?.includes('release-gate-delta-clean-baseline-17-0-25'));
assert.equal(pkg.scripts['test:delta-clean-baseline'], undefined);
assert(pkg.scripts['test:play-store:delta']?.startsWith('npm run test:current-release-targeted &&'));
assert(pkg.scripts['test:release:fast']?.includes('validate:17.0.31'));
assert.equal(exists('api/release-gate-delta-clean-baseline-17-0-25.test.cjs'), false);

const appCore = read('src/core/appCore.js');
const app = read('src/App.js');
const management = read('src/features/management.jsx');
const legacyTeam = read('src/components/TabTeam.js');
const legacyGodMode = read('src/components/TabGodMode.js');
const trainingManual = read('src/features/trainingManual.js');
const targets = read('scripts/86chaos-release-gate/vercel-targets.cjs');
const mutationSafety = read('scripts/86chaos-release-gate/mutation-safety.cjs');
const failedNewRunner = read('RUN_86CHAOS_FAILED_AND_NEW_RELEASE_GATE.ps1');
const fullRunner = read('RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1');
const scope = read('scripts/86chaos-release-gate/current-release-repair-scope.cjs');
const indexHtml = read('public/index.html');
const productionManifest = json('public/manifest.json');
const testingManifest = json('public/manifest-testing.json');

assert(appCore.includes("currentHostname === 'testing.86chaos.com'"));
assert(!/firebase\/database|getDatabase\(|startLowCostPresenceSession|useLowCostPresenceSummary|statusSummary/.test(appCore));
assert(failedNewRunner.includes("$canonicalPreviewUrl = 'https://testing.86chaos.com/'"));
assert(fullRunner.includes("$CanonicalTestingUrl = 'https://testing.86chaos.com'"));
assert(fullRunner.includes('$env:APP_URL = $CanonicalTestingUrl'));
assert(fullRunner.includes('$env:CHAOS_BASE_URL = $CanonicalTestingUrl'));
assert(targets.includes("const TESTING_HOST = 'testing.86chaos.com'"));
assert(mutationSafety.includes("const CANONICAL_TESTING_HOST = 'testing.86chaos.com'"));
assert(mutationSafety.includes("clean !== CANONICAL_TESTING_HOST"), 'only canonical testing domain is carved out from the 86chaos.com production-domain guard');
assert(scope.includes("const CURRENT_RELEASE_VERSION = '17.0.31'"));
assert(scope.includes('10-presence-system-admin.spec.cjs'));
assert(scope.includes('08-phase1-spanish-interface.spec.cjs'));
assert(scope.includes('09-schedule-builder-shift-assignment.spec.cjs'));
assert(scope.includes('10-app-bootstrap-i18n-runtime.spec.cjs'));
assert(legacyGodMode.includes('system-admin-concept1-shell'));
assert(legacyGodMode.includes("t('admin.title'"));
assert(legacyGodMode.includes('data-testid="system-admin-hero"'));
assert(legacyGodMode.includes('data-testid="system-admin-nav-card"'));
assert(targets.includes('Testing target is stale.'));
assert(targets.includes('testing.86chaos.com'));
assert(read('src/core/i18n.js').includes("'admin.title': 'Administrador del sistema'"));
assert(read('src/core/i18n.cjs').includes("'admin.section.metrics': 'Métricas'"));

for (const file of ['api/_presence-diagnostics.cjs','api/presence-heartbeat.js','api/presence-snapshot.js','api/presence-workspace-summary.js']) {
  assert.equal(exists(file), false, `${file} is retired`);
}
for (const source of [app, management, legacyTeam, legacyGodMode, trainingManual]) {
  assert(!/presence-workspace-summary|presence-snapshot|presence-heartbeat|startLowCostPresenceSession|useLowCostPresenceSummary|Online \/ Last Seen|Last online|Online now|Recently Active|Presence Snapshot/i.test(source));
}
assert(!/presenceSessions|livePresence|presenceSessionKeys|livePresenceWriteIsSafe/.test(read('firestore.rules')));
assert.deepEqual(json('database.rules.json'), { rules: { '.read': false, '.write': false } });
assert(!/presenceSessions|livePresence/.test(read('functions/src/retention.ts')));
assert(!/presenceSessions|livePresence/.test(read('functions/lib/retention.js')));
assert(!/presence-heartbeat|presence-snapshot|presence-workspace-summary/.test(read('api/health-checks.js')));
assert(!/databaseURL|getDatabaseUrlForProject/.test(read('api/_firebase-project-admin.js')));
assert(!/lastOnline\s*:|lastSeen\s*:|activeHost\s*:|activeTab\s*:|lastActive\s*:/.test(read('api/system-admin-safe-rows.cjs')));
assert(!/selectedClientOnline|online users|online count|last heartbeat/i.test(management));

assert.equal(productionManifest.name, '86 Chaos');
assert.equal(productionManifest.short_name, '86 Chaos');
assert.equal(productionManifest.id, '/86-chaos-pwa');
assert.equal(testingManifest.name, '86chaos testing');
assert.equal(testingManifest.short_name, '86chaos testing');
assert.equal(testingManifest.id, '/86-chaos-testing-pwa');
assert(indexHtml.includes("window.location.hostname === 'testing.86chaos.com'"));
assert(indexHtml.includes('id="app-manifest"') && indexHtml.includes('href="%PUBLIC_URL%/manifest.json"'));
assert(indexHtml.includes("manifest.setAttribute('href', '/manifest-testing.json')"));

// Preserve the immediately preceding repairs.
assert(read('tests/86chaos-new-implementations/08-phase1-spanish-interface.spec.cjs').includes("locator('button.settings-tab-button').filter({ hasText: /^Preferencias$/i })"));
assert(read('tests/86chaos-new-implementations/10-app-bootstrap-i18n-runtime.spec.cjs').includes('Version 17\\.0\\.31'));
assert(read('src/features/schedule.jsx').includes("secureFetch('/api/schedule-shift-assign'"));
assert(read('api/schedule-shift-delete.js').includes("action === 'clear-month'"));
assert(!/permissions\?\.(?:schedule|team|settings)/.test(read('src/core/timeOffPolicy.js')));

for (const file of [
  'src/core/appCore.js','api/_version.js','api/_pos-bridge-config.js',
  'src/core/customerHelpKnowledge.js','src/core/customerHelpKnowledge.cjs','src/core/schedulePdf.js',
]) assert(read(file).includes('17.0.31'), `${file} carries current version 17.0.31`);
for (const file of [
  'test-tools/certification/groups.json','test-tools/regressions/registry.json','test-tools/certification/cost-performance-baselines.json',
]) assert.equal(json(file).release, pkg.version, `${file} release identity matches package version`);

const manifestPath = path.join(root, 'release-source-manifest.json');
if (fs.existsSync(manifestPath)) {
  const manifest = json('release-source-manifest.json');
  const identity = captureSourceIdentity(root);
  assert.equal(manifest.sourceHash, identity.sourceHash, 'release source manifest matches current source tree');
  assert.equal(hash(JSON.stringify(manifest.files)), manifest.sourceHash, 'release source manifest self-hash is valid');
  assert.deepEqual(manifest.files, identity.files, 'release source manifest file inventory matches current source tree');
  const buildIdentity = json('public/build-identity.json');
  assert.equal(buildIdentity.version, pkg.version, 'build identity version matches package version');
  assert.equal(buildIdentity.sourceHash, identity.sourceHash, 'build identity source hash matches manifest');
}

console.log('17.0.31 System Administrator Refresh and Spanish Phase 2 validation passed; this does not certify the release.');
=======

const pkg = json('package.json');
const lock = json('package-lock.json');
const version = json('public/version.json');
assert.equal(pkg.version, '17.0.31');
assert.equal(lock.version, '17.0.31');
assert.equal(lock.packages[''].version, '17.0.31');
assert.equal(version.version, '17.0.31');
assert.equal(version.build, '17.0.31');
assert.equal(version.releaseTitle, 'Cross-Platform Source Manifest Parity Repair');
assert.equal(pkg.scripts['test:source'], 'node scripts/validate-17-0-31.js');
assert.equal(pkg.scripts['validate:17.0.31'], 'node scripts/validate-17-0-31.js');
assert(pkg.scripts['test:play-store:delta']?.startsWith('npm run test:current-release-targeted &&'));
assert(pkg.scripts['test:new-implementations']?.startsWith('npm run validate:17.0.31'));

for (const [file, needle] of [
  ['src/core/appCore.js', "CURRENT_VERSION = '17.0.31'"],
  ['api/_version.js', "APP_VERSION = '17.0.31'"],
  ['api/_version.js', "SECURITY_SCHEMA_VERSION = '17.0.31'"],
  ['api/_pos-bridge-config.js', "APP_RELEASE = '17.0.31'"],
  ['src/core/customerHelpKnowledge.js', "CUSTOMER_HELP_VERSION = '17.0.31'"],
  ['src/core/customerHelpKnowledge.cjs', "CUSTOMER_HELP_VERSION = '17.0.31'"],
  ['src/core/schedulePdf.js', '86 Chaos 17.0.31'],
]) assert(read(file).includes(needle), `${file} carries merged release identity`);

// 17.0.29 feature-line preservation.
const app = read('src/App.js');
const schedule = read('src/features/schedule.jsx');
assert(app.includes("from './core/i18n'"));
assert(app.includes('<I18nProvider language={appLanguage}>'));
assert(read('src/core/i18n.js').includes("SUPPORTED_APP_LANGUAGES = Object.freeze(['en', 'es'])"));
assert(schedule.includes("secureFetch('/api/schedule-shift-assign'"));
assert(schedule.includes("secureFetch('/api/schedule-shift-delete'"));
assert(schedule.includes('createSchedulePublishGuard'));
assert(schedule.includes('normalizeTimeOffPolicy'));
assert(schedule.includes('useI18n'));
for (const file of [
  'api/_pos-bridge-route.js','api/_pos-bridge-auth.js','api/schedule-publish.js','api/schedule-shift-delete.js',
  'src/core/schedulePublicationPlan.js','src/core/schedulePublishProgress.js','src/core/timeOffPolicy.js',
]) assert(exists(file), `${file} from the 17.x feature line is retained`);

// 16.0.244 robustness/certification preservation.
const runner = read('RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1');
const mutation = read('scripts/86chaos-release-gate/mutation-safety.cjs');
const targets = read('scripts/86chaos-release-gate/vercel-targets.cjs');
const universe = read('scripts/86chaos-release-gate/release-test-universe.cjs');
assert(runner.includes('Initialize-AutoProvisionRoleAccounts'));
assert(runner.includes('RandomNumberGenerator]::Create()'));
assert(mutation.includes('testing.86chaos.com') && mutation.includes('experimental.86chaos.com'));
assert(targets.includes('APPROVED_NON_PRODUCTION_ALIASES'));
assert(read('src/core/appCore.js').includes("currentHostname === 'testing.86chaos.com'") && read('src/core/appCore.js').includes("currentHostname === 'experimental.86chaos.com'"));
for (const file of [
  'api/native-backup-watchdog-timeout-hardening.test.cjs','api/source-validator-line-ending-safety.test.cjs','api/release-gate-auto-provision-role-env.test.cjs',
  'tests/86chaos-release-gate/37-native-backup-watchdog-hardening.spec.cjs','tests/86chaos-release-gate/38-release-identity-deployment-parity.spec.cjs',
  'tests/86chaos-release-gate/39-testing-alias-mutation-safety.spec.cjs','tests/86chaos-release-gate/40-validator-line-ending-safety.spec.cjs',
  'tests/86chaos-release-gate/41-auto-provision-role-env.spec.cjs','tests/86chaos-release-gate/42-merged-17-0-30-parity.spec.cjs',
]) assert(exists(file), `${file} is retained`);
for (const n of [37,38,39,40,41,42]) assert(universe.includes(`tests/86chaos-release-gate/${n}-`), `release universe includes regression ${n}`);
assert(read('scripts/validate-16-0-231.js').includes("replace(/\\r\\n?/g, '\\n')"), 'source validator hash remains line-ending safe');
assert(read('api/firestore-backup-watchdog.js').includes('DEFAULT_ADMIN_API_TIMEOUT_MS'), 'backup watchdog timeout hardening is retained');

// Combined PDF behavior.
const model = read('src/core/schedulePrintModel.js');
const pdf = read('src/core/schedulePdf.js');
assert(model.includes('formatScheduleTime12Hour'));
assert(model.includes('detailLabel'));
assert(pdf.includes('candidateSizes = [8, 7.5, 7, MIN_FONT_SIZE]'));
assert(pdf.includes('detailCells'));
assert(pdf.includes('detail page'));
assert(pdf.includes('shift.detailLabel'));
assert(!pdf.includes('cannot fit all ${cell.shifts.length} shifts'));

for (const file of ['test-tools/certification/groups.json','test-tools/regressions/registry.json','test-tools/certification/cost-performance-baselines.json']) {
  assert.equal(json(file).release, '17.0.31', `${file} release identity matches`);
}

console.log('17.0.31 Cross-Platform Source Manifest Parity Repair validation passed; this does not certify the release.');
>>>>>>> 1fb9648590016d97432aa4c21a1d5758ab3b8992
