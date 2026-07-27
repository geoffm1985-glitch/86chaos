'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  stableMeaningfulAutomationHash,
  collectEligibleAutomationTokens,
  stableAlertIdentity
} = require('./_python-automation-logic');

test('volatile run IDs and generation times do not alter business hash', () => {
  const a = stableMeaningfulAutomationHash({ runId:'a', generatedAt:'2026-01-01T00:00:00Z', managerBrief:[{ id:'risk1', title:'Low stock', severity:'high' }] });
  const b = stableMeaningfulAutomationHash({ runId:'b', generatedAt:'2026-01-02T00:00:00Z', managerBrief:[{ id:'risk1', title:'Low stock', severity:'high' }] });
  assert.equal(a, b);
});

test('business IDs, dates, and priority order remain meaningful', () => {
  const a = stableMeaningfulAutomationHash({ managerBrief:[{ id:'risk1', title:'Low stock', dueDate:'2026-07-25' }, { id:'risk2', title:'Labor', priority:2 }] });
  const differentId = stableMeaningfulAutomationHash({ managerBrief:[{ id:'risk9', title:'Low stock', dueDate:'2026-07-25' }, { id:'risk2', title:'Labor', priority:2 }] });
  const differentDate = stableMeaningfulAutomationHash({ managerBrief:[{ id:'risk1', title:'Low stock', dueDate:'2026-07-26' }, { id:'risk2', title:'Labor', priority:2 }] });
  const differentOrder = stableMeaningfulAutomationHash({ managerBrief:[{ id:'risk2', title:'Labor', priority:2 }, { id:'risk1', title:'Low stock', dueDate:'2026-07-25' }] });
  assert.notEqual(a, differentId);
  assert.notEqual(a, differentDate);
  assert.notEqual(a, differentOrder);
});

test('modern registry excludes stale, denied, and disabled devices without legacy revival', () => {
  const now = Date.parse('2026-07-27T00:00:00.000Z');
  const user = {
    fcmToken: 'legacy',
    pushDevices: {
      ok: { token:'ok', active:true, permission:'granted', lastVerifiedAt:'2026-07-26T00:00:00.000Z' },
      denied: { token:'legacy', active:true, permission:'denied', lastVerifiedAt:'2026-07-26T00:00:00.000Z' },
      disabled: { token:'disabled', active:false, permission:'granted', lastVerifiedAt:'2026-07-26T00:00:00.000Z' }
    }
  };
  assert.deepEqual(collectEligibleAutomationTokens(user, now), ['ok']);
});

test('stable alert identity ignores mutable detail text but preserves entity identity', () => {
  const a = stableAlertIdentity({ restaurantId:'r1', source:'python', type:'maintenance', entityId:'m1', payload:{ detail:'old' } });
  const b = stableAlertIdentity({ restaurantId:'r1', source:'python', type:'maintenance', entityId:'m1', payload:{ detail:'new' } });
  const c = stableAlertIdentity({ restaurantId:'r1', source:'python', type:'maintenance', entityId:'m2', payload:{ detail:'new' } });
  assert.equal(a, b);
  assert.notEqual(a, c);
});
