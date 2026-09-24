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

assert.equal(pkg.version, '17.1.10');
assert.equal(lock.version, pkg.version);
assert.equal(lock.packages[''].version, pkg.version);
assert.equal(version.version, pkg.version);
assert.equal(version.build, pkg.version);
assert.equal(version.releaseTitle, '86Voice Production 17.0.29 Lifecycle Restoration');
assert.equal(pkg.scripts['test:source'], 'node scripts/validate-17-1-10.js');
assert.equal(pkg.scripts['validate:17.1.10'], 'node scripts/validate-17-1-10.js');
assert(pkg.scripts['test:repair:17.1.10']?.includes('test:current-release-targeted'));
assert(pkg.scripts['test:current-release-targeted']?.includes('api/voice-production-parity-17-1-10.test.cjs'));
assert(!pkg.scripts['test:current-release-targeted']?.includes('api/mobile-voice-resilient-capture-17-1-8.test.cjs'));
assert(pkg.scripts['test:current-release-targeted']?.includes('api/release-gate-microphone-delta-repair-17-1-6.test.cjs'));
assert(pkg.scripts['test:current-release-targeted']?.includes('api/mobile-bottom-nav-single-line-17-1-5.test.cjs'));
assert(pkg.scripts['test:current-release-targeted']?.includes('api/release-gate-browser-stability-17-1-4.test.cjs'));
assert(pkg.scripts['test:current-release-targeted']?.includes('api/release-gate-browser-stability-17-1-4.test.cjs'));
assert(pkg.scripts['test:current-release-targeted']?.includes('api/mobile-workflow-repair-17-1-3.test.cjs'));
assert(pkg.scripts['test:release:fast']?.includes('validate:17.1.10')); 
assert(pkg.scripts['test:current-release-targeted']?.includes('api/app-wide-concept1-complete-migration-17-1-2.test.cjs'));
assert(pkg.scripts['test:current-release-targeted']?.includes('api/app-wide-concept1-deep-migration-17-1-1.test.cjs'));
assert(pkg.scripts['test:current-release-targeted']?.includes('api/app-wide-concept1-redesign-17-1-0.test.cjs'));
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
const conceptCss = read('src/concept17.css');
const conceptShell = read('src/components/concept17.jsx');
const browserI18n = read('src/core/i18n.js');
const nodeI18n = read('src/core/i18n.cjs');
const completeMigrationTest = read('api/app-wide-concept1-complete-migration-17-1-2.test.cjs');
const completeBrowserSpec = read('tests/86chaos-new-implementations/19-concept1-complete-route-subtab-fidelity.spec.cjs');
assert(app.includes('<Concept17RouteFrame'));
assert(conceptShell.includes('export const Concept17RouteFrame'));
assert(conceptShell.includes('const ROUTE_COPY_ES ='));
assert(conceptCss.includes('.concept17-route-heading'));
assert(conceptCss.includes('.concept17-subtab-bar'));
assert(conceptCss.includes('.chaos-modal-panel'));
assert(completeMigrationTest.includes('Time Clock & Schedule the first primary navigation'));
assert(completeBrowserSpec.includes('representative real subtabs retain the Concept 1 frame after navigation'));
assert(app.indexOf("{ id: 'published', label: shellText('drawer.timeClockSchedule'") < app.indexOf("{ id: 'today', label: shellText('drawer.todayHome'"));

