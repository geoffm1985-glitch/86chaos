#!/usr/bin/env node
'use strict';

const fs = require('fs');
const assert = require('assert');
const path = require('path');
const { captureSourceIdentity, hash } = require('./86chaos-release-gate/source-identity.cjs');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const exists = file => fs.existsSync(path.join(root, file));
const pkg = json('package.json');
const lock = json('package-lock.json');
const version = json('public/version.json');

assert.equal(pkg.version, '17.0.38');
assert.equal(lock.version, pkg.version);
assert.equal(lock.packages[''].version, pkg.version);
assert.equal(version.version, pkg.version);
assert.equal(version.build, pkg.version);
assert.equal(version.releaseTitle, 'Desktop System Administrator Full-Width Layout Repair');
assert.equal(pkg.scripts['test:source'], 'node scripts/validate-17-0-38.js');
assert.equal(pkg.scripts['validate:17.0.38'], 'node scripts/validate-17-0-38.js');
assert(pkg.scripts['test:repair:17.0.38']?.includes('test:current-release-targeted'));
assert(pkg.scripts['test:current-release-targeted']?.includes('api/system-admin-desktop-full-width-17-0-38.test.cjs'));
assert(pkg.scripts['test:current-release-targeted']?.includes('api/system-admin-desktop-concept1-isolation-17-0-37.test.cjs'));
assert(pkg.scripts['test:current-release-targeted']?.includes('api/system-admin-complete-directory-desktop-17-0-36.test.cjs'));
assert(pkg.scripts['test:current-release-targeted']?.includes('api/system-admin-subpage-polish-qa-seed-17-0-35.test.cjs'));
assert(pkg.scripts['test:current-release-targeted']?.includes('api/system-admin-subpages-back-navigation-17-0-34.test.cjs'));
assert(pkg.scripts['test:current-release-targeted']?.includes('api/system-admin-concept1-exact-17-0-33.test.cjs'));
assert(pkg.scripts['test:current-release-targeted']?.includes('api/system-admin-live-concept1-17-0-32.test.cjs'));
assert(pkg.scripts['test:current-release-targeted']?.includes('api/system-admin-refresh-spanish-phase2-17-0-31.test.cjs'));
assert(pkg.scripts['test:current-release-targeted']?.includes('api/presence-retirement-testing-domain-17-0-30.test.cjs'));
assert(!pkg.scripts['test:current-release-targeted']?.includes('release-gate-delta-clean-baseline-17-0-25'));
assert.equal(pkg.scripts['test:delta-clean-baseline'], undefined);
assert(pkg.scripts['test:play-store:delta']?.startsWith('npm run test:current-release-targeted &&'));
assert(pkg.scripts['test:release:fast']?.includes('validate:17.0.38'));
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
assert(scope.includes("const CURRENT_RELEASE_VERSION = '17.0.38'"));
assert(scope.includes('16-system-admin-desktop-full-width.spec.cjs'));
assert(scope.includes('15-system-admin-desktop-concept1.spec.cjs'));
assert(scope.includes('14-system-admin-complete-directory-desktop.spec.cjs'));
assert(scope.includes('13-system-admin-subpage-polish.spec.cjs'));
assert(scope.includes('12-system-admin-subpages-back-navigation.spec.cjs'));
assert(scope.includes('11-system-admin-concept1-exact.spec.cjs'));
assert(scope.includes('10-presence-system-admin.spec.cjs'));
assert(scope.includes('08-phase1-spanish-interface.spec.cjs'));
assert(scope.includes('09-schedule-builder-shift-assignment.spec.cjs'));
assert(scope.includes('10-app-bootstrap-i18n-runtime.spec.cjs'));
assert(app.includes("lazyFeature(() => import('./features/management'), 'TabGodMode')"));
assert(management.includes('data-testid="system-admin-concept1-exact-home"'));
assert(management.includes('data-testid="system-admin-complete-directory"'));
assert(management.includes('data-testid="system-admin-featured-card"'));
assert(management.includes('data-testid="system-admin-directory-card"'));
assert(management.includes('data-admin-tab={tab.id}'));
assert(!management.includes('id="system-admin-tool-jump"'));
assert(management.includes('admin-concept1-subpage-location'));
assert(read('src/styles.css').includes('17.0.36 complete System Administrator directory + desktop repair'));
assert(read('src/styles.css').includes('17.0.37 System Administrator desktop Concept 1 isolation and exact-card hierarchy'));
assert(read('src/styles.css').includes('17.0.38 desktop width repair'));
assert(read('src/styles.css').includes('grid-template-columns: minmax(0, 1fr) !important'));
assert(read('src/styles.css').includes('grid-column: 1 / -1 !important'));
assert(management.includes("const featuredAdminTabIds = ['roles', 'push', 'security', 'forensics', 'support', 'deployment', 'history']"));
assert(management.includes('featuredAdminTabs.slice(0, 4)'));
assert(management.includes('featuredAdminTabs.slice(4, 7)'));
assert(management.includes("const additionalAdminTabs = adminTabs.filter(tab => tab.id !== 'overview' && !featuredAdminTabIds.includes(tab.id))"));
assert(!management.includes('What needs your attention?'));
assert(!management.includes('>Quick work<'));
assert(!management.includes('>Priority list<'));
assert(!management.includes('system-admin-live-concept1'));
assert(!management.includes('system-admin-desktop-directory'));
assert(!management.includes('system-admin-mobile-directory'));
assert(read('src/styles.css').includes('17.0.33 System Administrator Concept 1 exact-home rebuild'));
assert(read('src/styles.css').includes('17.0.34 System Administrator Concept 1 subpage unification'));
assert(read('src/styles.css').includes('17.0.35 System Administrator subpage visual rebuild'));
assert(management.includes('admin-concept1-subpage-active'));
assert(management.includes('data-testid="system-admin-concept1-subpage"'));
assert(management.includes('admin-concept1-metric-grid'));
assert(management.includes('admin-concept1-metric-label'));
assert(management.includes('admin-concept1-metric-detail'));
assert(management.includes('const adminTabIcons = {'));
assert(management.includes('ActiveAdminTabIcon'));
assert(management.includes("window.addEventListener('chaos:system-admin-home'"));
assert(management.includes('chaos:system-admin-subtab-changed'));
assert(app.includes('CHAOS_PWA_BACK_EXIT_WINDOW_MS = 2000'));
assert(app.includes('previousAdminSubTab'));
assert(app.includes('Returned to the previous page. Press back again within 2 seconds to exit.'));
assert(app.includes('chaos:system-admin-back-target'));
assert(!app.includes('window.close('));
assert(management.includes("const { t } = useI18n();"));
assert(management.includes('localizedAdminTabGroups'));
assert(failedNewRunner.includes("Source = 'canonical testing branch domain'"));
assert(failedNewRunner.includes('Old .env.test.local or shell values must never drag the gate back to the retired branch alias'));
assert(targets.includes('Testing target is stale.'));
assert(targets.includes('testing.86chaos.com'));
assert(read('api/full-audit-qa-seed.js').includes("require('./_qa-host-safety.cjs')"));
assert(read('api/full-audit-qa-seed.js').includes('isProductionQaHost(host)'));
assert(read('api/_qa-host-safety.cjs').includes("const CANONICAL_TESTING_HOST = 'testing.86chaos.com'"));
assert(read('api/_qa-host-safety.cjs').includes("cleanHost === CANONICAL_TESTING_HOST"));
assert(read('src/core/i18n.js').includes("'admin.title': 'Administrador del sistema'"));
assert(read('src/core/i18n.cjs').includes("'admin.section.metrics': 'Métricas'"));
assert(read('src/core/i18n.cjs').includes("'admin.concept.audit': 'Auditoría / registros'"));

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
assert(read('tests/86chaos-new-implementations/10-app-bootstrap-i18n-runtime.spec.cjs').includes('Version 17\\.0\\.38'));
assert(read('src/features/schedule.jsx').includes("secureFetch('/api/schedule-shift-assign'"));
assert(read('api/schedule-shift-delete.js').includes("action === 'clear-month'"));
assert(!/permissions\?\.(?:schedule|team|settings)/.test(read('src/core/timeOffPolicy.js')));

for (const file of [
  'src/core/appCore.js','api/_version.js','api/_pos-bridge-config.js',
  'src/core/customerHelpKnowledge.js','src/core/customerHelpKnowledge.cjs','src/core/schedulePdf.js',
]) assert(read(file).includes('17.0.38'), `${file} carries current version 17.0.38`);
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

console.log('17.0.38 Desktop System Administrator Full-Width Layout Repair validation passed; this does not certify the release.');
