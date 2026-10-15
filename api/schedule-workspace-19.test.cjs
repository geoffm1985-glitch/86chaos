'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const rules=require('../src/core/scheduleWorkspace.shared.js');
const {editScheduleWorkspace,readScheduleWorkspace,readScheduleWeek}=require('./_schedule-workspace.cjs');
const {prepareScheduleClear,advanceScheduleClear}=require('./_schedule-clear-workspace.cjs');
test('browser cleanup hook verifies only owned shifts and reports authoritative removal',async()=>{
  const fs=require('node:fs'),vm=require('node:vm');
  const filename=require.resolve('../tests/fixtures/schedule-builder-phase1-scenarios.cjs');
  const sandbox={module:{exports:{}},require:name=>name==='@playwright/test'?{expect:value=>({toBe:expected=>assert.equal(value,expected)})}:name.startsWith('node:')?require(name):name.includes('audit-helpers')?{}:rules};
  vm.runInNewContext(fs.readFileSync(filename,'utf8')+'\nmodule.exports.scenariosForTest=scenarios;',sandbox,{filename});
  const row={id:'qa_owned_shift',restaurantId:'qa_fixture',date:'2026-10-15',employeeId:'qa_employee',startTime:'16:00',endTime:'21:00',revision:2};
  const requests=[],events=[];let exists=true;
  const page={unroute:async path=>events.push(path),request:{post:async(url,options)=>{
    requests.push({url,body:options.data});
    if(options.data.action==='read')return{status:()=>200,json:async()=>({authoritative:true,shifts:[exists?row:{id:row.id,exists:false}]})};
    exists=false;return{status:()=>200};
  }}};
  const ctx={seed:{restaurantId:'qa_fixture'},headers:{authorization:'Bearer fixture-only'},ids:new Set([row.id])};
  sandbox.module.exports.scenariosForTest.set(page,ctx);
  let attachment;
  await sandbox.module.exports.cleanupScenario({page,context:{setOffline:async value=>events.push(value)}},{attach:async(name,options)=>{attachment={name,body:JSON.parse(options.body)};}});
  assert.deepEqual(events,[false,'**/api/schedule-workspace','**/google.firestore.v1.Firestore/Listen/channel**']);assert.equal(requests.length,3);
  assert.equal(requests[1].body.changes.length,1);assert.equal(requests[1].body.changes[0].id,row.id);
  assert.equal(requests[1].body.changes[0].expected,rules.workspaceEvidence(row));
  assert.deepEqual(attachment,{name:'phase1-workflow-cleanup',body:{ownedShiftCount:1,remaining:0,authoritative:true}});
  assert.equal(sandbox.module.exports.scenariosForTest.has(page),false);
});
test('browser cleanup cannot claim success when its authoritative read is refused',async()=>{
  const fs=require('node:fs'),vm=require('node:vm');
  const filename=require.resolve('../tests/fixtures/schedule-builder-phase1-scenarios.cjs');
  const sandbox={module:{exports:{}},require:name=>name==='@playwright/test'?{expect:value=>({toBe:expected=>assert.equal(value,expected)})}:name.startsWith('node:')?require(name):name.includes('audit-helpers')?{}:rules};
  vm.runInNewContext(fs.readFileSync(filename,'utf8')+'\nmodule.exports.scenariosForTest=scenarios;',sandbox,{filename});
  let attached=false,writes=0;
  const page={unroute:async()=>{},request:{post:async()=>{writes++;return{status:()=>403};}}};
  sandbox.module.exports.scenariosForTest.set(page,{seed:{restaurantId:'qa_fixture'},headers:{},ids:new Set(['qa_owned_shift'])});
  await assert.rejects(sandbox.module.exports.cleanupScenario({page,context:{setOffline:async()=>{}}},{attach:async()=>{attached=true;}}));
  assert.equal(writes,1);assert.equal(attached,false);
});
function fixture() {
  const store=new Map([
    ['restaurants/tenant',{systemSettings:{timezone:'America/Chicago'}}],
    ['users/employee_a',{restaurantId:'tenant',name:'Alex',email:'alex@example.test',isActive:true,authUid:'employee_a',role:'Cook'}],
    ['users/employee_b',{restaurantId:'tenant',name:'Blair',email:'blair@example.test',isActive:true,authUid:'employee_b',role:'Cook'}],
    ['roles/cook_role',{restaurantId:'tenant',name:'Cook'}]
  ]);
  let writes=0,tail=Promise.resolve();
  const reference=(name,id)=>({path:name+'/'+id,id});
  const collection=(name,filters=[],maximum=Infinity)=>({name,filters,maximum,doc:id=>reference(name,id || 'auto_'+Math.random().toString(36).slice(2)),where:(field,op,value)=>collection(name,[...filters,[field,op,value]],maximum),limit:n=>collection(name,filters,n)});
  const snapshot=(ref)=>({id:ref.id,ref,exists:store.has(ref.path),data:()=>structuredClone(store.get(ref.path))});
  const db={collection,runTransaction:async callback=>{
    const before=tail;let unlock;tail=new Promise(resolve=>{unlock=resolve;});await before;
    const pending=[];let writing=false;
    const tx={get:async ref=>{assert.equal(writing,false,'all transaction reads precede writes');if(ref.path)return snapshot(ref);const docs=[...store].filter(([key,row])=>key.split('/')[0]===ref.name && ref.filters.every(([field,op,value])=>op==='=='?row[field]===value:op==='>='?row[field]>=value:row[field]<=value)).slice(0,ref.maximum).map(([key])=>snapshot(reference(ref.name,key.split('/')[1])));return {docs};},create:(ref,row)=>{writing=true;pending.push(()=>{assert.equal(store.has(ref.path),false);store.set(ref.path,structuredClone(row));});},update:(ref,row)=>{writing=true;pending.push(()=>store.set(ref.path,{...store.get(ref.path),...structuredClone(row)}));},set:(ref,row)=>{writing=true;pending.push(()=>store.set(ref.path,structuredClone(row)));},delete:ref=>{writing=true;pending.push(()=>store.delete(ref.path));}};
    try{const result=await callback(tx);pending.forEach(commit=>{commit();writes++;});return result;}finally{unlock();}
  }};
  const ctx={uid:'manager_a',restaurantId:'tenant',user:{},permissions:{schedule:true}};
  const patch={date:'2026-10-20',startTime:'16:00',endTime:'21:00',employeeId:'employee_a',rosterRoleId:'cook_role',notes:'Dinner',station:'',isOpenShift:false,breakMinutes:30,paidBreak:false};
  const request=(changes,operationId='operation_create_123')=>({restaurantId:'tenant',operationId,changes,acknowledgedWarnings:true});
  const execute=body=>editScheduleWorkspace({db,ctx,body,clock:()=>new Date('2026-10-14T12:00:00Z')});
  return {store,db,ctx,patch,request,execute,writes:()=>writes};
}

