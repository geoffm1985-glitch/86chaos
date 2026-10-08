'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const version = '17.0.63';
const pkg = json('package.json');
const lock = json('package-lock.json');

assert.equal(pkg.version, version);
assert.equal(lock.version, version);
assert.equal(lock.packages[''].version, version);
assert.equal(json('public/version.json').version, version);
assert.match(read('src/core/appCore.js'), /CURRENT_VERSION = '17\.0\.63'/);
assert.match(read('api/_version.js'), /17\.0\.63/);
assert.equal(json('test-tools/certification/groups.json').release, version);
assert.equal(json('test-tools/certification/cost-performance-baselines.json').release, version);
assert.equal(json('test-tools/regressions/registry.json').release, version);
assert.equal(pkg.scripts['test:source'], 'node scripts/validate-17-0-63.js');
assert.equal(pkg.scripts['validate:17.0.63'], 'node scripts/validate-17-0-63.js');
assert.equal(pkg.scripts['test:repair:17.0.63'], 'npm run test:current-release-targeted');
assert.match(pkg.scripts['test:current-release-targeted'], /release-gate-yardmaster-readiness-bootstrap-17-0-63\.test\.cjs/);
assert.ok(pkg.scripts['test:current-release-targeted'].endsWith('node scripts/validate-17-0-63.js'));

const readiness = read('scripts/yardmaster-readiness.cjs');
assert.match(readiness, /bootstrapAcknowledgment/);
assert.match(readiness, /res\.status\(503\)\.json\(\{ \.\.\.bootstrap, ready: false, error \}\)/);
const installer = read('scripts/86chaos-release-gate/yardmaster-dependency-install.cjs');
assert.match(installer, /bootstrapPending=response\.ok===false&&response\.status===503&&state\.ready===false/);
assert.match(installer, /did not acknowledge emulator isolation/);
assert.match(installer, /dependency-preflight\.cjs/);

const universe = require('./86chaos-release-gate/release-test-universe.cjs');
const regression = 'tests/86chaos-release-gate/75-yardmaster-readiness-bootstrap-17-0-63.spec.cjs';
assert.ok(universe.RELEASE_CRITICAL_SPECS.includes(regression));
assert.equal(fs.existsSync(path.join(root, 'api/release-gate-yardmaster-readiness-bootstrap-17-0-63.test.cjs')), true);
assert.equal(fs.existsSync(path.join(root, regression)), true);
assert.match(read('.github/workflows/testing-targeted-delta.yml'), /75-yardmaster-readiness-bootstrap-17-0-63\.spec\.cjs/);
assert.equal(read('src/core/customerHelpKnowledge.cjs').includes("CUSTOMER_HELP_VERSION = '17.0.63'"), true);
assert.equal(read('src/core/customerHelpKnowledge.js').includes("CUSTOMER_HELP_VERSION = '17.0.63'"), true);

console.log('86 Chaos 17.0.63 Yardmaster readiness bootstrap deadlock repair validation PASS');
