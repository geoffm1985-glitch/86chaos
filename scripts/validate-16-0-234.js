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
  cwd: root, encoding: 'utf8', env: { ...process.env, CHAOS_VALIDATION_VERSION: '16.0.234', CHAOS_VALIDATION_RELEASE_TITLE: 'Shift4 Dine POS Foundation and Reliable Schedule PDF Printing', CHAOS_VALIDATION_SCRIPT: 'scripts/validate-16-0-234.js' }
});
if (inherited.stdout) process.stdout.write(inherited.stdout); if (inherited.stderr) process.stderr.write(inherited.stderr);
assert(inherited.status === 0, 'all inherited 16.0.233 Schedule Tools, maturity, security, UI and release-evidence invariants pass');

const pkg = json('package.json'); const lock = json('package-lock.json'); const version = json('public/version.json');
assert(pkg.version === '16.0.234' && lock.version === '16.0.234' && lock.packages?.['']?.version === '16.0.234', 'package and lock versions are 16.0.234');
assert(version.version === '16.0.234' && version.build === '16.0.234' && version.releaseTitle === 'Shift4 Dine POS Foundation and Reliable Schedule PDF Printing', 'public version metadata identifies the release');
assert(read('api/_version.js').includes("APP_VERSION = '16.0.234'") && read('src/core/appCore.js').includes("CURRENT_VERSION = '16.0.234'"), 'API and active client report 16.0.234');
assert(read('src/core/customerHelpKnowledge.js').includes("CUSTOMER_HELP_VERSION = '16.0.234'") && read('src/core/customerHelpKnowledge.cjs').includes("CUSTOMER_HELP_VERSION = '16.0.234'"), 'customer Help mirrors remain synchronized');
assert(pkg.scripts['test:source'] === 'node scripts/validate-16-0-234.js' && pkg.scripts['validate:16.0.234'] === 'node scripts/validate-16-0-234.js', '16.0.234 validator is wired');
for (const command of ['test:shift4','test:schedule-pdf','test:new-implementations']) assert(Boolean(pkg.scripts[command]), `${command} command exists`);

const apiFiles = ['_shift4-authority.js','_shift4-client.js','_shift4-crypto.js','_shift4-normalization.js','_shift4-route.js','_shift4-service.js','_shift4-storage.js','shift4-connect.js','shift4-callback.js','shift4-status.js','shift4-test.js','shift4-locations.js','shift4-select-location.js','shift4-sync.js','shift4-records.js','shift4-export.js'];
apiFiles.forEach(file => assert(exists(`api/${file}`), `api/${file} exists`));
const authority = read('api/_shift4-authority.js'); const client = read('api/_shift4-client.js'); const cryptoSource = read('api/_shift4-crypto.js'); const normalization = read('api/_shift4-normalization.js'); const storage = read('api/_shift4-storage.js'); const service = read('api/_shift4-service.js');
assert(authority.includes('authorize(req, app, { allowTenantAdmin: true, targetRestaurantId })') && authority.includes('requireAppCheckIfEnforced'), 'Shift4 reuses tenant auth and App Check');
assert(client.includes('conecto-api.shift4payments.com') && client.includes('lighthouse-api.harbortouch.com') && client.includes('/marketplace/v2/lighthouse-token/locations') && client.includes('/marketplace/v2/lighthouse-token/installations') && client.includes('/marketplace/v2/locations') && client.includes('/pos/v2/${encodeURIComponent(locationId)}/tickets') && client.includes('/pos/v2/${encodeURIComponent(locationId)}/menu'), 'Marketplace/Conecto OAuth, installation, locations, tickets and menu endpoints are isolated in the client');
assert(!client.includes('api.shift4.com') && !client.includes('Client GUID') && !client.includes('Auth Token'), 'Payment Platform API authentication is not used');
assert(cryptoSource.includes('aes-256-gcm') && cryptoSource.includes('SHIFT4_TOKEN_ENCRYPTION_KEY') && cryptoSource.includes('setAAD'), 'server token vault uses tenant-bound AES-256-GCM');
assert(service.includes('shift4OauthStates') && service.includes('expiresAtMs') && service.includes('usedAt') && service.includes('browserSecretHash') && service.includes('project_mismatch'), 'OAuth source wiring includes expiry, single use, browser handoff, and Firebase-project binding');
assert(authority.includes('verifyIdToken(token, true)') && authority.includes('canonicalMembershipState') && authority.includes('revalidateShift4Initiator'), 'Shift4 authority source wires revoked-token checking, canonical membership status, and callback revalidation');
assert(service.includes('SHIFT4_DINE_ALLOWED_LOCATION_IDS') && service.includes("status: 'unverified'"), 'Shift4 Dine product support fails closed');
assert(normalization.includes('SCHEMA_VERSION = 3') && normalization.includes("PROVIDER_PRODUCT = 'shift4-dine'") && normalization.includes('AmountCents') && !normalization.includes('ticketPayments'), 'provider-neutral v3 cent-schema source uses an explicit non-payment allowlist');
assert(storage.includes('contentHash') && storage.includes('unchanged') && storage.includes('posSyncScopes') && storage.includes('shift4Credentials'), 'idempotent server-authoritative storage and no-op detection exist');
for (const route of ['shift4-connect.js','shift4-status.js','shift4-test.js','shift4-locations.js','shift4-select-location.js','shift4-sync.js','shift4-records.js','shift4-export.js']) assert(read(`api/${route}`).includes('authorizeShift4'), `${route} authorizes its tenant before work`);