const commonBrand = read('src/components/common.jsx');
const deepLayoutSpec = read('tests/86chaos-new-implementations/18-app-wide-deep-route-layout.spec.cjs');
assert(app.includes('concept17-route-page'));
assert(app.includes('data-concept-route={activeTabState}'));
assert(conceptCss.includes('17.1.2 COMPLETE CONCEPT 1 PAGE MIGRATION'));
for (const selector of ['.concept17-route-page .chaos-card', '.concept17-route-page .inventory-subtabs', '.concept17-route-page .settings-tab-bar', '.concept17-route-page table', '.concept17-route-page select']) {
  assert(conceptCss.includes(selector), `deep Concept 1 CSS contains ${selector}`);
}
assert(conceptShell.includes('HelpCircle'));
assert(!conceptShell.includes('CircleHelp'));
assert.equal(pkg.dependencies['lucide-react'], '^0.344.0');
assert(commonBrand.includes('/86chaos-icon-48-v2.png'));
assert(commonBrand.includes('/6139.png'));
assert(commonBrand.includes('86 Chaos branding is always displayed'));
assert(deepLayoutSpec.includes("'inventory'"));
assert(deepLayoutSpec.includes("'schedule'"));
assert(deepLayoutSpec.includes("'financials'"));
assert(deepLayoutSpec.includes("'settings'"));
assert(deepLayoutSpec.includes("'godmode'"));

assert(exists('RELEASE_17_1_1.md'));
assert(exists('api/app-wide-concept1-deep-migration-17-1-1.test.cjs'));
assert(exists('api/app-wide-concept1-redesign-17-1-0.test.cjs'));
assert(exists('tests/86chaos-new-implementations/17-app-wide-concept1-layout.spec.cjs'));
assert(exists('tests/86chaos-new-implementations/18-app-wide-deep-route-layout.spec.cjs'));
assert(read('src/index.js').includes('import "./concept17.css";'));
assert(app.includes('concept17-shell desktop-pro-shell'));
assert(app.includes('<Concept17Sidebar'));
assert(app.includes('<Concept17MobileNav'));
assert(app.includes('data-testid="concept17-command-header"'));
assert(conceptShell.includes('data-testid="concept17-desktop-sidebar"'));
assert(conceptShell.includes('data-testid="concept17-mobile-bottom-nav"'));
assert(conceptCss.includes('--c17-sidebar-width: 224px'));
assert(conceptCss.includes('@media (min-width: 1180px)'));
assert(conceptCss.includes('@media (max-width: 767px)'));
assert(conceptCss.includes('.concept17-shell .chaos-card'));
assert(!/Orders\s*&\s*Tickets/i.test(`${app}
${conceptShell}`));
for (const key of ['shell.home','shell.kitchen','shell.prep','shell.inventory','shell.schedule','shell.staff','shell.more','shell.searchAria','shell.searchPlaceholder','shell.switchWorkspace','shell.openProfileMenu']) {
  assert(browserI18n.includes(`'${key}':`), `browser i18n contains ${key}`);
  assert(nodeI18n.includes(`'${key}':`), `Node i18n contains ${key}`);
}