test('verified week read merges canonical identities, bounds scope and never returns private fields or writes',async()=>{
  const f=fixture();
  f.store.set('shifts/date_only',{restaurantId:'tenant',date:'2026-10-20',hourlyRate:999,privateNotificationToken:'secret'});
  f.store.set('shifts/canonical_only',{restaurantId:'tenant',scheduleDateKey:'2026-10-21'});
  f.store.set('shifts/outside',{restaurantId:'tenant',date:'2026-11-20'});
  f.store.set('shifts/other',{restaurantId:'other',date:'2026-10-20'});
  for(const [id,flags] of Object.entries({cancelled:{cancelledAt:'2026-10-14T12:00:00Z'},archived:{archived:true},deleted:{deletedAt:'2026-10-14T12:00:00Z'},status:{status:'canceled'}}))f.store.set('shifts/inactive_'+id,{restaurantId:'tenant',date:'2026-10-20',...flags});
  const result=await readScheduleWeek({db:f.db,ctx:f.ctx,body:{restaurantId:'tenant',weekStart:'2026-10-19'}});
  assert.equal(result.authoritative,true);assert.equal(result.dateStart,'2026-10-18');assert.equal(result.dateEnd,'2026-10-26');
  assert.deepEqual(result.shifts.map(row=>row.id).sort(),['canonical_only','date_only']);
  assert.equal(JSON.stringify(result).includes('secret'),false);assert.equal(JSON.stringify(result).includes('hourlyRate'),false);assert.equal(f.writes(),0);
  const empty=await readScheduleWeek({db:f.db,ctx:f.ctx,body:{restaurantId:'tenant',weekStart:'2027-01-04'}});assert.deepEqual(empty.shifts,[]);assert.equal(empty.authoritative,true);
  await assert.rejects(readScheduleWeek({db:f.db,ctx:f.ctx,body:{restaurantId:'other',weekStart:'2026-10-19'}}),e=>e.statusCode===403);
  await assert.rejects(readScheduleWeek({db:f.db,ctx:{...f.ctx,permissions:{}},body:{restaurantId:'tenant',weekStart:'2026-10-19'}}),e=>e.statusCode===403);
  await assert.rejects(readScheduleWeek({db:f.db,ctx:f.ctx,body:{restaurantId:'tenant',weekStart:'2026-10-20'}}),e=>e.code==='invalid_week');
});