const management = read('src/features/management.jsx'); const panel = read('src/components/Shift4IntegrationPanel.jsx'); const schedule = read('src/features/schedule.jsx'); const pdf = read('src/core/schedulePdf.js');
assert(management.includes('Shift4IntegrationPanel') && panel.includes('Shift4 Dine') && panel.includes('Read-only Shift4 Dine bridge'), 'active Integrations UI registers the real Shift4 Dine provider');
assert(!management.includes('/api/webhooks/pos-sync') && panel.includes('Webhook automation is deferred'), 'fake POS webhook implication is removed and deferral is explicit');
assert(!/SHIFT4_CLIENT_SECRET|SHIFT4_TOKEN_ENCRYPTION_KEY|refreshToken|accessToken/.test(panel), 'React has no Shift4 secret or token material');
assert(schedule.includes('buildMonthSchedulePrintModel') && schedule.includes('generateMonthSchedulePdf') && schedule.includes('Print Calendar (PDF)'), 'active Month Print Calendar uses the PDF path');
assert(!schedule.includes('buildPrintableCalendarHtml') && !schedule.includes('window.print()'), 'fragile direct browser-print path is no longer primary or fallback');
assert(pdf.includes("await import('pdf-lib')") && pdf.includes('document.addPage([PAGE_WIDTH, PAGE_HEIGHT])') && pdf.includes('measureText') && pdf.includes('details.push(cell)'), 'PDF source is lazy, vector-based, Letter landscape, and uses measured dense-content pagination');
assert(pkg.dependencies['pdf-lib'] === '^1.17.1' && pkg.dependencies['@pdf-lib/fontkit'] && !Object.keys(pkg.dependencies).some(name => /jspdf|pdfkit|puppeteer/i.test(name)), 'pdf-lib remains the sole PDF engine; its fontkit companion provides embedded Unicode fonts');

const suiteFiles = ['01-shift4-connection.spec.cjs','02-shift4-import-review-export.spec.cjs','03-shift4-security-boundary.spec.cjs','04-schedule-pdf-print.spec.cjs'];
suiteFiles.forEach(file => assert(exists(`tests/86chaos-new-implementations/${file}`), `${file} exists in the dedicated suite`));
const universe = read('scripts/86chaos-release-gate/release-test-universe.cjs');
assert(universe.includes('86chaos-new-implementations/**/*.spec.cjs'), 'dedicated suite is inside RELEASE_TEST_MATCH');
for (const file of ['shift4-auth-16-0-234.test.cjs','shift4-client-16-0-234.test.cjs','shift4-concurrency-16-0-234.test.cjs','shift4-normalization-16-0-234.test.cjs','shift4-review-export-16-0-234.test.cjs','shift4-storage-16-0-234.test.cjs','shift4-routes-16-0-234.test.cjs','shift4-sync-16-0-234.test.cjs','release-universe-16-0-234.test.cjs']) assert(exists(`api/${file}`), `${file} backend coverage exists`);
for (const file of ['src/core/schedulePrintModel.test.js','src/core/schedulePdf.test.js','src/core/schedulePdfDelivery.test.js']) assert(exists(file), `${file} PDF coverage exists`);
const matrix = json('docs/16.0.234-implementation-test-matrix.json');
assert(matrix.version === '16.0.234' && matrix.coverage.length >= 15 && matrix.coverage.every(row => row.tests?.length), 'machine-readable implementation-to-test matrix is complete');

// Preserve 16.0.233 Schedule Tools implementation while advancing its version surfaces.
const period = read('src/core/scheduleToolsPeriod.shared.js');
assert(period.includes('deriveScheduleToolsPeriod') && period.includes('filterScheduleToolsRecords') && exists('api/schedule-tools-period-awareness-16-0-233.test.cjs'), 'certified 16.0.233 Schedule Tools behavior remains present');

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

if (failures) { console.error(`16.0.234 source validation failed with ${failures} failure(s).`); process.exit(1); }
console.log('16.0.234 source validation passed.');
