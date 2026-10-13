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
