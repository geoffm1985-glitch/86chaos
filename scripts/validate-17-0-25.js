#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const read=f=>fs.readFileSync(f,'utf8');
const json=f=>JSON.parse(read(f));
const pkg=json('package.json'),lock=json('package-lock.json'),version=json('public/version.json');
assert.equal(pkg.version,'17.0.25');
assert.equal(lock.version,pkg.version);
assert.equal(lock.packages[''].version,pkg.version);
assert.equal(version.version,pkg.version);
assert.equal(version.build,pkg.version);
assert.equal(version.releaseTitle,'Schedule Builder Delete Reliability and Delta Baseline Repair');
assert.equal(pkg.scripts['test:source'],'node scripts/validate-17-0-25.js');
assert.equal(pkg.scripts['validate:17.0.25'],'node scripts/validate-17-0-25.js');
assert(pkg.scripts['test:repair:17.0.25']?.includes('test:current-release-targeted'),'17.0.25 repair test uses current release targeted suite');
assert(pkg.scripts['test:play-store:delta']?.startsWith('npm run test:current-release-targeted &&'),'delta runs current release targeted regressions before scoped Playwright');

const schedule=read('src/features/schedule.jsx');
const deleteRoute=read('api/schedule-shift-delete.js');
assert(schedule.includes("secureFetch('/api/schedule-shift-delete'"),'Schedule Builder destructive shift deletes use the authenticated server route');
assert(!schedule.includes("scheduleShiftDeleteRequest('preview-month'"),'Clear Month avoids an extra server preview round-trip before confirmation');
assert(schedule.includes("scheduleShiftDeleteRequest('clear-month'"),'Clear Month uses authoritative server deletion');
assert(schedule.includes("scheduleShiftDeleteRequest('delete-single'"),'single shift chips use authoritative server deletion');
assert(!/deleteDoc\(doc\(db, ['\"]shifts['\"]/.test(schedule),'Schedule Builder no longer directly deletes shift documents from the browser');
assert(deleteRoute.includes("TENANT_FIELDS = ['restaurantId', 'workspaceId', 'tenantId']"),'delete route covers canonical and legacy tenant identity fields');
assert(deleteRoute.includes("action === 'clear-month'"),'delete route supports month clear');
assert(deleteRoute.includes("deleteSingleLogicalShift"),'delete route removes one logical shift and duplicate records');
assert(deleteRoute.includes("requiredPermissions: ['schedule']"),'delete route stays inside Schedule Builder schedule permission authority');
assert(deleteRoute.includes('Promise.all(TENANT_FIELDS.map'),'legacy tenant reads run in parallel for faster deletes');
assert(deleteRoute.includes('remainingCount: 0'),'successful batch commits do not trigger redundant full-tenant verification rescans');
assert(schedule.includes('optimisticOperationId'),'Schedule Builder hides confirmed delete targets immediately while the server mutation completes');

const delta=read('scripts/86chaos-release-gate/failed-only-manifest-utils.cjs');
assert(delta.includes('recoveredSourceVersion'),'delta baseline recovers source version from surviving run evidence');
assert(delta.includes('recoveredDeployedVersion'),'delta baseline recovers deployed version from surviving deployment evidence');
assert(delta.includes('A clean full baseline with zero FAIL/TIMEOUT rows is still a valid delta baseline.'),'delta accepts a clean completed full baseline');
assert(!/return generated\.selected\.length > 0;/.test(delta),'clean full baselines are not discarded just because they have zero failures');

// Preserve the 17.0.23 Request Off policy and 17.0.24 Clear Month control.
const timeOffRoute=read('api/time-off-request.js');
const policy=read('src/core/timeOffPolicy.js');
assert(schedule.includes("requestOffApi('policy-save'"),'Request Off policy UI remains present');
assert(timeOffRoute.includes("action === 'policy-save'"),'protected Request Off policy API remains present');
assert(!/permissions\?\.(?:schedule|team|settings)/.test(policy),'Request Off policy configuration authority remains owner/admin only');
assert(schedule.includes('data-chaos-workflow-id="schedule-clear-month"'),'Clear Month control remains present');

for(const file of ['src/core/appCore.js','api/_version.js','api/_pos-bridge-config.js']) assert(read(file).includes("'17.0.25'"),`${file} carries 17.0.25`);
for(const file of ['test-tools/certification/groups.json','test-tools/regressions/registry.json','test-tools/certification/cost-performance-baselines.json']) assert.equal(json(file).release,pkg.version);
console.log('17.0.25 Schedule Builder delete reliability and delta baseline repair validation passed; this does not certify the release.');
