'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const schedule = fs.readFileSync(path.join(root, 'src/features/schedule.jsx'), 'utf8');
const api = fs.readFileSync(path.join(root, 'api/time-off-request.js'), 'utf8');
const apiTest = fs.readFileSync(path.join(root, 'api/time-off-request.test.cjs'), 'utf8');

test('Request Off workflow uses server-backed manager list in addition to client listeners', () => {
  assert.match(schedule, /const \[workflowApiRequests, setWorkflowApiRequests\] = useState\(\[\]\)/);
  assert.match(schedule, /requestOffApi\('workflow-list', \{ startDate: workflowRequestRange\.start, endDate: workflowRequestRange\.end, dateFilter \}\)/);
  assert.match(schedule, /mergeRequestOffWorkflowRows\(timeOffRequests \|\| \[\], workflowDateScopedRequests \|\| \[\], workflowApiRequests \|\| \[\]\)/);
  assert.match(schedule, /workflowApiStatus === 'error'/);
});

test('Request Off workflow server list covers legacy workspace and date aliases', () => {
  assert.match(api, /if \(action === 'workflow-list'\) return handleWorkflowList\(ctx, body\)/);
  assert.match(api, /function sameWorkspaceRequest\(row = \{\}, restaurantId = ''\)/);
  assert.match(api, /\[row\.restaurantId, row\.workspaceId, row\.tenantId, row\.clientId\]/);
  assert.match(api, /row\.scheduleDateKey/);
  assert.match(api, /const workspaceFields = \['restaurantId', 'workspaceId', 'tenantId', 'clientId'\]/);
  assert.match(api, /publicRequestShape\(\{ \.\.\.row, restaurantId: ctx\.restaurantId/);
});

test('Request Off workflow regression covers admin visibility for all employees', () => {
  assert.match(apiTest, /manager workflow-list returns all workspace Request Off rows across legacy workspace and date fields/);
  assert.match(apiTest, /stale-restaurant-workspace-match/);
  assert.match(apiTest, /workflow-list requires Request Off manager access/);
});