test('verified week refuses truncated or conflicting tenant evidence',async()=>{
  const f=fixture();
  for(let n=0;n<5001;n++)f.store.set('shifts/bulk_'+n,{restaurantId:'tenant',date:'2026-10-20'});
  await assert.rejects(readScheduleWeek({db:f.db,ctx:f.ctx,body:{restaurantId:'tenant',weekStart:'2026-10-19'}}),e=>e.code==='incomplete_context');
  f.store.clear();f.store.set('shifts/conflicting',{restaurantId:'tenant',workspaceId:'foreign',date:'2026-10-20'});
  await assert.rejects(readScheduleWeek({db:f.db,ctx:f.ctx,body:{restaurantId:'tenant',weekStart:'2026-10-19'}}),e=>e.code==='workspace_mismatch');assert.equal(f.writes(),0);
});
test('calendar editing preserves week boundaries, overnight time and DST evidence',()=>{
  assert.deepEqual(rules.workspaceWeek('2027-01-01'),['2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02','2027-01-03']);
  assert.equal(rules.workspaceInterval({date:'2026-10-20',startTime:'22:00',endTime:'02:00'}).hours,4);
  assert.throws(()=>rules.workspaceInterval({date:'2026-03-08',startTime:'02:30',endTime:'04:00'}),/does not exist/);
  const repeated=rules.workspaceInterval({date:'2026-11-01',startTime:'01:30',endTime:'02:30'});
  assert.equal(repeated.ambiguous,true);assert.equal(repeated.hours,2);
  assert.equal(rules.workspaceInterval({date:'2026-11-01',startTime:'00:00',endTime:'24:00',fullDay:true}).hours,25);
  assert.throws(()=>rules.workspaceInterval({date:'2026-10-20',startTime:'16:00',endTime:'CLOSE'}),/Configure operating hours/);
  assert.equal(rules.workspaceInterval({date:'2026-10-20',startTime:'16:00',endTime:'CLOSE'},{timezone:'America/Chicago',closingTime:'02:00'}).hours,10);
});
test('create retry is idempotent and cannot overwrite a subsequently published shift',async()=>{
  const f=fixture(),body=f.request([{kind:'create',patch:f.patch}]);
  const first=await f.execute(body),id=first.results[0].id;
  f.store.set('shifts/'+id,{...f.store.get('shifts/'+id),isPublished:true,revision:8,notes:'Newer legitimate work'});
  const writes=f.writes();assert.equal((await f.execute(body)).duplicate,true);assert.equal(f.writes(),writes);assert.equal(f.store.get('shifts/'+id).notes,'Newer legitimate work');
  await assert.rejects(f.execute({...body,changes:[{kind:'create',patch:{...f.patch,notes:'Changed retry'}}]}),error=>error.code==='operation_reused');
});
test('edits, bulk copies, delete recovery and redo use new revisions without destroying history',async()=>{
  const f=fixture(),created=await f.execute(f.request([{kind:'create',patch:f.patch}]));
  const first=created.results[0];
  const edited=await f.execute(f.request([{kind:'update',id:first.id,expected:rules.workspaceEvidence(first.after),patch:{notes:'Updated dinner'}}],'operation_edit_123'));
  assert.equal(edited.results[0].after.revision,2);
  const undone=await f.execute({restaurantId:'tenant',operationId:'operation_undo_123',undoOf:edited.operationId,acknowledgedWarnings:true});
  assert.equal(undone.results[0].after.notes,'Dinner');assert.equal(undone.results[0].after.revision,3);
  const redone=await f.execute({restaurantId:'tenant',operationId:'operation_redo_123',undoOf:undone.operationId,acknowledgedWarnings:true});
  assert.equal(redone.results[0].after.notes,'Updated dinner');assert.equal(redone.results[0].after.revision,4);
  const removed=await f.execute(f.request([{kind:'delete',id:first.id,expected:rules.workspaceEvidence(redone.results[0].after)}],'operation_delete_123'));
  assert.equal(f.store.has('shifts/'+first.id),false);
  const restored=await f.execute({restaurantId:'tenant',operationId:'operation_restore_123',undoOf:removed.operationId,acknowledgedWarnings:true});
  assert.equal(restored.results[0].after.revision,6);assert.equal(f.store.get('shifts/'+first.id).notes,'Updated dinner');
  assert.ok([...f.store.keys()].filter(key=>key.startsWith('scheduleEditOperations/')).length>=6);
});
test('concurrent edits have one winner and stale undo cannot overwrite it',async()=>{
  const f=fixture(),created=await f.execute(f.request([{kind:'create',patch:f.patch}]));const row=created.results[0];
  const changes=notes=>[{kind:'update',id:row.id,expected:rules.workspaceEvidence(row.after),patch:{notes}}];
  const results=await Promise.allSettled([f.execute(f.request(changes('First'),'operation_first_123')),f.execute(f.request(changes('Second'),'operation_second_123'))]);
  assert.equal(results.filter(row=>row.status==='fulfilled').length,1);assert.equal(results.find(row=>row.status==='rejected').reason.code,'shift_changed');
  await assert.rejects(f.execute({restaurantId:'tenant',operationId:'operation_stale_123',undoOf:created.operationId,acknowledgedWarnings:true}),error=>error.code==='shift_changed');
  assert.equal(f.store.get('shifts/'+row.id).notes,'First');
});
test('hard conflicts, unverified qualifications and payroll fields cannot commit',async()=>{
  const f=fixture();await f.execute(f.request([{kind:'create',patch:f.patch}]));const before=f.writes();
  await assert.rejects(f.execute(f.request([{kind:'create',patch:f.patch}],'operation_overlap_123')),error=>error.findings?.some(row=>row.code==='overlap'));
  await assert.rejects(f.execute(f.request([{kind:'create',patch:{...f.patch,date:'2026-10-21',station:'Grill'}}],'operation_station_123')),error=>error.findings?.some(row=>row.code==='station_qualification'));
  await assert.rejects(f.execute(f.request([{kind:'create',patch:{...f.patch,hourlyRate:999}}],'operation_payroll_123')),error=>error.code==='unsupported_field');
  f.store.set('timeOffRequests/leave',{restaurantId:'tenant',employeeId:'employee_a',date:'2026-10-21',status:'approved'});
  await assert.rejects(f.execute(f.request([{kind:'create',patch:{...f.patch,date:'2026-10-21'}}],'operation_leave_123')),error=>error.findings?.some(row=>row.code==='approved_time_off'));
  assert.equal(f.writes(),before);
});
test('published edits and cancellation require confirmation and preserve immutable change events',async()=>{
  const f=fixture(),created=await f.execute(f.request([{kind:'create',patch:f.patch}]));const id=created.results[0].id;
  const current={...f.store.get('shifts/'+id),isPublished:true,published:true,status:'published',scheduleId:'published_schedule'};f.store.set('shifts/'+id,current);
  const body=f.request([{kind:'update',id,expected:rules.workspaceEvidence(current),patch:{notes:'Published change'}}],'operation_published_123');
  await assert.rejects(f.execute(body),error=>error.code==='published_review_required');
  const result=await f.execute({...body,confirmedPublished:true,reason:'Manager reviewed shift change'});
  assert.equal(result.events.length,1);assert.equal(result.results[0].after.isPublished,true);
  const events=[...f.store].filter(([path])=>path.startsWith('scheduleChangeEvents/'));
  assert.equal(events[0][1].before.notes,'Dinner');assert.equal(events[0][1].after.notes,'Published change');
  const removed=await f.execute({...f.request([{kind:'delete',id,expected:rules.workspaceEvidence(result.results[0].after)}],'operation_cancel_123'),confirmedPublished:true,reason:'Employee call out reviewed'});
  const restored=await f.execute({restaurantId:'tenant',operationId:'operation_restorepub_123',undoOf:removed.operationId,acknowledgedWarnings:true,confirmedPublished:true,reason:'Manager reviewed restoration'});
  assert.equal(restored.results[0].after.isPublished,true);assert.equal([...f.store.keys()].filter(key=>key.startsWith('scheduleChangeEvents/')).length,3);
  assert.deepEqual(f.store.get(events[0][0]),events[0][1]);
});
test('no-op saves do not write and cross-workspace edits are refused',async()=>{
  const f=fixture(),created=await f.execute(f.request([{kind:'create',patch:f.patch}]));const row=created.results[0],count=f.writes();
  const noop=await f.execute(f.request([{kind:'update',id:row.id,expected:rules.workspaceEvidence(row.after),patch:{notes:'Dinner'}}],'operation_noop_123'));
  assert.equal(noop.noChange,true);assert.equal(f.writes(),count);
  await assert.rejects(f.execute({...f.request([{kind:'delete',id:row.id,expected:rules.workspaceEvidence(row.after)}]),restaurantId:'other'}),error=>error.statusCode===403);
});

