'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const version = '17.0.60';
const pkg = json('package.json');
const lock = json('package-lock.json');

assert.equal(pkg.version, version);
assert.equal(lock.version, version);
assert.equal(lock.packages[''].version, version);
assert.equal(json('public/version.json').version, version);
assert.match(read('src/core/appCore.js'), /CURRENT_VERSION = '17\.0\.60'/);
assert.match(read('api/_version.js'), /17\.0\.60/);
assert.equal(json('test-tools/certification/groups.json').release, version);
assert.equal(json('test-tools/certification/cost-performance-baselines.json').release, version);
assert.equal(json('test-tools/regressions/registry.json').release, version);
assert.equal(pkg.scripts['test:source'], 'node scripts/validate-17-0-60.js');
assert.equal(pkg.scripts['validate:17.0.60'], 'node scripts/validate-17-0-60.js');
assert.equal(pkg.scripts['test:repair:17.0.60'], 'npm run test:current-release-targeted');
assert.match(pkg.scripts['test:current-release-targeted'], /release-gate-source-inventory-17-0-60\.test\.cjs/);
assert.ok(pkg.scripts['test:current-release-targeted'].endsWith('node scripts/validate-17-0-60.js'));

const sourceIdentity = read('scripts/86chaos-release-gate/source-identity.cjs');
assert.match(sourceIdentity, /file === '\.npmrc'/);
assert.doesNotMatch(sourceIdentity, /const tracked = trackedSourceFiles\(root\);/);
const universe = require('./86chaos-release-gate/release-test-universe.cjs');
const regression = 'tests/86chaos-release-gate/72-release-gate-source-inventory-17-0-60.spec.cjs';
assert.ok(universe.RELEASE_CRITICAL_SPECS.includes(regression));
assert.equal(fs.existsSync(path.join(root, 'api/release-gate-source-inventory-17-0-60.test.cjs')), true);
assert.equal(fs.existsSync(path.join(root, regression)), true);
assert.match(read('.github/workflows/testing-targeted-delta.yml'), /72-release-gate-source-inventory-17-0-60\.spec\.cjs/);

console.log('86 Chaos 17.0.60 Git/ZIP source inventory parity repair validation PASS');
