'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {fakeFirestore}=require('../test-tools/fakeFirestore.cjs');
const {cancelPublishedRows}=require('./_shift-change-cancellation.cjs');
const {recordPublication,headRef}=require('./_shift-change-review.cjs');
test('deleting a published shift atomically records a cancellation and retains the employee review version',async()=>{
  const row={id:'shift',restaurantId:'r',date:'2026-10-13',startTime:'09:00',endTime:'17:00',authUid:'employee',employeeId:'employee',rosterRoleId:'cook',isPublished:true},db=fakeFirestore({'shifts/shift':{...row}});
  const first=await db.runTransaction(async tx=>{await tx.get(headRef(db,'r','shift'));return recordPublication({db,tx,tenant:'r',shiftId:'shift',shift:row,operationId:'publish_1',actor:'manager',at:'today'});});
  assert.equal(await cancelPublishedRows({db,rows:[row],restaurantId:'r',ctx:{uid:'manager'}}),1);
  assert.equal(db.records.has('shifts/shift'),false);const head=db.records.get(headRef(db,'r','shift').path),event=db.records.get(`scheduleChangeEvents/${head.version}`);
  assert.notEqual(head.version,first.version);assert.equal(event.after.cancelled,true);assert.equal(event.before.cancelled,false);assert.deepEqual(event.recipientUids,['employee']);
});
test('a changed shift or foreign workspace aborts cancellation before any data is removed',async()=>{
  for(const patch of [{startTime:'11:00'},{restaurantId:'other'}]){
    const row={id:'shift',restaurantId:'r',startTime:'09:00',authUid:'employee'},db=fakeFirestore({'shifts/shift':{...row,...patch}});
    await assert.rejects(()=>cancelPublishedRows({db,rows:[row],restaurantId:'r',ctx:{uid:'manager'}}),error=>error.statusCode===409);assert.equal(db.records.has('shifts/shift'),true);assert.equal(db.writes.length,0);
  }
});

test('stable canonical and legacy tenant aliases retain published cancellation evidence in the authorized workspace',async()=>{
  for(const identity of [{workspaceId:'r'},{tenantId:'r'},{restaurantId:'retired',workspaceId:'r'}]){
    const row={id:'shift',...identity,date:'2026-10-13',startTime:'09:00',endTime:'17:00',authUid:'employee',isPublished:true};
    const db=fakeFirestore({'shifts/shift':row});
    assert.equal(await cancelPublishedRows({db,rows:[row],restaurantId:'r',ctx:{uid:'manager'}}),1);
    assert.equal(db.records.has('shifts/shift'),false);
    const head=db.records.get(headRef(db,'r','shift').path),event=db.records.get(`scheduleChangeEvents/${head.version}`);
    assert.equal(event.restaurantId,'r');assert.equal(event.after.cancelled,true);assert.deepEqual(event.recipientUids,['employee']);
    assert.equal(db.records.has(headRef(db,'retired','shift').path),false);
  }
});
test('tenant alias drift aborts the whole cancellation chunk even when another alias still matches',async()=>{
  const first={id:'first',restaurantId:'r',startTime:'09:00'},second={id:'second',restaurantId:'r',workspaceId:'r',startTime:'10:00'};
  for(const patch of [{workspaceId:'other'},{tenantId:'other'}]){
    const db=fakeFirestore({'shifts/first':first,'shifts/second':{...second,...patch}});
    await assert.rejects(()=>cancelPublishedRows({db,rows:[first,second],restaurantId:'r',ctx:{uid:'manager'}}),error=>error.statusCode===409&&error.code==='shift_workspace_changed');
    assert.equal(db.records.has('shifts/first'),true);assert.equal(db.records.has('shifts/second'),true);assert.equal(db.writes.length,0);
  }
});
