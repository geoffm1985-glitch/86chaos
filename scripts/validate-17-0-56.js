'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));

const pkg = json('package.json');
assert.equal(pkg.version, '17.0.56');
assert.equal(json('public/version.json').version, '17.0.56');
assert.match(read('src/core/appCore.js'), /CURRENT_VERSION = '17\.0\.56'/);
assert.match(read('api/_version.js'), /17\.0\.56/);
assert.equal(json('test-tools/certification/groups.json').release, '17.0.56');
assert.equal(json('test-tools/certification/cost-performance-baselines.json').release, '17.0.56');

const entry = read('src/index.js');
assert.match(entry, /import \{ firebaseEmulatorReadiness \} from ["']\.\/core\/appCore["'];/);
assert.match(entry, /import \{ firebaseRuntimeTarget \} from ["']\.\/core\/firebaseTarget["'];/);
assert.doesNotMatch(entry, /import\s*\{[^}]*firebaseRuntimeTarget[^}]*\}\s*from\s*["']\.\/core\/appCore["']/);

const browserConfig = path.join(root, 'src', 'core', 'firebase-emulator.config.json');
assert.equal(fs.existsSync(browserConfig), true);
assert.equal(fs.existsSync(path.join(root, 'firebase-emulator.config.json')), false);
assert.match(read('src/core/firebaseTarget.js'), /import emulatorConfig from '\.\/firebase-emulator\.config\.json'/);
assert.match(read('scripts/86chaos-firebase-target.cjs'), /require\('\.\.\/src\/core\/firebase-emulator\.config\.json'\)/);
assert.match(read('src/core/appCore.js'), /export const firebaseEmulatorReadiness =/);
assert.equal(fs.existsSync(path.join(root, 'api/firebase-emulator-entry-import-17-0-56.test.cjs')), true);
assert.equal(fs.existsSync(path.join(root, 'tests/86chaos-release-gate/68-firebase-emulator-entry-import-17-0-56.spec.cjs')), true);

console.log('86 Chaos 17.0.56 Firebase entrypoint import repair source validation PASS');