assert(appCore.includes("currentHostname === 'testing.86chaos.com'"));
assert(!/firebase\/database|getDatabase\(|startLowCostPresenceSession|useLowCostPresenceSummary|statusSummary/.test(appCore));
assert(failedNewRunner.includes("$canonicalPreviewUrl = 'https://testing.86chaos.com/'"));
assert(fullRunner.includes("$CanonicalTestingUrl = 'https://testing.86chaos.com'"));
assert(fullRunner.includes('$env:APP_URL = $CanonicalTestingUrl'));
assert(fullRunner.includes('$env:CHAOS_BASE_URL = $CanonicalTestingUrl'));
assert(targets.includes("const TESTING_HOST = 'testing.86chaos.com'"));
assert(mutationSafety.includes("const CANONICAL_TESTING_HOST = 'testing.86chaos.com'"));
assert(mutationSafety.includes("clean !== CANONICAL_TESTING_HOST"), 'only canonical testing domain is carved out from the 86chaos.com production-domain guard');
assert(scope.includes("const CURRENT_RELEASE_VERSION = '17.1.10'"));
assert(scope.includes('25-mobile-voice-production-parity.spec.cjs'));
assert(scope.includes('20-mobile-workflow-repair.spec.cjs'));
assert(scope.includes('19-concept1-complete-route-subtab-fidelity.spec.cjs'));
assert(scope.includes('18-app-wide-deep-route-layout.spec.cjs'));
assert(scope.includes('17-app-wide-concept1-layout.spec.cjs'));
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
assert(management.includes('admin37-featured-test-frame'));
assert(read('tests/86chaos-new-implementations/14-system-admin-complete-directory-desktop.spec.cjs').includes('toHaveCount(21'));
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
assert(management.includes("const directoryAdminTabs = adminTabs.filter(tab => tab.id !== 'overview')"));
assert(management.includes('data-admin-shortcut={tab.id}'));
assert.equal((management.match(/data-testid="system-admin-directory-card" data-admin-tab=\{tab\.id\}/g) || []).length, 1);
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
assert(read('tests/86chaos-new-implementations/10-app-bootstrap-i18n-runtime.spec.cjs').includes('expectedVersion'));
assert(!read('tests/86chaos-new-implementations/10-app-bootstrap-i18n-runtime.spec.cjs').includes('Version 17\\.1\\.0'));
assert(read('src/features/schedule.jsx').includes("secureFetch('/api/schedule-shift-assign'"));
assert(read('api/schedule-shift-delete.js').includes("action === 'clear-month'"));
assert(!/permissions\?\.(?:schedule|team|settings)/.test(read('src/core/timeOffPolicy.js')));

for (const file of [
  'src/core/appCore.js','api/_version.js','api/_pos-bridge-config.js',
  'src/core/customerHelpKnowledge.js','src/core/customerHelpKnowledge.cjs','src/core/schedulePdf.js',
]) assert(read(file).includes('17.1.10'), `${file} carries current version 17.1.10`);
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

const repairTest = read('api/mobile-workflow-repair-17-1-3.test.cjs');
assert(repairTest.includes('Schedule Builder pins the day/date row'));
assert(repairTest.includes('Message Board keeps its events listener alive'));
assert(repairTest.includes('puts 86Voice in the first visual slot'));
assert(repairTest.includes('Kitchen Command Center owns the localized full-date formatter'));
assert(exists('RELEASE_17_1_3.md'));

const navLabelRepair = read('api/mobile-bottom-nav-single-line-17-1-5.test.cjs');
assert(navLabelRepair.includes('mobile bottom toolbar labels are explicitly single-line'));
assert(conceptShell.includes('className="concept17-mobile-nav-label"'));
assert(conceptCss.includes('17.1.5 mobile bottom-nav single-line label repair'));
assert(conceptCss.includes('white-space: nowrap !important'));
assert(conceptCss.includes('font-size: 7px !important'));
assert(exists('tests/86chaos-new-implementations/21-mobile-bottom-nav-single-line.spec.cjs'));
assert(exists('RELEASE_17_1_5.md'));

const browserRepair = read('api/release-gate-browser-stability-17-1-4.test.cjs');
assert(browserRepair.includes('Schedule Builder control deck no longer overlays the editable grid'));
assert(browserRepair.includes('locale-independent route and subtab identities'));
assert(browserRepair.includes('deployed version assertion follows package.json'));
assert(browserRepair.includes('86Voice shares the narrow-phone bottom-nav baseline'));
assert(browserRepair.includes('long route sweeps use evidence-based timeout budgets'));
assert(read('src/components/common.jsx').includes('data-shell-route={tab.id}'));
assert(read('src/features/schedule.jsx').includes('data-concept-subtab-button={tab}'));
assert(read('src/features/management.jsx').includes('data-concept-subtab-button={tab.id}'));
assert(read('src/features/management.jsx').includes('data-concept-subtab-button={`labor-${id}`}'));
assert(conceptCss.includes('17.1.4 release-gate browser stability repair'));
assert(conceptCss.includes('bottom: max(5px, env(safe-area-inset-bottom, 0px)) !important'));
assert(exists('RELEASE_17_1_4.md'));

const deltaRepair = read('api/release-gate-microphone-delta-repair-17-1-6.test.cjs');
const voiceCommon = read('src/components/common.jsx');
const spanishSpec = read('tests/86chaos-new-implementations/08-phase1-spanish-interface.spec.cjs');
const scheduleAssignSpec = read('tests/86chaos-new-implementations/09-schedule-builder-shift-assignment.spec.cjs');
assert(deltaRepair.includes('restored production 17.0.29 microphone lifecycle'));
assert(voiceCommon.includes('window.SpeechRecognition || window.webkitSpeechRecognition'));
assert(voiceCommon.includes('pendingVoiceStartTimerRef.current = setTimeout'));
assert(voiceCommon.includes('startListening({ autoStart: true })'));
assert(voiceCommon.includes('const rec = new SpeechRecognition()'));
assert(voiceCommon.includes('rec.start()'));
assert(!voiceCommon.includes('new window.MediaRecorder'));
assert(!voiceCommon.includes('startRecordedVoice'));
assert(!voiceCommon.includes("mode:'transcribe'"));
assert(spanishSpec.includes('[data-route-frame="today"]:visible'));
assert(spanishSpec.includes('[data-shell-route="today"]:visible'));
assert(scheduleAssignSpec.includes('cells.evaluateAll'));
assert(!scheduleAssignSpec.includes('document.elementFromPoint'));
assert(conceptCss.includes('17.1.6 release-gate + microphone repair'));
assert(exists('tests/86chaos-new-implementations/22-release-gate-mic-delta-repair.spec.cjs'));
assert(exists('RELEASE_17_1_6.md'));

const voice1717 = read('api/mobile-voice-toolbar-interaction-17-1-7.test.cjs');
const voice1717Browser = read('tests/86chaos-new-implementations/23-mobile-voice-toolbar-interaction.spec.cjs');
assert(voice1717.includes('real first bottom-nav button'));
assert(voice1717.includes('proven production Web Speech controller'));
assert(voice1717Browser.includes('concept17-mobile-voice-button'));
assert(read('src/App.js').includes('voiceCommandDockRef'));
assert(read('src/components/common.jsx').includes('openAndListen: openDockAndListen'));
assert(read('src/components/common.jsx').includes('openPanel: openDock'));
assert(read('src/components/concept17.jsx').includes('data-testid="concept17-mobile-voice-button"'));
assert(!read('src/components/concept17.jsx').includes('concept17-mobile-nav-voice-slot'));

// 17.1.8/17.1.9 server-transcription code may remain dormant for compatibility,
// but it is no longer the active browser microphone path.
assert(exists('api/voice-command-transcription-17-1-8.test.cjs'));
assert(exists('api/voice-command-transcription-model-17-1-9.test.cjs'));
assert(exists('RELEASE_17_1_8.md'));
assert(exists('RELEASE_17_1_9.md'));

const voice17110 = read('api/voice-production-parity-17-1-10.test.cjs');
const voice17110Browser = read('tests/86chaos-new-implementations/25-mobile-voice-production-parity.spec.cjs');
const app17110 = read('src/App.js');
assert(voice17110.includes('deployed 17.0.29 Web Speech microphone lifecycle'));
assert(voice17110.includes('removes the experimental recorder/provider path'));
assert(voice17110Browser.includes('production Web Speech lifecycle inside the new UI'));
assert(app17110.includes('controller?.openPanel'));
assert(app17110.includes('chaos:voice-open-panel'));
const openDock17110Start = voiceCommon.indexOf('const openDock = () => {');
const openDock17110End = voiceCommon.indexOf('const openDockAndListen', openDock17110Start);
assert(openDock17110Start >= 0 && openDock17110End > openDock17110Start);
const openDock17110 = voiceCommon.slice(openDock17110Start, openDock17110End);
assert(openDock17110.includes('setOpen(true)'));
assert(openDock17110.includes('pendingVoiceStartTimerRef.current = setTimeout'));
assert(openDock17110.includes('startListening({ autoStart: true })'));
assert(openDock17110.includes('}, 80)'));
assert(voiceCommon.includes('data-testid="voice-command-panel"'));
assert(voiceCommon.includes('data-testid="voice-command-status"'));
assert(voiceCommon.includes('data-testid="voice-command-error"'));
assert(exists('RELEASE_17_1_10.md'));

console.log('17.1.10 86Voice Production 17.0.29 Lifecycle Restoration validation passed; this does not certify the release.');
