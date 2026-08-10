'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Request Off manager employee choices preserve request-subject fallback without actor-field identity', () => {
  const source = read('src/features/schedule.jsx');
  assert.match(source, /buildRequestOffSubjectFallbackPerson/);
  assert.match(source, /requestOffSubjectIdFields/);
  assert.match(source, /source: 'request-off-subject-fallback'/);
  assert.match(source, /requestOffSubjectEmailFields|requestOffSubjectNameFields/);
  for (const field of ['approvedBy','deniedBy','archivedBy','processedBy','updatedBy']) {
    const idx = source.indexOf('buildRequestOffSubjectFallbackPerson');
    const body = source.slice(idx, idx + 1600);
    assert.equal(body.includes(field), false, `${field} must not be used as request subject identity`);
  }
  assert.match(source, /scheduleRoleOptions|role-grouped|role/i);
});

test('Request Off QA reset remains server-side, test-project gated, and exact-fixture only', () => {
  const route = read('api/full-audit-qa-seed.js');
  const spec = read('tests/e2e/schedule-request-off-management.spec.cjs');
  assert.match(route, /reset-request-off-fixture/);
  assert.match(route, /chaos-test-d1601/);
  assert.match(route, /employeeKey[\s\S]{0,600}allen[\s\S]{0,600}sara|allowedRequestOffResetEmployees/);
  assert.match(route, /qaOwned/);
  assert.match(route, /qaRunId/);
  assert.match(route, /restaurantId/);
  assert.match(route, /approved/);
  assert.match(route, /pending/);
  assert.doesNotMatch(route, /body\.collection|body\.patch|body\.status\s*\|\|/);
  assert.match(spec, /reset-request-off-fixture/);
  assert.match(spec, /signInAccount/);
  assert.doesNotMatch(spec, /signInOwner|initFirebase\(\)|signInWithEmailAndPassword|getDoc\(|updateDoc\(/);
});
