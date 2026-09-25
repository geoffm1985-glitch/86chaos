#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const exists = file => fs.existsSync(path.join(root, file));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
let failures = 0;
const assert = (condition, message) => condition ? console.log(`OK: ${message}`) : (failures += 1, console.error(`FAIL: ${message}`));

const inherited = childProcess.spawnSync(process.execPath, ['scripts/validate-16-0-233.js'], {
  cwd: root,
  encoding: 'utf8',
  env: {
    ...process.env,
    CHAOS_VALIDATION_VERSION: '16.0.238',
    CHAOS_VALIDATION_RELEASE_TITLE: 'Testing Alias Release-Gate Safety Repair',
    CHAOS_VALIDATION_SCRIPT: 'scripts/validate-16-0-237.js'
  }
});
if (inherited.stdout) process.stdout.write(inherited.stdout);
if (inherited.stderr) process.stderr.write(inherited.stderr);
assert(inherited.status === 0, 'all inherited Schedule Tools, maturity, security, UI and release-evidence invariants pass');

const pkg = json('package.json');
const lock = json('package-lock.json');
const version = json('public/version.json');
const schedule = read('src/features/schedule.jsx');
const delivery = read('src/core/schedulePdfDelivery.js');
const pdf = read('src/core/schedulePdf.js');
const universe = read('scripts/86chaos-release-gate/release-test-universe.cjs');

assert(pkg.version === '16.0.238' && lock.version === '16.0.238' && lock.packages?.['']?.version === '16.0.238', 'package and lock versions are 16.0.238');
assert(version.version === '16.0.238' && version.build === '16.0.238' && version.releaseTitle === 'Testing Alias Release-Gate Safety Repair', 'public version metadata identifies the watchdog and deployment identity repair');
assert(read('api/_version.js').includes("APP_VERSION = '16.0.238'") && read('api/_version.js').includes("SECURITY_SCHEMA_VERSION = '16.0.238'"), 'API reports 16.0.238');
assert(read('src/core/appCore.js').includes("CURRENT_VERSION = '16.0.238'"), 'active client reports 16.0.238');
assert(read('src/core/customerHelpKnowledge.js').includes("CUSTOMER_HELP_VERSION = '16.0.238'") && read('src/core/customerHelpKnowledge.cjs').includes("CUSTOMER_HELP_VERSION = '16.0.238'"), 'customer Help version mirrors remain synchronized');
assert(pkg.scripts['test:source'] === 'node scripts/validate-16-0-237.js' && pkg.scripts['validate:16.0.238'] === 'node scripts/validate-16-0-237.js', '16.0.238 validator is wired');
assert(pkg.scripts['test:schedule-pdf']?.includes('05-mobile-schedule-pdf-delivery.spec.cjs'), 'schedule PDF command includes the real-device regression spec');
assert(pkg.scripts['test:mobile-pdf-delivery']?.includes('05-mobile-schedule-pdf-delivery.spec.cjs') && pkg.scripts['test:mobile-pdf-delivery']?.includes('--project=mobile-chromium'), 'focused mobile PDF delivery command exists');
assert(pkg.scripts['test:new-implementations']?.startsWith('npm run validate:16.0.238'), 'new-implementation command uses the 16.0.238 validator');

