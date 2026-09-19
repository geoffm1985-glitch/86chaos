#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
let failures = 0;
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const sha = file => crypto.createHash('sha256').update(read(file)).digest('hex');
const assert = (condition, message) => {
  if (condition) console.log(`OK: ${message}`);
  else { failures += 1; console.error(`FAIL: ${message}`); }
};

const pkg = json('package.json');
const lock = json('package-lock.json');
const version = json('public/version.json');
const apiVersion = read('api/_version.js');
const appCore = read('src/core/appCore.js');
const save = read('api/personal-reminder-save.js');
const dispatch = read('api/dispatch-reminders.js');
const app = read('src/App.js');
const reminders = read('src/features/intelligence.jsx');
const reminderUtils = read('src/core/reminderUtils.js');
const reminderTests = read('src/core/reminderUtils.test.js');
const styles = read('src/styles.css');
const voice = read('src/components/common.jsx');
const eslintConfig = read('test-tools/config/eslint.cjs');
const universe = read('scripts/86chaos-release-gate/release-test-universe.cjs');
const inventory = read('scripts/86chaos-release-gate/critical-test-inventory.cjs');
const integrity = read('tests/86chaos-release-gate/34-ultimate-test-universe-integrity.spec.cjs');
const requestOffSpec = read('tests/e2e/schedule-request-off-management.spec.cjs');
const vercel = json('vercel.json');

assert(pkg.version === '16.0.227', 'package.json version is 16.0.227');
assert(lock.version === '16.0.227' && lock.packages?.['']?.version === '16.0.227', 'package-lock root versions are 16.0.227');
assert(pkg.scripts['test:source'] === 'node scripts/validate-16-0-227.js', 'test:source points to the 16.0.227 validator');
assert(version.version === '16.0.227' && version.build === '16.0.227', 'public version/build are 16.0.227');
assert(version.releaseTitle === 'Relative Reminder and Sticky Header Repair', 'release title identifies the two surgical repairs');
assert(apiVersion.includes("APP_VERSION = '16.0.227'") && apiVersion.includes("SECURITY_SCHEMA_VERSION = '16.0.227'"), 'API reports 16.0.227');
assert(appCore.includes("CURRENT_VERSION = '16.0.227'"), 'app reports 16.0.227');

assert(reminderUtils.includes('(?:in|after|for)'), 'relative reminder parser recognizes for-duration speech');
assert(reminderTests.includes('Set a reminder for five minutes to check the fryer'), 'for-duration reminder behavior has exact clock regression coverage');
assert(/body\s*\{\s*overflow-x:\s*clip;/.test(styles), 'page horizontal clipping does not create a false sticky scroll container');
assert(/\.desktop-pro-shell\s*\{\s*overflow-x:\s*clip;/.test(styles), 'application shell clips horizontal overflow without disabling sticky descendants');
assert(/\.desktop-pro-shell \.app-header\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0;[^}]*z-index:\s*40;/s.test(styles), 'application header is pinned at the top of the viewport');
assert(app.includes('html, body { overflow-x: clip !important;') && !app.includes('max-w-[100vw] overflow-x-hidden'), 'runtime shell preserves sticky positioning while retaining horizontal clipping');
assert(pkg.scripts.lint.includes('--config test-tools/config/eslint.cjs') && eslintConfig.includes('env: { es2021: true }'), 'lint uses the repository configuration and recognizes standard globalThis syntax');

const archiveOnlyBlock = requestOffSpec.slice(requestOffSpec.indexOf("test('Archive All Visible archives only filtered visible eligible requests'"));
assert(archiveOnlyBlock.includes("openRequestOffView(page, 'All')"), 'bulk archive opens the view that includes the seeded past approved request');
assert(!archiveOnlyBlock.includes("openRequestOffView(page, 'Upcoming Approved')"), 'bulk archive does not hide the seeded past request behind the upcoming-only filter');
assert((archiveOnlyBlock.match(/waitForRequestOffEmployee\(page, 'Allen QA'/g) || []).length >= 2, 'bulk archive still verifies the actual Allen request row before and after employee filtering');

assert(save.includes('recipientProfileId') && save.includes('resolveCallerProfile'), 'reminder save persists canonical recipient profile identity');
assert(save.includes('assigningToCaller') && save.includes('? callerMembership'), 'self save reuses caller authorization data');
assert(dispatch.includes('resolvePersonalReminderRecipient') && dispatch.includes('recipientFallbackReads'), 'dispatcher resolves canonical recipient with visible fallback cost stats');
assert(!dispatch.slice(dispatch.indexOf('async function resolvePersonalReminderRecipient'), dispatch.indexOf('function norm')).match(/collection\(['"]users['"]\)\.where/), 'recipient fallback does not query the users collection');
assert(dispatch.includes("webPushOptions(tag, '/?tab=reminders', title, body)"), 'FCM payload carries explicit reminder notification content');
assert(app.includes('showForegroundPushNotification(payload)') && app.includes('registration.showNotification(title'), 'foreground FCM displays an operating-system notification');
assert(reminders.includes('onEnableNotifications') && reminders.includes('Reminder notifications are not connected'), 'Reminders UI provides explicit notification repair');
assert(voice.includes('recipientProfileId'), 'voice-created reminders preserve canonical recipient profile identity');

assert(fs.existsSync(path.join(root, 'api/reminder-notification-delivery-16-0-211.test.cjs')), 'reminder-only delivery regression is included');
assert(fs.existsSync(path.join(root, 'tests/86chaos-release-gate/35-reminder-notification-certification.spec.cjs')), 'Play Store reminder certification is included');
assert(universe.includes('35-reminder-notification-certification.spec.cjs'), 'Play Store test universe includes reminder certification');
assert(inventory.includes('Reminder notification delivery'), 'critical inventory includes reminder notification delivery');
assert(integrity.includes('35-reminder-notification-certification.spec.cjs'), 'test-universe integrity requires reminder certification');
assert((vercel.crons || []).some(row => row.path === '/api/dispatch-reminders' && row.schedule === '*/5 * * * *'), 'reminder dispatcher remains scheduled every five minutes');

const unchanged = {
  'firestore.rules': '51bfd7d39edd59f680ae41a149c108cec8cd42d00b102d84cb00ee40d90264d9',
  'firestore.indexes.json': 'ee666de303988cd269f7c09fa63678a2deb1cfcaa199cb4f1656dd9bddcc4b4b',
  'storage.rules': '174e7e9a140193ff69ccf0f0d3e5c65b81a9e0fbbd612bff45ce57e7a3a7ce9c',
  'database.rules.json': '152b5cd3f9839f598c9602706d8205b96759296e865d540b52c780900bfba138',
  'firebase.json': 'bd837a11c71750d4da6ccfcb725ca54e78dd76008b525ec54c7fe79a5b8a3ca4',
  'public/firebase-messaging-sw.js': '46c7f5760350721d424ba6db9a3a9127449fbb670a24b04328e71d3a74ed2366',
  'vercel.json': '3a42afbec525fe1abfe52f28d9b973c9494bdaca6edf3b0ed1a43f30c69db276'
};
for (const [file, expected] of Object.entries(unchanged)) {
  assert(sha(file) === expected, `${file} unchanged`);
}

if (failures) {
  console.error(`16.0.227 source validation failed with ${failures} failure(s).`);
  process.exit(1);
}
console.log('16.0.227 source validation passed.');