test('older deletion recovery cannot cross a newer delete and restore cycle',async()=>{
  const f=fixture(),created=await f.execute(f.request([{kind:'create',patch:f.patch}]));
  const row=created.results[0];
  const deleted=await f.execute(f.request([{kind:'delete',id:row.id,expected:rules.workspaceEvidence(row.after)}],'delete_first_cycle'));
  const restored=await f.execute({restaurantId:'tenant',operationId:'restore_first_cycle',undoOf:deleted.operationId,acknowledgedWarnings:true});
  await f.execute(f.request([{kind:'delete',id:row.id,expected:rules.workspaceEvidence(restored.results[0].after)}],'delete_second_cycle'));
  const count=f.writes();
  await assert.rejects(f.execute({restaurantId:'tenant',operationId:'restore_obsolete_cycle',undoOf:deleted.operationId,acknowledgedWarnings:true}),error=>error.code==='shift_changed');
  assert.equal(f.store.has('shifts/'+row.id),false);assert.equal(f.writes(),count);
});

test('replaying a receipt returns current authoritative rows including subsequent deletion',async()=>{
  const f=fixture(),body=f.request([{kind:'create',patch:f.patch}]),created=await f.execute(body),row=created.results[0];
  const edited=await f.execute(f.request([{kind:'update',id:row.id,expected:rules.workspaceEvidence(row.after),patch:{notes:'Newest notes'}}],'edit_after_receipt'));
  const replay=await f.execute(body);
  assert.equal(replay.results[0].after.notes,'Dinner','historical receipt remains immutable');
  assert.equal(replay.currentResults[0].after.notes,'Newest notes');
  await f.execute(f.request([{kind:'delete',id:row.id,expected:rules.workspaceEvidence(edited.results[0].after)}],'delete_after_receipt'));
  assert.equal((await f.execute(body)).currentResults[0].after,null);
});

