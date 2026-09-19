const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Request Off workflow client resolver recognizes legacy startDate without replacing architecture', () => {
  const schedule = read('src/features/schedule.jsx');
  assert.match(schedule, /const requestOffDateKey = \(request = \{\}\) => \{/);
  assert.match(schedule, /request\?\.date \|\| request\?\.requestDate \|\| request\?\.requestedDate \|\| request\?\.startDate \|\| request\?\.dateKey/);
  assert.match(schedule, /requestOffApi\('workflow-list', \{ startDate: workflowRequestRange\.start, endDate: workflowRequestRange\.end, dateFilter \}\)/);
  assert.match(schedule, /mergeRequestOffWorkflowRows\(timeOffRequests \|\| \[\], workflowDateScopedRequests \|\| \[\], workflowApiRequests \|\| \[\]\)/);
  assert.match(schedule, /const \[viewFilter, setViewFilter\] = useState\('needs-review'\)/);
  assert.match(schedule, /const \[dateFilter, setDateFilter\] = useState\('all'\)/);
});

test('Request Off workflow server resolver recognizes legacy startDate and behavior regression exists', () => {
  const api = read('api/time-off-request.js');
  const apiTest = read('api/time-off-request.test.cjs');
  assert.match(api, /function requestDateKey\(row = \{\}\) \{/);
  assert.match(api, /row\.date \|\| row\.requestDate \|\| row\.requestedDate \|\| row\.startDate \|\| row\.dateKey/);
  assert.match(api, /function workflowDateAllowed\(row = \{\}, range = \{\}\) \{[\s\S]{0,160}const date = requestDateKey\(row\);[\s\S]{0,160}return date >= range\.start && date <= range\.end;/);
  assert.match(api, /function publicRequestShape\(row = \{\}\) \{[\s\S]{0,900}date: requestDateKey\(row\)/);
  assert.match(apiTest, /manager workflow-list includes future legacy Request Off rows stored with startDate/);
  assert.match(apiTest, /legacy-startdate-request/);
  assert.match(apiTest, /legacy-workspace-startdate-request/);
  assert.match(apiTest, /wrong-workspace-startdate-request/);
});
