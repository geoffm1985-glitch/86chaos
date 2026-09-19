'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { shiftIdentity, userMatchesRestaurant, baseShiftClassification, safeText } = require('./_orphan-shift-logic');

test('canonical shift identity prioritizes durable schedule identity', () => {
  assert.equal(shiftIdentity({ scheduleUserId: 'schedule-user', userId: 'legacy-user' }), 'schedule-user');
});

test('missing canonical identity is ambiguous and never an automatic delete candidate', () => {
  const result = baseShiftClassification({ restaurantId: 'rest-a', employeeName: 'Alex' }, 'shift-1');
  assert.equal(result.classification, 'ambiguous');
  assert.equal(result.terminal, true);
});

test('missing tenant identity is ambiguous', () => {
  const result = baseShiftClassification({ scheduleUserId: 'user-a' }, 'shift-2');
  assert.equal(result.classification, 'ambiguous');
});

test('user membership recognizes direct, workspace array, and active membership map relationships', () => {
  assert.equal(userMatchesRestaurant({ restaurantId: 'a' }, 'a'), true);
  assert.equal(userMatchesRestaurant({ workspaceIds: ['a'] }, 'a'), true);
  assert.equal(userMatchesRestaurant({ memberships: { a: { isActive: true } } }, 'a'), true);
  assert.equal(userMatchesRestaurant({ memberships: { a: { isActive: false } } }, 'a'), false);
});

test('error sanitizer redacts secret-like values', () => {
  assert.doesNotMatch(safeText('token=abc123 private_key=xyz'), /abc123|xyz/);
});
