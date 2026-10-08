'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const { assertCurrentReleaseIdentity } = require('./_current-release-identity.cjs');

test('16.0.208 mobile login readiness retries and fails explicitly instead of misreporting seed visibility', async () => {
  const helpers = read('tests/86chaos-full-audit/utils/audit-helpers.cjs');
  assert.match(helpers, /const fillAndSubmit = async/);
  assert.match(helpers, /submitAuditLogin\(\{/);
  assert.match(helpers, /submit: fillAndSubmit/);
  assert.match(helpers, /wait: \(\) => waitPastLogin/);
  const { submitAuditLogin } = require('../tests/86chaos-full-audit/utils/firebase-transport-recovery.cjs');
  for (const persistent of [false, true]) {
    let submissions = 0;
    const states = persistent ? ['Login Unlocking', 'Login Unlocking'] : ['Login Unlocking', 'Authenticated workspace'];
    const run = () => submitAuditLogin({
      submit: async () => { submissions++; },
      wait: async () => states.shift(),
      isLogin: text => text.startsWith('Login'),
      refresh: async () => { assert.fail('Pending login must not refresh'); },
      pause: async () => { assert.fail('Pending login must not pause'); },
    });
    if (persistent) await assert.rejects(run, /Login did not leave the login screen/);
    else assert.equal(await run(), 'Authenticated workspace');
    assert.equal(submissions, 2);
  }
});

test('16.0.208 responsive nested-state discovery opens the mobile System Administrator directory before declaring states missing', () => {
  const helpers = read('tests/86chaos-release-gate/utils/exhaustive-ui-helpers.cjs');
  assert.match(helpers, /async function openResponsiveStateDirectory/);
  assert.match(helpers, /show directory/i);
  assert.match(helpers, /timeout = 1800/);
});

test('16.0.208 exhaustive graph trims redundant expensive probes without dropping route\/state visitation', () => {
  const graph = read('tests/86chaos-release-gate/28-exhaustive-route-state-control-graph.spec.cjs');
  const helper = read('tests/86chaos-release-gate/utils/exhaustive-ui-helpers.cjs');
  assert.match(graph, /const expensiveProbe = stateIndex === 0/);
  assert.match(graph, /probeForms: expensiveProbe/);
  assert.match(graph, /probeMutationActionability: expensiveProbe/);
  assert.match(helper, /if \(options\.attachDetail !== false\)/);
});

test('16.0.208 accessibility fixes preserve real surfaces with focusable scroll regions and higher contrast muted labels', () => {
  const schedule = read('src/features/schedule.jsx');
  const inventory = read('src/features/inventory.jsx');
  const operations = read('src/features/operations.jsx');
  assert.match(schedule, /role="region" aria-label="Full schedule shift list" tabIndex=\{0\}/);
  assert.match(schedule, /text-slate-400/);
  assert.match(inventory, /text-red-100/);
  assert.match(operations, /text-red-200 font-black animate-pulse/);
});

test('16.0.208 historical maturity assertions coexist with advancing current release identity', () => {
  assert.equal(assertCurrentReleaseIdentity(root), require('../package.json').version);
});
