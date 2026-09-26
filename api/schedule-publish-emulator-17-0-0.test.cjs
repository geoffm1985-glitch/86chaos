'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const admin=require('./_firebase-admin-compat');
const core=require('./_schedule-publish-core.cjs');
const service=require('./_schedule-publish-service.cjs');

if(!process.env.FIRESTORE_EMULATOR_HOST){
  test('schedule publication concurrency requires the Firestore emulator',{skip:'Run npm run test:schedule-publish:emulator; certification requires it.'},()=>{});
}else{
  const projectId=process.env.GCLOUD_PROJECT||'demo-schedule-publish';
  if(!/^demo-|^test-/.test(projectId))throw new Error('Schedule publication emulator tests refuse non-demo projects.');
  const app=admin.apps.find(row=>row.name==='schedule-publish-emulator')||admin.initializeApp({projectId},'schedule-publish-emulator');
  const db=app.firestore();
  const collections=['schedulePublishOperations','schedulePublishLeases','shifts','roles','timeOffRequests','users','workspaceMembers'];
  async function clear(){for(const name of collections){const snap=await db.collection(name).get();await Promise.all(snap.docs.map(doc=>db.recursiveDelete(doc.ref)));}}
  test.beforeEach(clear);test.after(clear);

  const roles=[{id:'role-a',name:'Configured A',revision:1,previousNames:[]}];
  const roleRevision='roles-v1|role-a:1:0:configured a:';
  const people={
    a:{id:'employee-a',scheduleUserId:'employee-a',employeeId:'employee-a',rosterUserId:'employee-a',userId:'employee-a',authUid:'employee-a',name:'Employee A',email:'a@example.invalid'},
    b:{id:'employee-b',scheduleUserId:'employee-b',employeeId:'employee-b',rosterUserId:'employee-b',userId:'employee-b',authUid:'employee-b',name:'Employee B',email:'b@example.invalid'},
  };
  function makeShift({id='shift-a',date='2026-09-18',person=people.a}={}){return{id,restaurantId:'rest-a',date,scheduleDateKey:date,employeeId:person.employeeId,rosterRoleId:'role-a',rosterRoleNameSnapshot:'Configured A',startTime:'09:00',endTime:'17:00',revision:1,updatedAt:'v1',_employeeResolution:{ok:true,person}};}
  function storedShift(row){return Object.fromEntries(Object.entries(row).filter(([key])=>!['id','_employeeResolution'].includes(key)));}
  function evidence(row){const expected=core.expectedFingerprint(row,core.resolveRole(row,roles),row._employeeResolution?.person||null),{contentDigest,...state}=expected;return{id:row.id,contentDigest,state};}
  function plan(shifts,operationId='operation_aaaaaaaaaaaa'){return core.buildCanonicalServerPlan({restaurantId:'rest-a',operationId,dayKeys:[...new Set(shifts.map(row=>row.date))],allRoles:true,roles,shifts,expectedShifts:shifts.map(evidence),roleConfigurationRevision:roleRevision,actor:{uid:'manager-a'}});}
  async function seedRole(){await db.collection('roles').doc('role-a').set({restaurantId:'rest-a',name:'Configured A',revision:1,previousNames:[]});}
  async function seedPerson(person,{token=`token-${person.employeeId.slice(-1)}`,name=person.name}={}){
    const canonical={restaurantId:'rest-a',scheduleUserId:person.scheduleUserId,employeeId:person.employeeId,rosterUserId:person.rosterUserId,userId:person.userId,authUid:person.authUid,name,email:person.email,isActive:true};
    await Promise.all([
      db.collection('users').doc(person.userId).set({...canonical,fcmToken:token}),
      db.collection('workspaceMembers').doc(`${person.employeeId}_rest-a`).set(canonical),
    ]);
  }
  async function seedShift(row){await db.collection('shifts').doc(row.id).set(storedShift(row));}
  function assertCanonicalFixture(person){
    assert.deepEqual(core.canonicalEmployeeIdentity(person),{
      scheduleUserId:person.scheduleUserId,employeeId:person.employeeId,rosterUserId:person.rosterUserId,userId:person.userId,authUid:person.authUid,accountUserId:person.userId,assignedUserId:person.scheduleUserId,
      employeeName:person.name,assignedName:person.name,employeeEmail:person.email,assignedEmail:person.email,
    });
  }

  test('FIREBASE EMULATOR overlapping operation is denied and every post-takeover transition is fenced',async()=>{
    const shift=makeShift();await seedShift(shift);const ctxA={uid:'manager-a'},ctxB={uid:'manager-b'},firstPlan=plan([shift]),first=await service.acquireOperation(db,ctxA,firstPlan,new Date(),'intent-a');
    await assert.rejects(()=>service.acquireOperation(db,ctxB,plan([shift],'operation_bbbbbbbbbbbb'),new Date(),'intent-b'),error=>error.code==='publish_in_progress');
    const expired='2000-01-01T00:00:00.000Z';await Promise.all([first.ref.set({leaseExpiresAt:expired},{merge:true}),first.tenantLeaseRef.set({leaseExpiresAt:expired},{merge:true})]);
    const secondPlan=plan([shift],'operation_bbbbbbbbbbbb'),second=await service.acquireOperation(db,ctxB,secondPlan,new Date(),'intent-b');
    await assert.rejects(()=>service.commitChunk(db,first,firstPlan,firstPlan.candidates,0,ctxA,new Date()),error=>error.code==='stale_publish_fence');
    await assert.rejects(()=>service.verifyCommitted(db,first,firstPlan,['shift-a'],new Date()),error=>error.code==='stale_publish_fence');
    await assert.rejects(()=>service.finalizeOperation(db,first,firstPlan,{}, {},new Date()),error=>error.code==='stale_publish_fence');
    const lease=(await second.tenantLeaseRef.get()).data();assert.equal(lease.operationId,'operation_bbbbbbbbbbbb');assert.equal(lease.status,'active');
  });

  test('FIREBASE EMULATOR same-operation resume verifies prior-generation commits and removes stale verified evidence',async()=>{
    const shift=makeShift();await seedRole();await seedShift(shift);const publicationPlan=plan([shift],'operation_resume_12345'),ctx={uid:'manager-a',user:{name:'Manager'}},first=await service.acquireOperation(db,ctx,publicationPlan,new Date('2026-09-18T12:00:00.000Z'),'resume-intent');
    await service.commitChunk(db,first,publicationPlan,publicationPlan.candidates,0,ctx,new Date('2026-09-18T12:00:01.000Z'));
    const committed=(await first.ref.get()).data();assert.equal(committed.committedShiftEvidence['shift-a'].generation,1);assert.equal((await db.collection('shifts').doc('shift-a').get()).data().publishGeneration,1);
    const expired='2000-01-01T00:00:00.000Z';await Promise.all([first.ref.set({leaseExpiresAt:expired},{merge:true}),first.tenantLeaseRef.set({leaseExpiresAt:expired},{merge:true})]);
    const resumed=await service.acquireOperation(db,ctx,publicationPlan,new Date('2026-09-18T12:02:00.000Z'),'resume-intent');assert.equal(resumed.state.generation,2);const verified=await service.verifyCommitted(db,resumed,publicationPlan,['shift-a'],new Date('2026-09-18T12:02:01.000Z'));assert.deepEqual(verified.verified,['shift-a']);let state=(await resumed.ref.get()).data();assert.deepEqual(state.verifiedShiftIds,['shift-a']);assert.deepEqual(state.conflictedShiftIds,[]);
    await db.collection('shifts').doc('shift-a').update({startTime:'11:00',revision:3,updatedAt:'changed-after-commit'});const rechecked=await service.verifyCommitted(db,resumed,publicationPlan,['shift-a'],new Date('2026-09-18T12:02:02.000Z'));assert.deepEqual(rechecked.conflicted,['shift-a']);state=(await resumed.ref.get()).data();assert.deepEqual(state.verifiedShiftIds,[]);assert.deepEqual(state.conflictedShiftIds,['shift-a']);assert.equal(new Set([...state.verifiedShiftIds,...state.conflictedShiftIds]).size,1);
  });

  test('FIREBASE EMULATOR time-off query failure persists partial recoverable state and resumes exact pairs',async()=>{
    const shifts=[makeShift({id:'shift-a',date:'2026-09-18',person:people.a}),makeShift({id:'shift-b',date:'2026-09-19',person:people.b})],publicationPlan=plan(shifts,'operation_timeoff_resume'),ctx={uid:'manager-a'},operation=await service.acquireOperation(db,ctx,publicationPlan,new Date('2026-09-18T12:00:00.000Z'),'timeoff-intent');await Promise.all([db.collection('timeOffRequests').doc('request-a').set({restaurantId:'rest-a',date:'2026-09-18',employeeId:'employee-a',status:'approved'}),db.collection('timeOffRequests').doc('request-b').set({restaurantId:'rest-a',date:'2026-09-19',employeeId:'employee-b',status:'approved'})]);let failed=false;const queryTimeOff=async({db:active,restaurantId,field,employeeId,date,pair})=>{if(!failed&&pair==='employee-b|2026-09-19'&&field==='employeeId'){failed=true;throw Object.assign(new Error('injected query failure'),{code:'unavailable'});}return active.collection('timeOffRequests').where('restaurantId','==',restaurantId).where(field,'==',employeeId).where('date','==',date).get();};await assert.rejects(()=>service.processTimeOff(db,ctx,operation,publicationPlan,publicationPlan.candidates,new Date('2026-09-18T12:00:01.000Z'),{queryTimeOff}),error=>error.code==='time_off_query_failed');let state=(await operation.ref.get()).data().timeOffState;assert.equal(state.status,'recoverable');assert.deepEqual(state.completedPairs,['employee-a|2026-09-18']);assert.equal(state.queryFailures.length,1);assert.equal((await db.collection('timeOffRequests').doc('request-a').get()).data().archived,true);assert.equal((await db.collection('timeOffRequests').doc('request-b').get()).data().archived,undefined);const resumed=await service.processTimeOff(db,ctx,operation,publicationPlan,publicationPlan.candidates,new Date('2026-09-18T12:00:02.000Z'));assert.equal(resumed.status,'complete');state=(await operation.ref.get()).data().timeOffState;assert.equal(state.status,'complete');assert.equal(state.completedPairs.length,2);assert.equal((await db.collection('timeOffRequests').doc('request-b').get()).data().archived,true);
  });

  test('FIREBASE EMULATOR all required time-off query failures remain incomplete with zero request mutation',async()=>{
    const shift=makeShift(),publicationPlan=plan([shift],'operation_timeoff_failall'),ctx={uid:'manager-a'},operation=await service.acquireOperation(db,ctx,publicationPlan,new Date('2026-09-18T12:00:00.000Z'),'timeoff-failall');await db.collection('timeOffRequests').doc('request-a').set({restaurantId:'rest-a',date:'2026-09-18',employeeId:'employee-a',status:'approved'});await assert.rejects(()=>service.processTimeOff(db,ctx,operation,publicationPlan,publicationPlan.candidates,new Date('2026-09-18T12:00:01.000Z'),{queryTimeOff:async()=>{throw Object.assign(new Error('injected all-query failure'),{code:'unavailable'});}}),error=>error.code==='time_off_query_failed');const state=(await operation.ref.get()).data().timeOffState;assert.equal(state.status,'recoverable');assert.equal(state.queryFailures.length,5);assert.equal(state.completedPairs.length,0);const request=(await db.collection('timeOffRequests').doc('request-a').get()).data();assert.equal(request.archived,undefined);assert.equal(request.publishOperationId,undefined);
  });

  test('FIREBASE EMULATOR unchanged canonical identities publish exact employee/date pairs without cross-product effects',async()=>{
    assertCanonicalFixture(people.a);assertCanonicalFixture(people.b);
    const shifts=[makeShift({id:'shift-a',date:'2026-09-18',person:people.a}),makeShift({id:'shift-b',date:'2026-09-19',person:people.b})];
    await seedRole();await Promise.all([seedPerson(people.a,{token:'token-a'}),seedPerson(people.b,{token:'token-b'}),...shifts.map(seedShift)]);
    await Promise.all([
      db.collection('timeOffRequests').doc('exact-a').set({restaurantId:'rest-a',date:'2026-09-18',employeeId:'employee-a',status:'approved'}),
      db.collection('timeOffRequests').doc('exact-b').set({restaurantId:'rest-a',date:'2026-09-19',employeeId:'employee-b',status:'approved'}),
      db.collection('timeOffRequests').doc('cross-a-day-b').set({restaurantId:'rest-a',date:'2026-09-19',employeeId:'employee-a',status:'approved'}),
    ]);
    const sent=[];const messaging={async sendEachForMulticast(payload){sent.push(...payload.tokens);return{responses:payload.tokens.map(()=>({success:true}))};}};
    const body={restaurantId:'rest-a',operationId:'operation_scope_123456',dayKeys:['2026-09-18','2026-09-19'],allRoles:true,selectedRoleIds:[],roleConfigurationRevision:roleRevision,expectedShifts:shifts.map(evidence),restaurantName:'Fixture'};
    const result=await service.executeSchedulePublish({db,ctx:{uid:'manager-a',user:{name:'Manager'}},body,messaging,clock:()=>new Date('2026-09-18T12:00:00.000Z')});
    assert.equal(result.status,'complete');assert.deepEqual(sent.sort(),['token-a','token-b']);
    assert.equal((await db.collection('timeOffRequests').doc('exact-a').get()).data().archived,true);
    assert.equal((await db.collection('timeOffRequests').doc('exact-b').get()).data().archived,true);
    const cross=(await db.collection('timeOffRequests').doc('cross-a-day-b').get()).data();assert.equal(cross.archived,undefined);assert.equal(cross.processed,undefined);assert.equal(cross.publishOperationId,undefined);
  });

  test('FIREBASE EMULATOR canonical identity change after confirmation is rejected with zero side effects',async()=>{
    const shift=makeShift();await seedRole();await seedPerson(people.a,{token:'token-a'});await seedShift(shift);
    await db.collection('timeOffRequests').doc('request-a').set({restaurantId:'rest-a',date:shift.date,employeeId:'employee-a',status:'approved'});
    await Promise.all([
      db.collection('users').doc('employee-a').set({name:'Employee A Renamed'},{merge:true}),
      db.collection('workspaceMembers').doc('employee-a_rest-a').set({name:'Employee A Renamed'},{merge:true}),
    ]);
    let providerCalls=0;const body={restaurantId:'rest-a',operationId:'operation_identity_changed',dayKeys:[shift.date],allRoles:true,roleConfigurationRevision:roleRevision,expectedShifts:[evidence(shift)]};
    await assert.rejects(()=>service.executeSchedulePublish({db,ctx:{uid:'manager-a'},body,messaging:{async sendEachForMulticast(){providerCalls+=1;return{responses:[]};}}}),error=>error.code==='confirmed_shift_changed');
    const [stored,request,operation]=await Promise.all([db.collection('shifts').doc(shift.id).get(),db.collection('timeOffRequests').doc('request-a').get(),db.collection('schedulePublishOperations').doc(body.operationId).get()]);
    assert.notEqual(stored.data().isPublished,true);assert.equal(request.data().archived,undefined);assert.equal(request.data().publishOperationId,undefined);assert.equal(providerCalls,0);assert.equal(operation.exists,false);
  });

  test('FIREBASE EMULATOR employee reassignment after confirmation is rejected with zero side effects',async()=>{
    const confirmed=makeShift();await seedRole();await Promise.all([seedPerson(people.a),seedPerson(people.b)]);await seedShift({...confirmed,employeeId:'employee-b'});
    let providerCalls=0;const body={restaurantId:'rest-a',operationId:'operation_reassigned_123',dayKeys:[confirmed.date],allRoles:true,roleConfigurationRevision:roleRevision,expectedShifts:[evidence(confirmed)]};
    await assert.rejects(()=>service.executeSchedulePublish({db,ctx:{uid:'manager-a'},body,messaging:{async sendEachForMulticast(){providerCalls+=1;return{responses:[]};}}}),error=>['confirmed_shift_changed','candidate_set_changed'].includes(error.code));
    const stored=await db.collection('shifts').doc(confirmed.id).get();assert.equal(stored.data().employeeId,'employee-b');assert.notEqual(stored.data().isPublished,true);assert.equal(providerCalls,0);assert.equal((await db.collection('schedulePublishOperations').doc(body.operationId).get()).exists,false);
  });

  test('FIREBASE EMULATOR provider timeout is ambiguous, provider is reached, and publication remains durable',async()=>{
    const shift=makeShift();await seedRole();await seedPerson(people.a,{token:'token-a'});await seedShift(shift);
    let providerCalls=0;const body={restaurantId:'rest-a',operationId:'operation_notify_12345',dayKeys:[shift.date],allRoles:true,roleConfigurationRevision:roleRevision,expectedShifts:[evidence(shift)]};
    const messaging={async sendEachForMulticast(){providerCalls+=1;throw new Error('provider sentinel must remain private');}};
    const result=await service.executeSchedulePublish({db,ctx:{uid:'manager-a'},body,messaging,clock:()=>new Date('2026-09-18T12:00:00.000Z')});
    assert.equal(providerCalls,1);assert.equal(result.status,'complete');assert.equal(result.notificationState.status,'ambiguous');assert.equal(result.notificationState.ambiguousCount,1);
    const [storedShiftDoc,storedOperation]=await Promise.all([db.collection('shifts').doc(shift.id).get(),db.collection('schedulePublishOperations').doc(body.operationId).get()]);
    assert.equal(storedShiftDoc.data().isPublished,true);assert.equal(storedOperation.data().status,'complete');assert.equal(storedOperation.data().notificationState.status,'ambiguous');
    assert.doesNotMatch(JSON.stringify(result),/provider sentinel/i);assert.doesNotMatch(JSON.stringify(storedOperation.data()),/provider sentinel/i);
  });
  test('17.0.5 FIREBASE EMULATOR legacy whitespace snapshot publishes once and resumes without duplicate shifts',async()=>{
    const shift={...makeShift(),rosterRoleId:'',rosterRoleNameSnapshot:'  ',role:'Configured A'};
    await seedRole();await seedPerson(people.a);await seedShift(shift);
    const body={restaurantId:'rest-a',operationId:'operation_1705_legacy',dayKeys:[shift.date],allRoles:true,roleConfigurationRevision:roleRevision,expectedShifts:[evidence(shift)]};
    const messaging={async sendEachForMulticast(payload){return{responses:payload.tokens.map(()=>({success:true}))};}};
    const result=await service.executeSchedulePublish({db,ctx:{uid:'manager-a'},body,messaging});assert.equal(result.status,'complete');
    const saved=(await db.collection('shifts').doc(shift.id).get()).data();assert.equal(saved.rosterRoleId,'role-a');assert.equal(saved.isPublished,true);
    const replay=await service.executeSchedulePublish({db,ctx:{uid:'manager-a'},body,messaging});assert.equal(replay.status,'complete');assert.equal((await db.collection('shifts').get()).size,1);assert.equal((await db.collection('shifts').doc(shift.id).get()).data().revision,saved.revision);
  });
  test('17.0.5 FIREBASE EMULATOR explicit review repairs only selected role metadata and rejects stale, foreign and leased shifts',async()=>{
    await seedRole();const shift={...makeShift(),rosterRoleId:'',rosterRoleNameSnapshot:'',role:''};await seedShift(shift);
    const raw=storedShift(shift),body={restaurantId:'rest-a',repairs:[{id:shift.id,rosterRoleId:'role-a',contentDigest:core.expectedFingerprint(raw).contentDigest,expectedRoleIdentity:require('../src/core/rosterRoleIdentityCore.cjs').copyRosterRoleFields(raw)}]};
    const ctx={uid:'manager-a'};
    await assert.rejects(()=>service.reconcileScheduleRoles({db,ctx,body:{...body,restaurantId:'rest-b'}}),e=>e.code==='role_review_changed');
    await assert.rejects(()=>service.reconcileScheduleRoles({db,ctx,body:{...body,repairs:[{...body.repairs[0],contentDigest:'0'.repeat(64)}]}}),e=>e.code==='role_review_changed');
    const leaseId=require('node:crypto').createHash('sha256').update('rest-a').digest('hex');const lease=db.collection('schedulePublishLeases').doc(leaseId);
    await lease.set({status:'active',leaseExpiresAt:'2099-01-01T00:00:00Z'});await assert.rejects(()=>service.reconcileScheduleRoles({db,ctx,body}),e=>e.code==='publish_in_progress');await lease.delete();
    const result=await service.reconcileScheduleRoles({db,ctx,body});assert.deepEqual(result.repairedShiftIds,[shift.id]);
    const saved=(await db.collection('shifts').doc(shift.id).get()).data();assert.equal(saved.rosterRoleId,'role-a');assert.notEqual(saved.isPublished,true);assert.equal(saved.employeeId,raw.employeeId);assert.equal(saved.date,raw.date);assert.equal(saved.startTime,raw.startTime);assert.equal(saved.previousRoleIdentity.role,'');
    await assert.rejects(()=>service.reconcileScheduleRoles({db,ctx,body}),e=>e.code==='role_review_changed');
  });

}