assert(schedule.includes('await deliverSchedulePdf(bytes') && !schedule.includes("window.open('about:blank'") && !schedule.includes('viewer.location.replace'), 'active Month Print Calendar awaits the repaired delivery helper without an about:blank handoff');
assert(schedule.includes('The schedule PDF was created but could not be opened or downloaded.'), 'delivery failure is distinguished from PDF-generation failure');
assert(!delivery.includes('about:blank') && !delivery.includes('location.replace') && !delivery.includes('window.print'), 'delivery helper contains no blank-tab navigation or legacy browser print path');
assert(delivery.includes('navigatorObject?.canShare') && delivery.includes('navigatorObject?.share') && delivery.includes("method: 'share'"), 'mobile delivery supports capability-checked native file sharing');
assert(delivery.includes("method: 'download'") && delivery.includes("link.download = filename") && delivery.includes('BLOB_CLEANUP_DELAY_MS = 60000'), 'download fallback uses a real PDF filename and delayed Blob cleanup');
assert(delivery.includes("windowObject.open(url, '_blank')") && !delivery.includes("windowObject.open('about:blank'"), 'desktop viewer opens the generated Blob URL directly');
assert(delivery.includes("'(display-mode: standalone)'") && delivery.includes("'(pointer: coarse)'"), 'installed-PWA/mobile preference uses capability signals');
assert(pdf.includes("await import('pdf-lib')") && pdf.includes('document.addPage([PAGE_WIDTH, PAGE_HEIGHT])') && pdf.includes("document.setProducer('86 Chaos 16.0.235')"), 'certified vector PDF generator remains in place with current producer metadata');
assert(!schedule.includes('window.print()') && !delivery.includes('window.print'), 'direct browser schedule printing has not returned');

assert(exists('tests/86chaos-new-implementations/05-mobile-schedule-pdf-delivery.spec.cjs'), 'real-device mobile PDF regression spec exists');
const regression = read('tests/86chaos-new-implementations/05-mobile-schedule-pdf-delivery.spec.cjs');
assert(regression.includes("not.toBe('about:blank')") && regression.includes("project.name === 'mobile-chromium'") && regression.includes("page.waitForEvent('download')"), 'regression spec protects the about:blank mobile failure with a real download expectation');
assert(universe.includes('86chaos-new-implementations/**/*.spec.cjs'), 'new regression spec remains inside the full release test universe');
assert(exists('tests/86chaos-release-gate/38-release-identity-deployment-parity.spec.cjs'), 'release identity deployment parity release-gate spec exists');
assert(exists('tests/86chaos-release-gate/39-testing-alias-mutation-safety.spec.cjs'), 'testing alias mutation safety Play Store spec exists');
assert(read('scripts/86chaos-release-gate/vercel-targets.cjs').includes("testing.86chaos.com") && read('scripts/86chaos-release-gate/vercel-targets.cjs').includes("experimental.86chaos.com"), 'release target validator recognizes explicit non-production aliases');
assert(read('scripts/86chaos-release-gate/mutation-safety.cjs').includes('APPROVED_NON_PRODUCTION_ALIASES'), 'mutation safety has explicit non-production alias allowlist');
assert(exists('tests/86chaos-new-implementations/07-release-identity-deployment-parity.spec.cjs'), 'release identity deployment parity Play Store spec exists');
assert(universe.includes('tests/86chaos-release-gate/38-release-identity-deployment-parity.spec.cjs'), 'release identity parity spec is release-critical');
assert(read('api/firestore-backup-watchdog.js').includes('DEFAULT_ADMIN_API_TIMEOUT_MS = 8000') && read('api/firestore-backup-watchdog.js').includes('DEFAULT_ADMIN_API_MAX_PAGES = 10'), 'native backup watchdog bounded-work hardening remains present');
assert(exists('src/core/schedulePdfDelivery.test.js') && read('src/core/schedulePdfDelivery.test.js').includes('mobile/coarse-pointer delivery never opens about:blank'), 'unit coverage protects mobile file delivery');

