'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));

const pkg = json('package.json');
assert.equal(pkg.version, '17.0.55');
assert.equal(json('public/version.json').version, '17.0.55');
assert.match(read('src/core/appCore.js'), /CURRENT_VERSION = '17\.0\.55'/);
assert.match(read('api/_version.js'), /17\.0\.55/);
assert.equal(json('test-tools/certification/groups.json').release, '17.0.55');
assert.equal(json('test-tools/certification/cost-performance-baselines.json').release, '17.0.55');

const browserConfig = path.join(root, 'src', 'core', 'firebase-emulator.config.json');
assert.equal(fs.existsSync(browserConfig), true);
assert.equal(fs.existsSync(path.join(root, 'firebase-emulator.config.json')), false);
assert.equal(path.relative(path.join(root, 'src'), browserConfig).startsWith('..'), false);
assert.match(read('src/core/firebaseTarget.js'), /import emulatorConfig from '\.\/firebase-emulator\.config\.json'/);
assert.match(read('scripts/86chaos-firebase-target.cjs'), /require\('\.\.\/src\/core\/firebase-emulator\.config\.json'\)/);
for (const marker of ['connectFirestoreEmulator','connectAuthEmulator','connectFunctionsEmulator','connectDatabaseEmulator','connectStorageEmulator']) assert.match(read('src/core/appCore.js'), new RegExp(marker));
assert.match(read('tests/86chaos-release-gate/67-firebase-emulator-cra-build-17-0-55.spec.cjs'), /bundled app boots/);

console.log('86 Chaos 17.0.55 CRA-safe Firebase Emulator Bridge source validation PASS');