test('authoritative read enforces permissions, tenant aliases and wage privacy',async()=>{
  const f=fixture(),created=await f.execute(f.request([{kind:'create',patch:f.patch}])),id=created.results[0].id;
  f.store.set('shifts/'+id,{...f.store.get('shifts/'+id),hourlyRate:999,privateToken:'do-not-return'});
  f.store.set('shifts/foreign_shift',{restaurantId:'other',workspaceId:'other'});
  f.store.set('shifts/drifted_shift',{restaurantId:'tenant',workspaceId:'other'});
  const body={restaurantId:'tenant',ids:[id,'foreign_shift','missing_shift','drifted_shift']};
  const result=await readScheduleWorkspace({db:f.db,ctx:f.ctx,body});
  assert.equal(result.authoritative,true);assert.equal(result.shifts[0].notes,'Dinner');
  assert.equal('hourlyRate' in result.shifts[0],false);assert.equal('privateToken' in result.shifts[0],false);
  for(const row of result.shifts.slice(1))assert.deepEqual(row,{id:row.id,exists:false});
  await assert.rejects(readScheduleWorkspace({db:f.db,ctx:{...f.ctx,permissions:{}},body}),error=>error.statusCode===403);
  await assert.rejects(readScheduleWorkspace({db:f.db,ctx:f.ctx,body:{...body,restaurantId:'other'}}),error=>error.statusCode===403);
  await assert.rejects(f.execute(f.request([{kind:'delete',id:'drifted_shift',expected:rules.workspaceEvidence(f.store.get('shifts/drifted_shift'))}],'delete_drifted_shift')),error=>error.code==='shift_unavailable');
});