const frozenShift4 = {
  'api/_shift4-authority.js': '3d83994adcc19b080c430391c8a8ad2f4eb46f47b51c591911c16df1eafea98f',
  'api/_shift4-client.js': '99d4ad8e3b36f146bd54c72f64ba58461cb155da64fb4ee1a786912780ba6d1a',
  'api/_shift4-crypto.js': 'e64cbaab5c891443716dff159b4339e0e11157c8d06530262d3f0737ab36cd05',
  'api/_shift4-normalization.js': 'e3f225014ae4e14cb80bbea2101c9725106277ce47b28e6d03641e972e934aae',
  'api/_shift4-route.js': '522dea0431f758d019fbcb970ce8818f93ad27fc022381f883254b42012121ec',
  'api/_shift4-service.js': 'f417cf7e01036fed15e45acc5c7352c3cde69dec2063c04d9927d53eade3203d',
  'api/_shift4-storage.js': 'aa9ec815cbac93148ba3fabfab806a73899f1f632352599a1c37e208a069ab43',
  'api/shift4-callback.js': '51fcff95ad45b22e79a82c384de49b521d21987c951c47d257c8df38ca83ab07',
  'api/shift4-connect.js': 'a7ae63bea767bc1a07561df0507b30a3029eff71064697a545521512ad39ace4',
  'api/shift4-export.js': '8774736e81137221c5a966ece1ab04c8bf2b9b2f7a6921fed86ce2f12b30e27f',
  'api/shift4-locations.js': 'd4a8217b7968c9477e86da46e1bc325ec67ccacf5d6ba8f217f5b07188c15d51',
  'api/shift4-records.js': 'f74006799044da26f2103fc3f5dd300c6cfb19e33dd46e8b34b44c442501c63b',
  'api/shift4-select-location.js': 'c580da2e2ecd813d75d3ff92d75dfebd43d84693ff49fb840b61705a651f75d7',
  'api/shift4-status.js': '9babcac07c5150625586e8a21e9ce7d97305bd5afbb8d5c8e9b3e60e2eaf3b2a',
  'api/shift4-sync.js': 'c0255bf37ff53cb5feab955e305e94aa998ed33e81e5562aa7b4e5f42e68d6dc',
  'api/shift4-test.js': '02c2ed5e281f680cce327b6212c94cddabdd86e00bc5a37acf88974ae34f64f6',
  'src/components/Shift4IntegrationPanel.jsx': 'c4aa65344e1b63e990115871c033c81b79f5135719d24afe121bb256833b18dc'
};
for (const [file, expected] of Object.entries(frozenShift4)) assert(sha(file) === expected, `${file} remains byte-for-byte frozen from certified 16.0.234`);
assert(sha('src/core/schedulePrintModel.js') === 'c5560758d32c3b034c420ffb427b43cf0fd42c43017cbac1bca7ffe1930a5037', 'schedule print data model remains byte-for-byte frozen from certified 16.0.234');
assert(sha('docs/16.0.234-implementation-test-matrix.json') === '862c5038f5fd98671aac87908ef68af3d1a5078fe1cc6fa91b32d285cfbc2147', '16.0.234 Shift4/PDF implementation matrix remains unchanged');

const unchanged = {
  'firestore.rules': '51bfd7d39edd59f680ae41a149c108cec8cd42d00b102d84cb00ee40d90264d9',
  'firestore.indexes.json': 'ee666de303988cd269f7c09fa63678a2deb1cfcaa199cb4f1656dd9bddcc4b4b',
  'storage.rules': '174e7e9a140193ff69ccf0f0d3e5c65b81a9e0fbbd612bff45ce57e7a3a7ce9c',
  'database.rules.json': '152b5cd3f9839f598c9602706d8205b96759296e865d540b52c780900bfba138',
  'firebase.json': 'bd837a11c71750d4da6ccfcb725ca54e78dd76008b525ec54c7fe79a5b8a3ca4',
  'public/firebase-messaging-sw.js': '46c7f5760350721d424ba6db9a3a9127449fbb670a24b04328e71d3a74ed2366',
  'vercel.json': '3a42afbec525fe1abfe52f28d9b973c9494bdaca6edf3b0ed1a43f30c69db276'
};
for (const [file, expected] of Object.entries(unchanged)) assert(sha(file) === expected, `${file} remains byte-for-byte frozen`);

if (failures) { console.error(`16.0.238 source validation failed with ${failures} failure(s).`); process.exit(1); }
console.log('16.0.238 source validation passed.');
