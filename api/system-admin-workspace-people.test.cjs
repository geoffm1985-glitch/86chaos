'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { safeWorkspace, safeUser } = require('./system-admin-safe-rows.cjs');

function doc(id, data) { return { id, data: () => data }; }

test('System Admin workspace roster response is sanitized and deterministic', () => {
  const row = safeWorkspace(doc('restaurant_b', { name: 'Bravo', ownerEmail: 'owner@example.com', apiKey: 'secret', serviceAccount: 'nope', isActive: true }));
  assert.equal(row.id, 'restaurant_b');
  assert.equal(row.name, 'Bravo');
  assert.equal(row.ownerEmail, 'owner@example.com');
  assert.equal(Object.prototype.hasOwnProperty.call(row, 'apiKey'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(row, 'serviceAccount'), false);
});

test('System Admin exact people search row exposes safe target evidence only', () => {
  const row = safeUser(doc('userDoc123', { name: 'Allen QA', email: 'Allen@Example.com', authUid: 'auth123', restaurantId: 'qa_restaurant', workspaceIds: ['qa_restaurant'], archived: false }));
  assert.equal(row.id, 'userDoc123');
  assert.equal(row.authUid, 'auth123');
  assert.equal(row.email, 'allen@example.com');
  assert.equal(row.restaurantId, 'qa_restaurant');
  assert.equal(row.isActive, true);
});

test('System Admin exact people search marks archived users inactive', () => {
  const row = safeUser(doc('oldUser', { name: 'Old Allen', email: 'old@example.com', archived: true, restaurantId: 'qa_restaurant' }));
  assert.equal(row.isActive, false);
});