test('published no-op saves require neither compensating history nor publication confirmation',async()=>{
  const f=fixture(),created=await f.execute(f.request([{kind:'create',patch:f.patch}])),id=created.results[0].id;
  const current={...f.store.get('shifts/'+id),isPublished:true,published:true};f.store.set('shifts/'+id,current);
  const count=f.writes();const result=await f.execute(f.request([{kind:'update',id,expected:rules.workspaceEvidence(current),patch:{notes:'Dinner'}}],'published_noop_save'));
  assert.equal(result.noChange,true);assert.equal(f.writes(),count);
});

test('backwards clocks require explicit overnight intent and Timestamp evidence is canonical',()=>{
  const shift={date:'2026-10-20',startTime:'10 PM',endTime:'3 PM'};
  assert.throws(()=>rules.workspaceInterval(shift),/precedes start/);
  assert.equal(rules.workspaceInterval({...shift,endsNextDay:true}).hours,17);
  assert.throws(()=>rules.workspaceInterval({...shift,endTime:'11 PM',endsNextDay:true}),/next-day finish/);
  const stamp=new Date('2026-10-14T12:00:00.123Z'),row={date:'2026-10-20',updatedAt:stamp};
  assert.equal(rules.workspaceEvidence(row),rules.workspaceEvidence({...row,updatedAt:{seconds:Math.floor(stamp.getTime()/1000),nanoseconds:123000000}}));
  assert.equal(rules.workspaceEvidence(row),rules.workspaceEvidence({...row,updatedAt:{toDate:()=>stamp}}));
});

