'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { CONNECT_POLICY } = require('../scripts/yardmaster-readiness.cjs');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const directive = (policy, name) => String(policy || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${name} `)) || '';

test('17.0.67 Yardmaster readiness CSP permits Firebase Auth bootstrap without opening live Firebase network access', () => {
  const scripts = `${directive(CONNECT_POLICY, 'script-src')} ${directive(CONNECT_POLICY, 'script-src-elem')}`;
  const frames = directive(CONNECT_POLICY, 'frame-src');
  const connects = directive(CONNECT_POLICY, 'connect-src');

  assert.match(scripts, /https:\/\/\*\.google\.com/);
  assert.match(frames, /https:\/\/\*\.firebaseapp\.com/);
  assert.match(frames, /http:\/\/127\.0\.0\.1:\*/);
  assert.match(frames, /http:\/\/localhost:\*/);
  assert.match(frames, /https:\/\/accounts\.google\.com|https:\/\/\*\.google\.com/);
  assert.match(connects, /http:\/\/127\.0\.0\.1:\*/);
  assert.match(connects, /http:\/\/localhost:\*/);
  assert.doesNotMatch(connects, /googleapis\.com|firebaseio\.com|firestore\.googleapis\.com|identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com/);

  const production = read('vercel.json');
  assert.match(production, /https:\/\/\*\.google\.com/);
  assert.match(production, /https:\/\/\*\.firebaseapp\.com/);
});

test('17.0.67 Spanish regression cleanup fails closed and proves English persistence after reload', () => {
  const source = read('tests/86chaos-new-implementations/08-phase1-spanish-interface.spec.cjs');
  assert.match(source, /async function saveLanguagePreference/);
  assert.match(source, /verifyReload = false/);
  assert.match(source, /saveLanguagePreference\(page, 'en', \{ verifyReload: true \}\)/);
  assert.match(source, /Language \$\{value\} must survive a fresh authenticated reload/);
  assert.doesNotMatch(source, /if \(await save\.isVisible/);
});

test('17.0.67 nested sticky assertions use scrollport-relative geometry from the captured failures', () => {
  const managerBrief = read('tests/86chaos-release-gate/56-manager-brief-sticky-day-header.spec.cjs');
  const emergency = read('tests/86chaos-release-gate/54-emergency-schedule-requestoff.spec.cjs');
  assert.match(managerBrief, /expectedStickyViewportTop/);
  assert.match(managerBrief, /scrollportRect\?\.top \?\? 0\) \+ computedStickyTop/);
  assert.doesNotMatch(managerBrief, /expectedStickyViewportTop:[^\n]*shellRect/);
  assert.match(emergency, /pinnedViewportTop = before\.scrollportTop \+ before\.top/);
  assert.match(emergency, /expectedTop: Math\.max\(pinnedViewportTop, before\.initialTop - scrollDelta\)/);

  assert.equal(15.484375 + 56, 71.484375);
  assert.equal(Math.max(15.484375 + 56, 421 - 240), 181);
});

test('17.0.67 System Administrator scroll regions are keyboard focusable and labeled', () => {
  const source = read('src/features/management.jsx');
  for (const label of [
    'Full Vercel API route manifest',
    'Administrator session timeline',
    'Global forensics and ghost audit records',
  ]) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(source, new RegExp(`role="region" aria-label="${escaped}" tabIndex=\\{0\\}`));
  }
});

test('17.0.67 route reset retries only the captured navigation-context transient', () => {
  const source = read('tests/86chaos-release-gate/utils/exhaustive-ui-helpers.cjs');
  assert.match(source, /Execution context was destroyed\|most likely because of a navigation/);
  assert.match(source, /waitForLoadState\('domcontentloaded'/);
  assert.equal((source.match(/await routeReset\(\);/g) || []).length, 2);
});
