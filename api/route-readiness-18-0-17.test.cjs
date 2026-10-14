'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../tests/86chaos-full-audit/utils/audit-helpers.cjs'), 'utf8');
const identitySource = source.slice(source.indexOf('async function renderedRouteIdentityReady('), source.indexOf('const FATAL_TEXT_RE'));
const ready = vm.runInNewContext(identitySource + '\nrenderedRouteIdentityReady;', { ROUTE_READY_HEADING_RE: {} });
const pageFor = surface => ({ evaluate: async () => surface });

test('navigation titles cannot substitute for a rendered lazy screen', async () => {
  const spec = { expect: /Schedule|Coverage/i };
  assert.equal(await ready(pageFor({ text: 'Loading section...', loading: true }), 'schedule', spec, 'Schedule 5 On Schedule'), false);
  assert.equal(await ready(pageFor({ text: '', loading: false }), 'schedule', spec, 'Schedule Builder'), false);
  assert.equal(await ready(pageFor({ text: 'Schedule Builder Coverage', loading: false }), 'schedule', spec, 'Schedule Builder Coverage'), true);
});

test('pending administrator verification and loading cannot count as permission gates', async () => {
  const spec = { expect: /System Administrator|Permission/i };
  assert.equal(await ready(pageFor({ text: 'Loading section...', loading: true }), 'godmode', spec, 'Permission'), false);
  assert.equal(await ready(pageFor({ text: 'System Administrator', loading: false }), 'godmode', spec, 'SERVER-VERIFICATION-PENDING'), false);
  assert.equal(await ready(pageFor({ text: 'Restricted Platform Tools', loading: false }), 'godmode', spec, 'Restricted Platform Tools HTTP: 403'), true);
});

test('financial readiness requires the actual Professional Financial Center heading inside main', async () => {
  const headingSource = source.slice(source.indexOf('const ROUTE_READY_HEADING_RE ='), source.indexOf('const FATAL_TEXT_RE'));
  const check = vm.runInNewContext(headingSource + '\nrenderedRouteIdentityReady;', { window: { getComputedStyle: () => ({ display: 'block', visibility: 'visible' }) } });
  const financialPage = heading => ({
    evaluate: async () => ({ text: 'Professional Financial Center Net Sales', loading: false }),
    locator: selector => {
      assert(selector.split(',').every(part => part.startsWith('main ')), 'Route heading proof must stay inside the rendered surface');
      return { evaluateAll: async (fn, patterns) => fn(heading ? [{ hidden: false, getAttribute: () => null, textContent: heading, getBoundingClientRect: () => ({ width: 300, height: 32 }) }] : [], patterns) };
    },
  });
  assert.equal(await check(financialPage('Professional Financial Center'), 'financials', {}, 'Financials'), true);
  assert.equal(await check(financialPage('Financial Center'), 'financials', {}, 'Financials'), true);
  assert.equal(await check(financialPage('Financials'), 'financials', {}, 'Financials'), false);
  assert.equal(await check(financialPage(''), 'financials', {}, 'Financial Center'), false);
});

test('route readiness refuses an expired loading screen instead of returning it', async () => {
  let now = 0;
  const settleSource = source.slice(source.indexOf('async function waitForRouteSettle('), source.indexOf('async function openTabInApp('));
  const settle = vm.runInNewContext(settleSource + '\nwaitForRouteSettle;', {
    ROUTE_SPECS: [{ tab: 'schedule', expect: /Schedule/ }], Date: { now: () => now },
    bodyText: async () => 'Schedule Loading section...', renderedRouteIdentityReady: async () => false,
    chooseQaWorkspace: async () => false, dismissBlockingDialogs: async () => {}, dismissNoise: async () => {},
  });
  const page = { evaluate: async () => 'schedule', waitForTimeout: async ms => { now += ms; } };
  await assert.rejects(() => settle(page, 'schedule', { timeout: 700 }), /did not render.*700ms/);
});
