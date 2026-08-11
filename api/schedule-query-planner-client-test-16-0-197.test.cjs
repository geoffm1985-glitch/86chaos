'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const root = path.resolve(__dirname, '..');

test('client Schedule Query Planner test expects canonical scheduleUserId primary query', () => {
  const source = fs.readFileSync(path.join(root, 'src/core/scheduleQueryPlanner.test.js'), 'utf8');
  assert.match(source, /staff My Schedule uses canonical scheduleUserId primary query plus outer schedule weeks/);
  assert.match(source, /toContainEqual\(\['scheduleUserId', '==', 'sched_u1'\]\)/);
  assert.doesNotMatch(source, /not\.toContainEqual\(\['scheduleUserId', '==', 'sched_u1'\]\)/);
  assert.match(source, /expect\(plan\.shiftLimit\)\.toBe\(120\)/);
});
