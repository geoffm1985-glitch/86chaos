'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPersistencePlan, contentHash, scopeIdFor, collectAllRecordPages } = require('./_shift4-storage');

const record = (id, amount = 100, run = 'run-a') => ({ idempotencyKey: id, provider: 'shift4', providerProduct: 'shift4-dine', restaurantId: 'restaurant-a', providerLocationId: '17', recordType: 'ticket', sourceRecordId: id, businessDate: '2026-09-13', netAmountCents: amount, importRunId: run, approvalRequired: true, status: 'draft' });

test('first import inserts, unchanged replay no-ops, and changed source updates', () => {
  const first = buildPersistencePlan([record('one'), record('one')], new Map());
  assert.equal(first.inserts.length, 1); assert.equal(first.updates.length, 0); assert.equal(first.unchanged.length, 0);
  const existing = new Map([['one', { ...record('one'), contentHash: contentHash(record('one')) }]]);
  const replay = buildPersistencePlan([record('one', 100, 'different-run')], existing);
  assert.equal(replay.unchanged.length, 1); assert.equal(replay.inserts.length + replay.updates.length, 0);
  const changed = buildPersistencePlan([record('one', 125)], existing);
  assert.equal(changed.updates.length, 1);
});

test('overlapping ranges remain one logical record and location identity cannot collide', () => {
  const locationA = record('stable-a'); const locationB = { ...record('stable-b'), providerLocationId: '18', sourceRecordId: locationA.sourceRecordId };
  const plan = buildPersistencePlan([locationA, locationB], new Map());
  assert.equal(plan.inserts.length, 2); assert.notEqual(locationA.idempotencyKey, locationB.idempotencyKey);
});

test('conflicting duplicate identities are rejected instead of response-order first/last wins', () => {
  const conflict = buildPersistencePlan([record('same', 100), record('same', 200)], new Map());
  assert.equal(conflict.inserts.length + conflict.updates.length, 0); assert.equal(conflict.conflicts.length, 1);
  const duplicate = buildPersistencePlan([record('same', 100), record('same', 100)], new Map()); assert.equal(duplicate.inserts.length, 1); assert.equal(duplicate.duplicates, 1);
});

test('stored review pagination exceeds 5,000 rows and refuses bounded overflow or repeated cursors', async () => {
  const rows = Array.from({ length: 6000 }, (_, index) => ({ sourceRecordId: `r-${index}` }));
  const loader = async cursor => { const offset = cursor ? Number(cursor) : 0; const page = rows.slice(offset, offset + 500); const next = offset + page.length; return { records: page, hasMore: next < rows.length, nextCursor: String(next), scopedDocumentReads: page.length, completeness: next < rows.length ? 'page' : 'complete_stored_range' }; };
  const complete = await collectAllRecordPages(loader, 7000); assert.equal(complete.complete, true); assert.equal(complete.records.length, 6000);
  const overflow = await collectAllRecordPages(loader, 5000); assert.equal(overflow.complete, false); assert.equal(overflow.reason, 'record_limit_exceeded'); assert.equal(overflow.records.length, 5000);
  const repeated = await collectAllRecordPages(async () => ({ records: [{}], hasMore: true, nextCursor: 'same', completeness: 'page' }), 10); assert.equal(repeated.complete, false); assert.equal(repeated.reason, 'repeated_cursor');
});

test('scope IDs do not expose restaurant IDs and are tenant-specific', () => {
  assert.equal(scopeIdFor('restaurant-a').length, 64); assert.equal(scopeIdFor('restaurant-a').includes('restaurant-a'), false); assert.notEqual(scopeIdFor('restaurant-a'), scopeIdFor('restaurant-b'));
});

test('sync storage module is isolated from operational collections', () => {
  const source = require('node:fs').readFileSync(require.resolve('./_shift4-storage'), 'utf8');
  for (const forbidden of ['inventory','sales','shifts','timePunches','payroll','vendorOrders','dailyClose','ledger']) assert.equal(source.includes(`collection('${forbidden}')`), false, forbidden);
  assert.match(source, /posSyncScopes/); assert.match(source, /shift4Credentials/);
});
