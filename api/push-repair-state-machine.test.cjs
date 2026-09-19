'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  consumePushRepairUrl,
  shouldAutoAttemptRepair,
  stablePushRepairDismissalIdentity,
  terminalPushRepairLinkState
} = require('../src/core/pushRepairState.cjs');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.js'), 'utf8');

test('push repair URL is consumed once while preserving repair intent and cleaning the URL', () => {
  const result = consumePushRepairUrl('https://app.86chaos.com/?tab=settings&pushRepairNonce=nonce_123&pushRepair=1#top');
  assert.equal(result.hadRepairParam, true);
  assert.equal(result.state.requested, true);
  assert.equal(result.state.consumed, true);
  assert.equal(result.state.nonce, 'nonce_123');
  assert.equal(result.cleanedUrl, '/?tab=settings#top');
});

test('legacy pushRepair=1 link still activates a one-time request instead of being discarded', () => {
  const result = consumePushRepairUrl('https://app.86chaos.com/?pushRepair=1');
  assert.equal(result.hadRepairParam, true);
  assert.equal(result.state.requested, true);
  assert.equal(result.state.nonce, '');
  assert.equal(result.cleanedUrl, '/');
});

test('terminal push repair outcomes clear temporary link requested state', () => {
  const next = terminalPushRepairLinkState({ requested: true, consumed: true, nonce: 'abc' }, 'dismissed');
  assert.equal(next.requested, false);
  assert.equal(next.consumed, true);
  assert.equal(next.nonce, 'abc');
  assert.equal(next.terminalReason, 'dismissed');
});

test('stable push repair dismissal identity is not affected by profile document hydration or changing errors', () => {
  const a = stablePushRepairDismissalIdentity({ authUid: 'auth-1', workspaceId: 'cheers', deviceId: 'web_1', nonce: 'nonceA', profileDocId: 'auth-1', failureCode: 'old' });
  const b = stablePushRepairDismissalIdentity({ authUid: 'auth-1', workspaceId: 'cheers', deviceId: 'web_1', nonce: 'nonceA', profileDocId: 'geoff@example.com', failureCode: 'new', status: 'failed' });
  assert.equal(a, b);
});

test('same dismissed nonce suppresses automatic repair while a new nonce can display/attempt again', () => {
  assert.equal(shouldAutoAttemptRepair({ requested: true, nonce: 'n1', dismissed: true, attempted: false }), false);
  assert.equal(shouldAutoAttemptRepair({ requested: true, nonce: 'n1', dismissed: false, attempted: true }), false);
  assert.equal(shouldAutoAttemptRepair({ requested: true, nonce: 'n2', dismissed: false, attempted: false }), true);
});

test('App captures repair URL intent, removes URL parameters, and clears link state on terminal outcomes', () => {
  assert.match(appSource, /setPushRepairLinkRequest\(\{ requested: true, consumed: true, nonce, capturedNonce: nonce/);
  assert.match(appSource, /window\.history\.replaceState/);
  assert.match(appSource, /clearPushRepairLinkRequest\('repair-success'\)/);
  assert.match(appSource, /clearPushRepairLinkRequest\('dismissed'\)/);
  assert.match(appSource, /getPushRepairAutoAttemptKey/);
});
