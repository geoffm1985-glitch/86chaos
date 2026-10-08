'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const exists = file => fs.existsSync(path.join(root, file));
const version = '17.0.68';

const pkg = json('package.json');
const lock = json('package-lock.json');
assert.equal(pkg.version, version);
assert.equal(lock.version, version);
assert.equal(lock.packages[''].version, version);
assert.equal(json('public/version.json').version, version);
assert.match(read('src/core/appCore.js'), /CURRENT_VERSION = '17\.0\.68'/);
assert.match(read('api/_version.js'), /17\.0\.68/);
assert.equal(json('test-tools/certification/groups.json').release, version);
assert.equal(json('test-tools/certification/cost-performance-baselines.json').release, version);
assert.equal(json('test-tools/regressions/registry.json').release, version);
assert.ok(read('src/core/customerHelpKnowledge.cjs').includes("CUSTOMER_HELP_VERSION = '17.0.68'"));
assert.ok(read('src/core/customerHelpKnowledge.js').includes("CUSTOMER_HELP_VERSION = '17.0.68'"));
assert.equal(pkg.scripts['test:source'], 'node scripts/validate-17-0-68.js');
assert.equal(pkg.scripts['validate:17.0.68'], 'node scripts/validate-17-0-68.js');
assert.equal(pkg.scripts['test:repair:17.0.68'], 'npm run test:current-release-targeted');
assert.match(pkg.scripts['test:current-release-targeted'], /release-gate-failed-new-evidence-17-0-68\.test\.cjs/);
assert.ok(pkg.scripts['test:current-release-targeted'].endsWith('node scripts/validate-17-0-68.js'));

const matrix = read('tests/86chaos-release-gate/exhaustive-surface-matrix.cjs');
assert.match(matrix, /prep:\s*\[\[\/\^food prep\$\/i\]/i);
assert.doesNotMatch(matrix, /prep:\s*\[\[\/\^prep\$\/i\]/i);

const sticky = read('tests/86chaos-release-gate/56-manager-brief-sticky-day-header.spec.cjs');
assert.match(sticky, /let scrollport = sticky\?\.parentElement \|\| null/);
assert.match(sticky, /scrollport\.scrollHeight > scrollport\.clientHeight \+ 8/);
assert.match(sticky, /expectedStickyViewportTop: Number\.isFinite\(computedStickyTop\) \? \(scrollportRect\?\.top \?\? 0\) \+ computedStickyTop/);
assert.doesNotMatch(sticky, /expectedStickyViewportTop:[^\n]*shellRect/);

const login = read('tests/e2e/utils/release-login-helper.cjs');
assert.match(login, /getByRole\('button', \{ name: \/\^Active workspace\\b\/i \}\)/);

const audit = read('tests/86chaos-full-audit/utils/audit-helpers.cjs');
assert.match(audit, /function isExpectedEmulatorFirebaseAuthBootstrapNoise/);
assert.match(audit, /trim\(\)\.toLowerCase\(\) === 'emulator'/);
assert.ok(audit.includes("return /https:\\/\\/apis\\.google\\.com\\/js\\/api\\.js/i.test(value)"));
assert.ok(audit.includes("&& /content security policy|\\bcsp\\b|blocked/i.test(value)"));
assert.match(audit, /if \(!emulatorSelected\) return false/);
assert.ok((audit.match(/isExpectedEmulatorFirebaseAuthBootstrapNoise\(/g) || []).length >= 3, 'helper is used by both console and request-failure paths');

const accessibility = read('tests/86chaos-release-gate/32-exhaustive-nested-accessibility.spec.cjs');
assert.match(accessibility, /if\(!applied\.ok&&state\.length\)/);
assert.match(accessibility, /gotoTab\(page,route\.tab,\{settleMs:350,timeout:8000,maxText:14000,force:true\}\)/);
assert.match(accessibility, /let applied=await applyStatePath\(page,traversalPath,\{strict:false\}\)/);
assert.equal((accessibility.match(/applied=await applyStatePath\(page,state,\{strict:false\}\)/g) || []).length, 1, 'accessibility state is retried exactly once after remount');
assert.match(accessibility, /if\(!applied\.ok\)\{findings\.push\(\{route:route\.tab,state:state\.map\(String\),missing:true\}\);continue;\}/);

const releaseSpec = 'tests/86chaos-release-gate/80-failed-new-evidence-17-0-68.spec.cjs';
const e2eSpec = 'tests/e2e/failed-new-evidence-17-0-68.spec.cjs';
for (const file of [
  'api/release-gate-failed-new-evidence-17-0-68.test.cjs',
  releaseSpec,
  e2eSpec,
  'RELEASE_17_0_68.md',
]) assert.equal(exists(file), true, `${file} exists`);

const universe = require('./86chaos-release-gate/release-test-universe.cjs');
assert.ok(universe.RELEASE_CRITICAL_SPECS.includes(releaseSpec), '17.0.68 release-gate regression is mandatory');
const workflow = read('.github/workflows/testing-targeted-delta.yml');
assert.match(workflow, /80-failed-new-evidence-17-0-68\.spec\.cjs/);
assert.match(workflow, /tests\/e2e\/failed-new-evidence-17-0-68\.spec\.cjs/);

const identity = require('./86chaos-release-gate/source-identity.cjs').captureSourceIdentity(root);
const manifest = json('release-source-manifest.json');
assert.equal(manifest.version, version);
assert.equal(manifest.sourceHash, identity.sourceHash, 'bundled release source manifest matches current 17.0.68 source');

console.log('86 Chaos 17.0.68 failed+new evidence repair validation PASS');
