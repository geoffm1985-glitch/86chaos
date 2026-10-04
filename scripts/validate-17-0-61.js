'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const version = '17.0.61';
const pkg = json('package.json');
const lock = json('package-lock.json');

assert.equal(pkg.version, version);
assert.equal(lock.version, version);
assert.equal(lock.packages[''].version, version);
assert.equal(json('public/version.json').version, version);
assert.match(read('src/core/appCore.js'), /CURRENT_VERSION = '17\.0\.61'/);
assert.match(read('api/_version.js'), /17\.0\.61/);
assert.equal(json('test-tools/certification/groups.json').release, version);
assert.equal(json('test-tools/certification/cost-performance-baselines.json').release, version);
assert.equal(json('test-tools/regressions/registry.json').release, version);
assert.equal(pkg.scripts['test:source'], 'node scripts/validate-17-0-61.js');
assert.equal(pkg.scripts['validate:17.0.61'], 'node scripts/validate-17-0-61.js');
assert.equal(pkg.scripts['test:repair:17.0.61'], 'npm run test:current-release-targeted');
assert.match(pkg.scripts['test:current-release-targeted'], /release-gate-ignored-local-source-17-0-61\.test\.cjs/);
assert.ok(pkg.scripts['test:current-release-targeted'].endsWith('node scripts/validate-17-0-61.js'));

const sourceIdentity = read('scripts/86chaos-release-gate/source-identity.cjs');
assert.match(sourceIdentity, /ls-files', '-z', '--cached', '--others', '--exclude-standard/);
assert.match(sourceIdentity, /return gitFiles === null \? walkSourceFiles\(root\) : gitFiles/);
const universe = require('./86chaos-release-gate/release-test-universe.cjs');
const regression = 'tests/86chaos-release-gate/73-release-gate-ignored-local-source-17-0-61.spec.cjs';
assert.ok(universe.RELEASE_CRITICAL_SPECS.includes(regression));
assert.equal(fs.existsSync(path.join(root, 'api/release-gate-ignored-local-source-17-0-61.test.cjs')), true);
assert.equal(fs.existsSync(path.join(root, regression)), true);
assert.match(read('.github/workflows/testing-targeted-delta.yml'), /73-release-gate-ignored-local-source-17-0-61\.spec\.cjs/);
assert.equal(read('src/core/customerHelpKnowledge.cjs').includes("CUSTOMER_HELP_VERSION = '17.0.61'"), true);
assert.equal(read('src/core/customerHelpKnowledge.js').includes("CUSTOMER_HELP_VERSION = '17.0.61'"), true);

console.log('86 Chaos 17.0.61 ignored local source boundary repair validation PASS');
