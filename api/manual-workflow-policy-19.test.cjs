'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {workflowEvents,verifyManualWorkflows}=require('../scripts/verify-manual-workflows.cjs');
test('every tracked workflow requires explicit dispatch before Actions can run',()=>{
  assert.deepEqual(verifyManualWorkflows().sort(),['mobile-targeted-gate.yml','testing-targeted-delta.yml']);
});
test('workflow policy recognizes object, array and scalar trigger forms',()=>{
  for(const source of ['on: push\n','on: [push, workflow_dispatch]\n','on:\n  push:\n  workflow_dispatch:\n'])assert.ok(workflowEvents(source).includes('push'));
  assert.deepEqual(workflowEvents('on:\n  workflow_dispatch:\n'),['workflow_dispatch']);
  assert.deepEqual(workflowEvents('on: [schedule, workflow_dispatch]\n'),['schedule','workflow_dispatch']);
});
