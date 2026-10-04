'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const version = '17.0.67';

const pkg = json('package.json');
const lock = json('package-lock.json');
assert.equal(pkg.version, version);
assert.equal(lock.version, version);
assert.equal(lock.packages[''].version, version);
assert.equal(json('public/version.json').version, version);
assert.match(read('src/core/appCore.js'), /CURRENT_VERSION = '17\.0\.67'/);
assert.match(read('api/_version.js'), /17\.0\.67/);
assert.equal(json('test-tools/certification/groups.json').release, version);
assert.equal(json('test-tools/certification/cost-performance-baselines.json').release, version);
assert.equal(json('test-tools/regressions/registry.json').release, version);
assert.equal(read('src/core/customerHelpKnowledge.cjs').includes("CUSTOMER_HELP_VERSION = '17.0.67'"), true);
assert.equal(read('src/core/customerHelpKnowledge.js').includes("CUSTOMER_HELP_VERSION = '17.0.67'"), true);
assert.equal(pkg.scripts['test:source'], 'node scripts/validate-17-0-67.js');
assert.equal(pkg.scripts['validate:17.0.67'], 'node scripts/validate-17-0-67.js');
assert.equal(pkg.scripts['test:repair:17.0.67'], 'npm run test:current-release-targeted');
assert.match(pkg.scripts['test:current-release-targeted'], /release-gate-runtime-isolation-17-0-67\.test\.cjs/);
assert.ok(pkg.scripts['test:current-release-targeted'].endsWith('node scripts/validate-17-0-67.js'));

const readiness = require('./yardmaster-readiness.cjs');
const directive = (policy, name) => String(policy || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${name} `)) || '';
const scripts = `${directive(readiness.CONNECT_POLICY, 'script-src')} ${directive(readiness.CONNECT_POLICY, 'script-src-elem')}`;
const frames = directive(readiness.CONNECT_POLICY, 'frame-src');
const connects = directive(readiness.CONNECT_POLICY, 'connect-src');
assert.match(scripts, /https:\/\/\*\.google\.com/);
assert.match(frames, /https:\/\/\*\.firebaseapp\.com/);
assert.match(connects, /http:\/\/127\.0\.0\.1:\*/);
assert.doesNotMatch(connects, /googleapis\.com|firebaseio\.com|firestore\.googleapis\.com|identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com/);

const spanish = read('tests/86chaos-new-implementations/08-phase1-spanish-interface.spec.cjs');
assert.match(spanish, /saveLanguagePreference\(page, 'en', \{ verifyReload: true \}\)/);
assert.match(spanish, /must survive a fresh authenticated reload/);
assert.doesNotMatch(spanish, /if \(await save\.isVisible/);

const reset = read('tests/86chaos-release-gate/utils/exhaustive-ui-helpers.cjs');
assert.match(reset, /Execution context was destroyed\|most likely because of a navigation/);
assert.equal((reset.match(/await routeReset\(\);/g) || []).length, 2);

const sticky56 = read('tests/86chaos-release-gate/56-manager-brief-sticky-day-header.spec.cjs');
const sticky54 = read('tests/86chaos-release-gate/54-emergency-schedule-requestoff.spec.cjs');
assert.match(sticky56, /expectedStickyViewportTop/);
assert.match(sticky54, /expectedTop: Math\.max\(pinnedViewportTop, before\.initialTop - scrollDelta\)/);

const management = read('src/features/management.jsx');
for (const label of ['Full Vercel API route manifest', 'Administrator session timeline', 'Global forensics and ghost audit records']) {
  assert.ok(management.includes(`role="region" aria-label="${label}" tabIndex={0}`), `${label} is focusable`);
}

const universe = require('./86chaos-release-gate/release-test-universe.cjs');
const releaseSpec = 'tests/86chaos-release-gate/79-runtime-isolation-csp-sticky-a11y-17-0-67.spec.cjs';
const e2eSpec = 'tests/e2e/runtime-isolation-csp-sticky-a11y.spec.cjs';
assert.ok(universe.RELEASE_CRITICAL_SPECS.includes(releaseSpec));
for (const file of ['api/release-gate-runtime-isolation-17-0-67.test.cjs', releaseSpec, e2eSpec, 'RELEASE_17_0_67.md']) {
  assert.equal(fs.existsSync(path.join(root, file)), true, `${file} exists`);
}
const workflow = read('.github/workflows/testing-targeted-delta.yml');
assert.match(workflow, /79-runtime-isolation-csp-sticky-a11y-17-0-67\.spec\.cjs/);
assert.match(workflow, /tests\/e2e\/runtime-isolation-csp-sticky-a11y\.spec\.cjs/);

const identity = require('./86chaos-release-gate/source-identity.cjs').captureSourceIdentity(root);
const manifest = json('release-source-manifest.json');
assert.equal(manifest.version, version);
assert.equal(manifest.sourceHash, identity.sourceHash, 'bundled release source manifest matches current 17.0.67 source');
console.log('86 Chaos 17.0.67 release-gate runtime isolation validation PASS');