test('server snapshot reconciliation honors empty results, revisions and truncated evidence',()=>{
  const old={id:'shift_a',date:'2026-10-20',revision:2,updatedAt:'2026-10-14T12:00:00Z'},outside={id:'outside',date:'2026-11-20'};
  const ready=data=>({data,resolved:true,stale:false,error:null}),scope={start:'2026-10-19',end:'2026-10-25',maximum:3};
  assert.deepEqual(rules.workspaceMergeSnapshots([old,outside],[ready([]),ready([])],scope),[outside]);
  assert.deepEqual(rules.workspaceMergeSnapshots([old],[{...ready([]),stale:true}],scope),[old]);
  const newer={...old,revision:3,notes:'Current'};
  assert.deepEqual(rules.workspaceMergeSnapshots([old],[ready([newer]),ready([old])],scope),[newer]);
  assert.equal(rules.workspaceSnapshotReady(ready([old,old,old]),3),false,'hitting the bound is not complete evidence');
});

test('reviewed month clear freezes identities, resumes bounded chunks and restores safely',async()=>{
  const f=fixture();
  const created=await f.execute(f.request(Array.from({length:101},(_,index)=>({kind:'create',patch:{...f.patch,isOpenShift:true,employeeId:'',notes:'Slot '+index}})),'create_review_month'));
  const review=await prepareScheduleClear({db:f.db,ctx:f.ctx,restaurantId:'tenant',month:'2026-10',rows:created.results.map(row=>row.after)});
  await f.execute(f.request([{kind:'create',patch:{...f.patch,isOpenShift:true,employeeId:'',notes:'Created after review'}}],'create_after_review'));
  const clearBody={restaurantId:'tenant',action:'clear-month',reviewId:review.reviewId,confirmed:true,reason:'Reviewed month clear'};
  const clear=body=>advanceScheduleClear({db:f.db,ctx:f.ctx,body});
  const first=await clear(clearBody);assert.equal(first.done,false);assert.equal(first.deletedCount,100);assert.equal(first.remainingCount,1);
  const second=await clear(clearBody);assert.equal(second.done,true);assert.equal(second.deletedCount,101);
  assert.equal([...f.store.keys()].filter(path=>path.startsWith('shifts/')).length,1,'newly added shift was not in the reviewed scope');
  const count=f.writes();assert.equal((await clear(clearBody)).done,true);assert.equal(f.writes(),count,'completed retries do not mutate');
  const restoreBody={...clearBody,action:'restore-cleared-month',reason:'Reviewed month restoration'};
  assert.equal((await clear(restoreBody)).done,false);const restored=await clear(restoreBody);assert.equal(restored.done,true);assert.equal(restored.restoredCount,101);
  assert.equal([...f.store.keys()].filter(path=>path.startsWith('shifts/')).length,102);
  await assert.rejects(clear(clearBody),error=>error.code==='review_finished');
});

test('partial month clear refuses a changed later chunk and permits recovery of committed chunks',async()=>{
  const f=fixture(),created=await f.execute(f.request(Array.from({length:101},(_,index)=>({kind:'create',patch:{...f.patch,isOpenShift:true,employeeId:'',notes:'Partial slot '+index}})),'create_partial_month'));
  const review=await prepareScheduleClear({db:f.db,ctx:f.ctx,restaurantId:'tenant',month:'2026-10',rows:created.results.map(row=>row.after)});
  const body={restaurantId:'tenant',action:'clear-month',reviewId:review.reviewId,confirmed:true,reason:'Reviewed partial clear'};
  const advance=body=>advanceScheduleClear({db:f.db,ctx:f.ctx,body});await advance(body);
  const last=created.results.at(-1);await f.execute(f.request([{kind:'update',id:last.id,expected:rules.workspaceEvidence(last.after),patch:{notes:'Newer manager edit'}}],'edit_after_review'));
  await assert.rejects(advance(body),error=>error.code==='shift_changed');
  const restored=await advance({...body,action:'restore-cleared-month',reason:'Recover committed clear chunks'});
  assert.equal(restored.done,true);assert.equal(restored.restoredCount,100);assert.equal(f.store.get('shifts/'+last.id).notes,'Newer manager edit');
  assert.equal([...f.store.keys()].filter(path=>path.startsWith('shifts/')).length,101);
});

