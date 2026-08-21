const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Request Off workflow date filters load the selected month or custom range directly', () => {
  const schedule = read('src/features/schedule.jsx');
  assert.match(schedule, /const workflowDateScopedRequests = useLiveCollection\('timeOffRequests'/);
  assert.match(schedule, /whereClauses: \[\['date', '>=', workflowRequestRange\.start\], \['date', '<=', workflowRequestRange\.end\]\]/);
  assert.match(schedule, /debugLabel: `schedule:request-off-workflow:\$\{dateFilter\}`/);
  assert.match(schedule, /mergeRequestOffWorkflowRows\(timeOffRequests \|\| \[\], workflowDateScopedRequests \|\| \[\], workflowApiRequests \|\| \[\]\)/);
  assert.match(schedule, /if \(dateFilter === 'next-month'\)[\s\S]{0,160}d\.setDate\(1\);[\s\S]{0,160}d\.setMonth\(d\.getMonth\(\)\+1\)/);
  assert.match(schedule, /return startKey <= endKey \? \{ start: startKey, end: endKey \} : \{ start: endKey, end: startKey \}/);
});

test('Request Off workflow filters compare normalized request date aliases', () => {
  const schedule = read('src/features/schedule.jsx');
  assert.match(schedule, /const requestOffDateKey = \(request = \{\}\) => \{/);
  assert.match(schedule, /request\?\.requestDate/);
  assert.match(schedule, /request\?\.requestedDate/);
  assert.match(schedule, /const requestDate = requestOffDateKey\(r\);/);
  assert.match(schedule, /requestDate >= range\.start && requestDate <= range\.end/);
  assert.match(schedule, /new Date\(requestOffDateKey\(a\) \|\| 0\)/);
  assert.match(schedule, /formatRequestDateLabel\(requestOffDateKey\(r\) \|\| r\.date\)/);
});
