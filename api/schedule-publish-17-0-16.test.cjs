'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const service = require('./_schedule-publish-service.cjs');

test('authoritative result counts distinguish new publishes, visibility repairs, unchanged rows, and employee-review rows', () => {
  const plan = {
    candidates: [
      { id: 'new-1', alreadyPublished: false },
      { id: 'repair-1', alreadyPublished: true },
      { id: 'repair-2', alreadyPublished: true }
    ],
    unchangedShiftIds: ['current-1', 'current-2'],
    unresolvedEmployees: [{ shiftId: 'review-1', reason: 'unresolved-employee-reference' }]
  };
  const result = service.buildFinalPublicationCounts(plan, ['new-1', 'repair-2']);
  assert.deepEqual(result.verifiedNewShiftIds, ['new-1']);
  assert.deepEqual(result.verifiedRepairShiftIds, ['repair-2']);
  assert.equal(result.verifiedNewCount, 1);
  assert.equal(result.verifiedRepairCount, 1);
  assert.equal(result.unchangedCount, 2);
  assert.equal(result.unresolvedEmployeeCount, 1);
});

test('completion toast uses server-authoritative outcome counts instead of browser preflight estimates', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/features/schedule.jsx'), 'utf8');
  const start = source.indexOf('const notification = publishResult.notificationState || {};');
  const end = source.indexOf('publishCompleted = true;', start);
  assert.ok(start >= 0 && end > start, 'publish completion block exists');
  const completion = source.slice(start, end);
  assert.match(completion, /publishResult\.verifiedNewCount/);
  assert.match(completion, /publishResult\.verifiedRepairCount/);
  assert.match(completion, /publishResult\.unchangedCount/);
  assert.match(completion, /publishResult\.unresolvedEmployeeCount/);
  assert.doesNotMatch(completion, /if \(draftCount\)/);
  assert.doesNotMatch(completion, /if \(repairCount\)/);
  assert.match(completion, /Schedule Already Current/);
  assert.match(completion, /Publish Needs Employee Review/);
});