test('month review identity, actor and reason cannot be substituted',async()=>{
  const f=fixture(),created=await f.execute(f.request([{kind:'create',patch:f.patch}]));
  await assert.rejects(prepareScheduleClear({db:f.db,ctx:f.ctx,restaurantId:'tenant',month:'2026-10',rows:[{...created.results[0].after,workspaceId:'other'}]}),error=>error.code==='workspace_identity_conflict');
  const review=await prepareScheduleClear({db:f.db,ctx:f.ctx,restaurantId:'tenant',month:'2026-10',rows:created.results.map(row=>row.after)});
  const body={restaurantId:'tenant',reviewId:review.reviewId,action:'clear-month',confirmed:true,reason:'Reviewed deletion'};
  await assert.rejects(advanceScheduleClear({db:f.db,ctx:{...f.ctx,uid:'other_manager'},body}),error=>error.statusCode===404);
  await assert.rejects(advanceScheduleClear({db:f.db,ctx:f.ctx,body:{...body,confirmed:false}}),error=>error.code==='review_required');
  assert.equal(f.store.has('shifts/'+created.results[0].id),true);
});

test('APK packaging accepts testing source and refuses signing identity changes',()=>{
  const builder=require('../scripts/build-production-apk.cjs');
  assert.doesNotThrow(()=>builder.verifyBuildBranch('testing'));
  for(const branch of ['mobile','main','experimental'])assert.throws(()=>builder.verifyBuildBranch(branch),/testing branch/);
  const signer=require('../mobile/native-platform-contract.json').androidSigning.certificateSha256;
  assert.equal(builder.verifySigningCertificate('Signer #1 certificate SHA-256 digest: '+signer,signer),signer);
  assert.throws(()=>builder.verifySigningCertificate('Signer #1 certificate SHA-256 digest: '+'0'.repeat(64),signer),/retained signing identity/);
});

test('native scheduling transport invokes Capacitor with the production API and preserves authoritative response status',async()=>{
  const fs=require('node:fs'),vm=require('node:vm');
  const core=fs.readFileSync(require.resolve('../src/core/appCore.js'),'utf8');
  const source=core.slice(core.indexOf('export const NATIVE_API_BASE_URL'),core.indexOf('const LIVE_COLLECTION_RELEASE_GRACE_MS')).replace(/export const /g,'const ');
  const requests=[];let status=200;
  const sandbox={env:(_,fallback)=>fallback,isNativeMobileRuntime:()=>true,URL,URLSearchParams,Request,Response,Headers,FormData,window:{location:{origin:'https://app.86chaos.com'},fetch:()=>{throw new Error('Unexpected browser transport');}},CapacitorHttp:{request:async options=>{requests.push(options);return{status,data:status===200?{ok:true,authoritative:true}:{ok:false,code:'shift_changed'},headers:{'Content-Type':'application/json'}};}}};
  vm.createContext(sandbox);vm.runInContext(source+'\nglobalThis.send=nativeApiFetch;',sandbox);
  const body=JSON.stringify({restaurantId:'qa_native_fixture',operationId:'mock_native_operation',changes:[]});
  const first=await sandbox.send('/api/schedule-workspace',{method:'POST',headers:{Authorization:'Bearer mock-fixture-token','Content-Type':'application/json'},body});
  assert.equal(first.status,200);assert.equal((await first.json()).authoritative,true);
  assert.equal(requests[0].url,'https://86chaos-git-mobile-cheers-portal-s-projects.vercel.app/api/schedule-workspace');assert.equal(requests[0].data,body);
  assert.equal(requests[0].headers.authorization,'Bearer mock-fixture-token');
  status=409;const conflict=await sandbox.send('/api/schedule-workspace',{method:'POST',body});assert.equal(conflict.status,409);assert.equal((await conflict.json()).code,'shift_changed');
});
