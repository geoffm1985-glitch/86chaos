'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));

const pkg = json('package.json');
assert.equal(pkg.version, '17.0.54');
assert.equal(json('public/version.json').version, '17.0.54');
assert.match(read('src/core/appCore.js'), /CURRENT_VERSION = '17\.0\.54'/);
assert.match(read('api/_version.js'), /17\.0\.54/);
assert.equal(json('test-tools/certification/groups.json').release, '17.0.54');
assert.equal(json('test-tools/certification/cost-performance-baselines.json').release, '17.0.54');

const target = read('scripts/86chaos-firebase-target.cjs');
for (const marker of ['demo-86chaos','FIRESTORE_EMULATOR_HOST','FIREBASE_AUTH_EMULATOR_HOST','FUNCTIONS_EMULATOR_HOST','FIREBASE_DATABASE_EMULATOR_HOST','FIREBASE_STORAGE_EMULATOR_HOST']) assert.match(target, new RegExp(marker));
const browser = read('src/core/appCore.js');
for (const marker of ['connectFirestoreEmulator','connectAuthEmulator','connectFunctionsEmulator','connectDatabaseEmulator','connectStorageEmulator']) assert.match(browser, new RegExp(marker));
assert.match(read('src/index.js'), /firebase-emulator-startup-failure/);
assert.match(read('src/components/TabGodMode.js'), /connectAuthEmulator/);
assert.match(read('scripts/86chaos-full-audit/seed-fake-restaurant.cjs'), /firestoreRestOrigin/);
assert.match(read('scripts/86chaos-full-audit/cleanup-fake-restaurant.cjs'), /firebaseAuthRestUrl/);
assert.match(read('scripts/86chaos-release-gate/server-firebase-boundary-preflight.cjs'), /liveVerificationRequired:\s*true/);
assert.match(read('tests/86chaos-release-gate/66-firebase-emulator-bridge-17-0-54.spec.cjs'), /no silent live fallback/);
assert.equal(pkg.scripts['firebase:emulator:reset'], 'node scripts/reset-firebase-emulator-data.cjs');
assert.equal(pkg.scripts['validate:17.0.54'], 'node scripts/validate-17-0-54.js');

console.log('86 Chaos 17.0.54 Firebase Emulator Bridge source validation PASS');
