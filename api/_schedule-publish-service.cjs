'use strict';
const crypto = require('node:crypto');
const {
  buildCanonicalServerPlan, clean, digest, stable, fingerprintsMatch, inactive
} = require('./_schedule-publish-core.cjs');

const LEASE_MS = 90 * 1000;
const CHUNK_SIZE = 180;
const NOTIFICATION_BATCH_SIZE = 500;
const operationIdPattern = /^[A-Za-z0-9_-]{16,160}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const safeError = error => ({ code:clean(error?.code || 'publish_failed'), error:Number(error?.statusCode||500)>=500?'Schedule publication failed safely.':clean(error?.message || 'Schedule publication failed.').slice(0,240), details:error?.details || undefined });
const asDate = clock => { const value=typeof clock==='function'?clock():clock;return value instanceof Date?value:new Date(value||Date.now()); };
const tenantLeaseId = restaurantId => crypto.createHash('sha256').update(restaurantId).digest('hex');
const unique = values => [...new Set(values.filter(Boolean))];
const requestIntent = body => ({
  restaurantId:clean(body.restaurantId), operationId:clean(body.operationId),
  dayKeys:unique((body.dayKeys||[]).map(clean)).sort(),
  selectedWeekKeys:unique((body.selectedWeekKeys||[]).map(clean)).sort(),
  selectedRoleIds:body.allRoles?[]:unique((body.selectedRoleIds||[]).map(clean)).sort(),
  allRoles:Boolean(body.allRoles), roleConfigurationRevision:clean(body.roleConfigurationRevision),
  expectedShifts:(body.expectedShifts||[]).map(row=>({
    id:clean(row.id),
    contentDigest:clean(row.contentDigest)||(row.state&&typeof row.state==='object'?digest(stable(row.state)):''),
    state:row.state&&typeof row.state==='object'?stable(row.state):null
  })).filter(row=>row.id).sort((a,b)=>a.id.localeCompare(b.id))
});
const requestDigest = body => digest(requestIntent(body));

async function loadRoles(db, restaurantId) {
  const snap = await db.collection('roles').where('restaurantId','==',restaurantId).get();
  return snap.docs.map(doc=>({id:doc.id,...doc.data()}));
}
async function loadRoleConfiguration(db, restaurantId) {
  const [roles, restaurant] = await Promise.all([
    loadRoles(db, restaurantId),
    db.collection('restaurants').doc(restaurantId).get()
  ]);
  return { roles, generation:Number(restaurant.exists ? restaurant.data()?.rosterRoleConfigurationGeneration || 0 : 0) };
}
async function loadCandidateShifts(db, restaurantId, dayKeys) {
  const byId = new Map();
  for (const day of dayKeys) {
    for (const [tenantField,dateField] of [['restaurantId','date'],['restaurantId','scheduleDateKey'],['workspaceId','date'],['workspaceId','scheduleDateKey']]) {
      const snap = await db.collection('shifts').where(tenantField,'==',restaurantId).where(dateField,'==',day).get();
      snap.forEach(doc=>byId.set(doc.id,{id:doc.id,...doc.data()}));
    }
  }
  return [...byId.values()];
}
function identityAliases(value={}) { return unique(['id','uid','authUid','userId','employeeId','rosterUserId','scheduleUserId','accountUserId','membershipId','workspaceMemberId'].map(field=>clean(value[field]))); }
function identityEmails(value={}) { return unique(['email','userEmail','employeeEmail','assignedEmail'].map(field=>clean(value[field]).toLowerCase())); }
function identityNames(value={}) { return unique(['name','displayName','fullName','employeeName','assignedName'].map(field=>clean(value[field]).toLowerCase())); }
function resolveEmployeeForShift(shift, people) {
  const ids=identityAliases(shift),emails=identityEmails(shift),names=identityNames(shift);
  const active=people.filter(row=>!inactive(row));
  const findUnique=(matcher,reason)=>{const rows=active.filter(matcher);return rows.length===1?{ok:true,person:rows[0],source:reason}:{ok:false,reason:rows.length?'ambiguous-employee-reference':`unresolved-${reason}`};};
  if(ids.length){const result=findUnique(row=>identityAliases(row).some(id=>ids.includes(id)),'durable-employee-reference');if(result.ok)return result;}
  if(emails.length){const result=findUnique(row=>identityEmails(row).some(email=>emails.includes(email)),'employee-email');if(result.ok)return result;}
  if(names.length)return findUnique(row=>identityNames(row).some(name=>names.includes(name)),'employee-name');
  return {ok:false,reason:'missing-employee-reference'};
}
async function loadRosterPeople(db, restaurantId) {
  const [users,members]=await Promise.all([
    db.collection('users').where('restaurantId','==',restaurantId).get(),
    db.collection('workspaceMembers').where('restaurantId','==',restaurantId).get()
  ]);
  const userRows=users.docs.map(doc=>({id:doc.id,...doc.data(),_source:'user'}));
  const memberRows=members.docs.map(doc=>({id:doc.id,...doc.data(),_source:'workspaceMember'}));
  const claimedUsers=new Set(),people=[];
  for(const member of memberRows){const match=userRows.find(user=>identityAliases(member).some(alias=>identityAliases(user).includes(alias))||identityEmails(member).some(email=>identityEmails(user).includes(email)));if(match)claimedUsers.add(match.id);people.push({...match,...member,id:clean(member.employeeId||member.rosterUserId||member.scheduleUserId||member.userId||member.uid||member.id),workspaceMemberId:member.id,_source:'canonical'});}
  for(const user of userRows)if(!claimedUsers.has(user.id)&&user.legacyMembershipFallback===true&&Number(user.membershipMigrationVersion||0)<2)people.push(user);
  return people;
}
function validateRequest(body = {}) {
  const restaurantId=clean(body.restaurantId), operationId=clean(body.operationId);
  const dayKeys=Array.isArray(body.dayKeys)?unique(body.dayKeys.map(clean)).sort():[];
  if(!restaurantId || !operationIdPattern.test(operationId)) throw Object.assign(new Error('A valid tenant and operation ID are required.'),{statusCode:400,code:'invalid_request'});
  if(!dayKeys.length || dayKeys.length>62 || dayKeys.some(day=>!datePattern.test(day))) throw Object.assign(new Error('One to 62 calendar-date keys are required.'),{statusCode:400,code:'invalid_request'});
  if(!Array.isArray(body.expectedShifts) || body.expectedShifts.length>5000) throw Object.assign(new Error('Confirmed shift evidence is required and may contain at most 5,000 shifts.'),{statusCode:400,code:'invalid_request'});
  if(!clean(body.roleConfigurationRevision)) throw Object.assign(new Error('The confirmed roster-role revision is required.'),{statusCode:400,code:'invalid_request'});
  return {restaurantId,operationId,dayKeys};
}
function fenceError(){return Object.assign(new Error('Publication lease was replaced; this stale publisher cannot continue.'),{statusCode:409,code:'stale_publish_fence'});}
function assertFenceState(op,lease,operation,plan,nowMs,{allowExpired=false}={}){
  if(!op||!lease||op.operationId!==plan.operationId||op.planDigest!==plan.planDigest||op.generation!==operation.state.generation||op.leaseToken!==operation.state.leaseToken||lease.operationId!==plan.operationId||lease.planDigest!==plan.planDigest||lease.generation!==operation.state.tenantLeaseGeneration||lease.leaseToken!==operation.state.leaseToken||(!allowExpired&&(Date.parse(op.leaseExpiresAt||0)<=nowMs||Date.parse(lease.leaseExpiresAt||0)<=nowMs)))throw fenceError();
}
async function fencedTransaction(db,operation,plan,clock,work,{allowExpired=false}={}){
  return db.runTransaction(async tx=>{
    const roleConfigRef=db.collection('restaurants').doc(plan.restaurantId);
    const [opSnap,leaseSnap,roleConfigSnap]=await Promise.all([tx.get(operation.ref),tx.get(operation.tenantLeaseRef),tx.get(roleConfigRef)]);
    const op=opSnap.exists?opSnap.data()||{}:null,lease=leaseSnap.exists?leaseSnap.data()||{}:null;
    assertFenceState(op,lease,operation,plan,asDate(clock).getTime(),{allowExpired});
    const liveRoleGeneration=Number(roleConfigSnap.exists?roleConfigSnap.data()?.rosterRoleConfigurationGeneration||0:0);
    if(liveRoleGeneration!==Number(plan.roleConfigurationGeneration||0))throw Object.assign(new Error('Roster-role configuration changed during publication.'),{statusCode:409,code:'role_configuration_changed'});
    return work(tx,op,lease);
  });
}
async function acquireOperation(db, ctx, plan, clock=new Date(), intentDigest='') {
  const now=asDate(clock),nowIso=now.toISOString(),nowMs=now.getTime();
  const ref=db.collection('schedulePublishOperations').doc(plan.operationId);
  const tenantLeaseRef=db.collection('schedulePublishLeases').doc(tenantLeaseId(plan.restaurantId));
  return db.runTransaction(async tx=>{
    const roleConfigRef=db.collection('restaurants').doc(plan.restaurantId);
    const [snap,tenantLeaseSnap,roleConfigSnap]=await Promise.all([tx.get(ref),tx.get(tenantLeaseRef),tx.get(roleConfigRef)]);
    const current=snap.exists?snap.data()||{}:null,tenantLease=tenantLeaseSnap.exists?tenantLeaseSnap.data()||{}:null;
    const liveRoleGeneration=Number(roleConfigSnap.exists?roleConfigSnap.data()?.rosterRoleConfigurationGeneration||0:0);
    if(liveRoleGeneration!==Number(plan.roleConfigurationGeneration||0))throw Object.assign(new Error('Roster-role configuration changed before publication acquired its lease.'),{statusCode:409,code:'role_configuration_changed'});
    const tenantLeaseActive=Boolean(tenantLease&&Date.parse(tenantLease.leaseExpiresAt||0)>nowMs);
    if(tenantLeaseActive&&tenantLease.operationId!==plan.operationId)throw Object.assign(new Error('Another manager is publishing this restaurant.'),{statusCode:409,code:'publish_in_progress'});
    if(current){
      if(current.restaurantId!==plan.restaurantId||current.planDigest!==plan.planDigest||current.requestDigest!==intentDigest)throw Object.assign(new Error('This operation ID is already bound to a different publication plan.'),{statusCode:409,code:'operation_plan_mismatch'});
      if(['complete','partial'].includes(current.status)&&Number(current.remainingCount||0)===0)return{ref,tenantLeaseRef,state:current,terminal:true};
      const activeLease=Date.parse(current.leaseExpiresAt||0)>nowMs;
      if(activeLease){
        if(current.leaseOwnerUid!==ctx.uid)throw Object.assign(new Error('Another manager is publishing this scope.'),{statusCode:409,code:'publish_in_progress'});
        if(current.leaseToken===tenantLease?.leaseToken&&tenantLease?.operationId===plan.operationId)return{ref,tenantLeaseRef,state:current,joined:true};
        throw fenceError();
      }
      const generation=Number(current.generation||0)+1,tenantLeaseGeneration=Number(tenantLease?.generation||0)+1,leaseToken=crypto.randomUUID(),leaseExpiresAt=new Date(nowMs+LEASE_MS).toISOString();
      const update={status:'running',generation,tenantLeaseGeneration,leaseToken,leaseOwnerUid:ctx.uid,leaseExpiresAt,resumedAt:nowIso,updatedAt:nowIso};
      tx.set(ref,update,{merge:true});tx.set(tenantLeaseRef,{restaurantId:plan.restaurantId,operationId:plan.operationId,planDigest:plan.planDigest,requestDigest:intentDigest,leaseToken,generation:tenantLeaseGeneration,leaseOwnerUid:ctx.uid,leaseExpiresAt,status:'active',updatedAt:nowIso},{merge:false});
      return{ref,tenantLeaseRef,state:{...current,...update},resumed:true};
    }
    if(tenantLeaseActive)throw Object.assign(new Error('Another manager is publishing this restaurant.'),{statusCode:409,code:'publish_in_progress'});
    const leaseToken=crypto.randomUUID(),tenantLeaseGeneration=Number(tenantLease?.generation||0)+1,leaseExpiresAt=new Date(nowMs+LEASE_MS).toISOString();
    const ids=plan.candidates.map(row=>row.id);
    const state={schemaVersion:2,operationId:plan.operationId,planDigest:plan.planDigest,requestDigest:intentDigest,restaurantId:plan.restaurantId,actorUid:ctx.uid,actorEmail:ctx.email||'',selectedRoleIds:plan.selectedRoleIds,allRoles:plan.allRoles,roleConfigurationRevision:plan.roleConfigurationRevision,dayKeys:plan.dayKeys,selectedWeekKeys:plan.selectedWeekKeys,canonicalPlan:stable(plan),affectedEmployeeIds:plan.affectedEmployeeIds,affectedDates:plan.affectedDates,affectedRoleIds:plan.affectedRoleIds,plannedShiftIds:ids,unchangedShiftIds:plan.unchangedShiftIds||[],unresolvedEmployees:plan.unresolvedEmployees||[],writeCount:plan.writeCount,verificationCount:plan.verificationCount,committedShiftIds:[],verifiedShiftIds:[],conflictedShiftIds:[],remainingShiftIds:ids,committedChunks:[],verifiedChunks:[],timeOffState:{status:'pending',processedIds:[],pendingMarkedIds:[]},notificationState:{status:'pending',recipients:[]},backupScope:{shiftIds:ids,dates:plan.affectedDates},status:'running',generation:1,tenantLeaseGeneration,leaseToken,leaseOwnerUid:ctx.uid,leaseExpiresAt,createdAt:nowIso,updatedAt:nowIso};
    tx.create(ref,state);tx.set(tenantLeaseRef,{restaurantId:plan.restaurantId,operationId:plan.operationId,planDigest:plan.planDigest,requestDigest:intentDigest,leaseToken,generation:tenantLeaseGeneration,leaseOwnerUid:ctx.uid,leaseExpiresAt,status:'active',updatedAt:nowIso},{merge:false});
    return{ref,tenantLeaseRef,state};
  });
}
function publishedStateMatches(data,row,plan,operation){
  if(clean(data.restaurantId||data.workspaceId)!==plan.restaurantId||clean(data.publishOperationId)!==plan.operationId||Number(data.publishGeneration)!==Number(operation.state.generation))return false;
  if(clean(data.date)!==row.date||clean(data.scheduleDateKey)!==row.date||clean(data.rosterRoleId)!==row.rosterRoleId||data.isPublished!==true||data.published!==true||clean(data.status).toLowerCase()!=='published'||clean(data.publishStatus).toLowerCase()!=='published')return false;
  for(const [field,value] of Object.entries(row.desiredEmployeeIdentity||{}))if(clean(value)&&clean(data[field])!==clean(value))return false;
  return true;
}
async function commitChunk(db,operation,plan,rows,chunkIndex,ctx,clock=new Date()){
  const now=asDate(clock),nowIso=now.toISOString();
  return fencedTransaction(db,operation,plan,clock,async(tx,op)=>{
    const snapshots=[];for(const row of rows)snapshots.push(await tx.get(db.collection('shifts').doc(row.id)));
    const committed=[],conflicted=[];
    snapshots.forEach((snap,index)=>{
      const row=rows[index];
      if(!snap.exists){conflicted.push(row.id);return;}
      const current=snap.data()||{},tenant=clean(current.restaurantId||current.workspaceId);
      const role={rosterRoleId:row.rosterRoleId,rosterRoleNameSnapshot:row.rosterRoleNameSnapshot};
      if(tenant!==plan.restaurantId||!fingerprintsMatch(current,row.expected,role,row.intentionalOpen?null:row.desiredEmployeeIdentity)){conflicted.push(row.id);return;}
      const publishedAt=current.publishedAt||nowIso;
      tx.update(snap.ref,{restaurantId:plan.restaurantId,workspaceId:clean(current.workspaceId||plan.restaurantId),date:row.date,scheduleDateKey:row.date,rosterRoleId:row.rosterRoleId,rosterRoleNameSnapshot:row.rosterRoleNameSnapshot,role:clean(current.role||row.rosterRoleNameSnapshot),...(row.desiredEmployeeIdentity||{}),revision:Number(current.revision||0)+1,isPublished:true,published:true,status:'published',publishStatus:'published',publishState:'published',schedulePublishStatus:'published',visibility:'published',scheduleBuilderDraft:false,readyToPublish:false,draft:false,isDraft:false,publishedAt,publishedBy:current.publishedBy||ctx.uid,publishedByName:current.publishedByName||ctx.user?.name||ctx.email||'Manager',scheduleId:current.scheduleId||`schedule_${plan.operationId}`,schedulePeriodStart:plan.dayKeys[0],schedulePeriodEnd:plan.dayKeys[plan.dayKeys.length-1],publishScope:plan.selectedWeekKeys.length?'selected-weeks':'full-period',publishWeekKeys:plan.selectedWeekKeys,publishOperationId:plan.operationId,publishGeneration:operation.state.generation,updatedAt:nowIso});
      committed.push(row.id);
    });
    const priorCommitted=new Set(op.committedShiftIds||[]),priorConflicted=new Set(op.conflictedShiftIds||[]);committed.forEach(id=>priorCommitted.add(id));conflicted.forEach(id=>priorConflicted.add(id));
    const remaining=(op.plannedShiftIds||plan.candidates.map(row=>row.id)).filter(id=>!priorCommitted.has(id)&&!priorConflicted.has(id));
    const leaseExpiresAt=new Date(now.getTime()+LEASE_MS).toISOString();
    tx.set(operation.ref,{committedShiftIds:[...priorCommitted],conflictedShiftIds:[...priorConflicted],remainingShiftIds:remaining,committedChunks:[...(op.committedChunks||[]),{chunkIndex,shiftIds:committed,conflictedShiftIds:conflicted,at:nowIso,generation:operation.state.generation}],status:remaining.length?'running':'reconciling',updatedAt:nowIso,leaseExpiresAt},{merge:true});
    tx.set(operation.tenantLeaseRef,{leaseExpiresAt,updatedAt:nowIso},{merge:true});
    return{committed,conflicted};
  });
}
async function verifyCommitted(db,operation,plan,ids,clock=new Date()){
  const nowIso=asDate(clock).toISOString(),rowsById=new Map(plan.candidates.map(row=>[row.id,row]));
  const verified=[],conflicted=[];
  for(let index=0;index<ids.length;index+=CHUNK_SIZE){
    const chunk=ids.slice(index,index+CHUNK_SIZE);
    const result=await fencedTransaction(db,operation,plan,clock,async(tx,op)=>{
      const snaps=[];for(const id of chunk)snaps.push(await tx.get(db.collection('shifts').doc(id)));
      const localVerified=[],localConflicted=[];snaps.forEach((snap,i)=>{const row=rowsById.get(chunk[i]);const data=snap.exists?snap.data()||{}:{};(snap.exists&&row&&publishedStateMatches(data,row,plan,operation)?localVerified:localConflicted).push(chunk[i]);});
      const allVerified=new Set(op.verifiedShiftIds||[]),allConflicted=new Set(op.conflictedShiftIds||[]);localVerified.forEach(id=>allVerified.add(id));localConflicted.forEach(id=>allConflicted.add(id));
      const remaining=(op.plannedShiftIds||[]).filter(id=>!allVerified.has(id)&&!allConflicted.has(id));
      tx.set(operation.ref,{verifiedShiftIds:[...allVerified],conflictedShiftIds:[...allConflicted],remainingShiftIds:remaining,verifiedChunks:[...(op.verifiedChunks||[]),{chunkIndex:Math.floor(index/CHUNK_SIZE),shiftIds:localVerified,conflictedShiftIds:localConflicted,at:nowIso,generation:operation.state.generation}],status:'reconciling',updatedAt:nowIso},{merge:true});
      return{verified:localVerified,conflicted:localConflicted};
    });
    verified.push(...result.verified);conflicted.push(...result.conflicted);
  }
  return{verified:unique(verified),conflicted:unique(conflicted)};
}
async function processTimeOff(db,ctx,operation,plan,verifiedRows,clock=new Date()){
  const nowIso=asDate(clock).toISOString(),pairSet=new Set(verifiedRows.filter(row=>row.employeeId).map(row=>`${row.employeeId}|${row.date}`));
  if(!pairSet.size){await fencedTransaction(db,operation,plan,clock,(tx)=>tx.set(operation.ref,{timeOffState:{status:'complete',processedIds:[],pendingMarkedIds:[],pairCount:0,updatedAt:nowIso}},{merge:true}));return{processed:0,pendingMarked:0};}
  const candidates=new Map();for(const pair of pairSet){const [employeeId,date]=pair.split('|');for(const field of ['employeeId','scheduleUserId','rosterUserId','userId','authUid']){const snap=await db.collection('timeOffRequests').where('restaurantId','==',plan.restaurantId).where(field,'==',employeeId).where('date','==',date).get().catch(()=>null);snap?.forEach(doc=>candidates.set(doc.id,{id:doc.id}));}}
  const processed=[],pendingMarked=[];
  for(const candidate of candidates.values()){
    const result=await fencedTransaction(db,operation,plan,clock,async(tx)=>{
      const ref=db.collection('timeOffRequests').doc(candidate.id),fresh=await tx.get(ref);if(!fresh.exists)return'';const data=fresh.data()||{},tenant=clean(data.restaurantId||data.workspaceId),subject=clean(data.scheduleUserId||data.employeeId||data.rosterUserId||data.accountUserId||data.userId||data.authUid||data.uid),date=clean(data.date);if(tenant!==plan.restaurantId||!pairSet.has(`${subject}|${date}`))return'';const status=clean(data.status||'pending').toLowerCase();if(['approved','denied'].includes(status)&&data.archived!==true&&data.processed!==true){tx.set(ref,{previousStatus:data.status||'',status:'processed',processed:true,archived:true,processedAt:nowIso,processedBy:ctx.uid,publishOperationId:plan.operationId,updatedAt:nowIso},{merge:true});return'processed';}if(status==='pending'){tx.set(ref,{overlapsPublishedSchedule:true,unresolvedPublishedOverlap:true,publishOperationId:plan.operationId,updatedAt:nowIso},{merge:true});return'pending';}return'';
    });
    if(result==='processed')processed.push(candidate.id);if(result==='pending')pendingMarked.push(candidate.id);
  }
  await fencedTransaction(db,operation,plan,clock,(tx)=>tx.set(operation.ref,{timeOffState:{status:'complete',processedIds:processed,pendingMarkedIds:pendingMarked,pairCount:pairSet.size,updatedAt:nowIso}},{merge:true}));
  return{processed:processed.length,pendingMarked:pendingMarked.length};
}
async function collectEligibleRecipients(db,auth,plan,verifiedRows){
  const employeeSet=new Set(verifiedRows.map(row=>row.employeeId).filter(Boolean));if(!employeeSet.size)return[];
  const members=await db.collection('workspaceMembers').where('restaurantId','==',plan.restaurantId).get();
  const memberByAlias=new Map();for(const doc of members.docs){const member={id:doc.id,...doc.data()};if(inactive(member))continue;for(const alias of identityAliases(member)){const rows=memberByAlias.get(alias)||[];rows.push(member);memberByAlias.set(alias,rows);}}
  const recipients=[];
  for(const employeeId of employeeSet){const canonical=(memberByAlias.get(employeeId)||[]).filter(row=>!inactive(row));if(canonical.length!==1)continue;const member=canonical[0];const accountId=clean(member.authUid||member.uid||member.userId||employeeId);let userSnap=await db.collection('users').doc(accountId).get();if(!userSnap.exists&&member.email){const byEmail=await db.collection('users').where('email','==',clean(member.email).toLowerCase()).limit(1).get();if(!byEmail.empty)userSnap=byEmail.docs[0];}if(!userSnap.exists)continue;const user={id:userSnap.id,...userSnap.data()};if(inactive(user)||user.preferences?.notifSchedule===false)continue;if(clean(user.restaurantId)!==plan.restaurantId&&!user.workspaceIds?.includes?.(plan.restaurantId))continue;const authUid=clean(user.authUid||user.uid||user.userId||user.id);if(auth&&authUid){try{const authUser=await auth.getUser(authUid);if(authUser.disabled)continue;}catch(_){continue;}}const tokens=unique([user.fcmToken,...(Array.isArray(user.fcmTokens)?user.fcmTokens:[]),...(Array.isArray(user.pushTokens)?user.pushTokens.map(row=>typeof row==='string'?row:row?.token):[])]);if(tokens.length)recipients.push({userId:user.id,employeeId,tokens});}
  return recipients;
}
async function notifyAffected(db,messaging,auth,operation,plan,verifiedRows,restaurantName,clock=new Date()){
  const nowIso=asDate(clock).toISOString(),eligible=await collectEligibleRecipients(db,auth,plan,verifiedRows);
  let state=await fencedTransaction(db,operation,plan,clock,(tx,op)=>{
    const prior=new Map((op.notificationState?.recipients||[]).map(row=>[row.userId,row]));
    const rows=[];for(const candidate of eligible){const old=prior.get(candidate.userId);if(old?.status==='accepted'||old?.status==='ambiguous')rows.push(old);else rows.push({...candidate,status:old?.status||'pending',attemptCount:Number(old?.attemptCount||0)});}
    const next={status:rows.some(row=>row.status==='pending'||row.status==='failed')?'pending':'complete',recipients:rows,recipientCount:rows.length,acceptedCount:rows.filter(row=>row.status==='accepted').length,failedCount:rows.filter(row=>row.status==='failed').length,ambiguousCount:rows.filter(row=>row.status==='ambiguous').length,reservedGeneration:operation.state.generation,reservedLeaseToken:operation.state.leaseToken,updatedAt:nowIso};tx.set(operation.ref,{notificationState:next},{merge:true});return next;
  });
  const eligibleToSend=state.recipients.filter(row=>['pending','failed'].includes(row.status));
  const tokenOwners=[];eligibleToSend.forEach(row=>row.tokens.forEach(token=>tokenOwners.push({token,userId:row.userId})));
  for(let start=0;start<tokenOwners.length;start+=NOTIFICATION_BATCH_SIZE){
    const tokenBatch=tokenOwners.slice(start,start+NOTIFICATION_BATCH_SIZE);
    await fencedTransaction(db,operation,plan,clock,(tx,op)=>tx.set(operation.ref,{notificationState:{...(op.notificationState||state),status:'sending',lastAttemptAt:nowIso}},{merge:true}));
    let response=null,providerError=false;try{response=await messaging.sendEachForMulticast({notification:{title:'New Schedule Published!',body:`${restaurantName||'Your restaurant'} posted shifts that affect you.`},data:{type:'schedule',restaurantId:plan.restaurantId,operationId:plan.operationId,click_action:'/?tab=published'},tokens:tokenBatch.map(row=>row.token)});}catch(_){providerError=true;}
    state=await fencedTransaction(db,operation,plan,clock,(tx,op)=>{const prior=new Map((op.notificationState?.recipients||[]).map(row=>[row.userId,{...row}]));for(const userId of unique(tokenBatch.map(row=>row.userId))){const current=prior.get(userId)||{userId,attemptCount:0};current.attemptCount=Number(current.attemptCount||0)+1;if(providerError)current.status='ambiguous';else{const indexes=tokenBatch.map((entry,index)=>entry.userId===userId?index:-1).filter(index=>index>=0);current.status=indexes.some(index=>response.responses?.[index]?.success)?'accepted':'failed';current.errorCodes=unique(indexes.map(index=>response.responses?.[index]?.error?.code||''));}delete current.tokens;prior.set(userId,current);}const rows=[...prior.values()];const next={status:rows.some(row=>row.status==='failed'||row.status==='pending')?'partial':rows.some(row=>row.status==='ambiguous')?'ambiguous':'complete',recipientCount:rows.length,acceptedCount:rows.filter(row=>row.status==='accepted').length,failedCount:rows.filter(row=>row.status==='failed').length,ambiguousCount:rows.filter(row=>row.status==='ambiguous').length,recipients:rows,updatedAt:nowIso};tx.set(operation.ref,{notificationState:next},{merge:true});return next;});
  }
  return state;
}
async function finalizeOperation(db,operation,plan,timeOff,notificationState,clock=new Date()){
  const nowIso=asDate(clock).toISOString();
  return fencedTransaction(db,operation,plan,clock,(tx,op)=>{
    const planned=new Set(op.plannedShiftIds||[]),verified=new Set(op.verifiedShiftIds||[]),conflicted=new Set(op.conflictedShiftIds||[]);const remaining=[...planned].filter(id=>!verified.has(id)&&!conflicted.has(id));const status=remaining.length?'recoverable':conflicted.size?'partial':'complete';
    const result={operationId:plan.operationId,planDigest:plan.planDigest,status,generation:operation.state.generation,plannedCount:planned.size,committedCount:unique(op.committedShiftIds||[]).length,verifiedCount:verified.size,conflictedCount:conflicted.size,remainingCount:remaining.length,committedShiftIds:unique(op.committedShiftIds||[]),verifiedShiftIds:[...verified],conflictedShiftIds:[...conflicted],remainingShiftIds:remaining,affectedEmployeeIds:unique(plan.candidates.filter(row=>verified.has(row.id)).map(row=>row.employeeId)),affectedDates:unique(plan.candidates.filter(row=>verified.has(row.id)).map(row=>row.date)),affectedRoleIds:unique(plan.candidates.filter(row=>verified.has(row.id)).map(row=>row.rosterRoleId)),timeOff,notificationState,finalizedAt:nowIso,updatedAt:nowIso,leaseExpiresAt:nowIso};
    tx.set(operation.ref,result,{merge:true});
    tx.set(operation.tenantLeaseRef,{status:'released',leaseExpiresAt:nowIso,releasedByOperationId:plan.operationId,releasedGeneration:operation.state.tenantLeaseGeneration,updatedAt:nowIso},{merge:true});
    return result;
  });
}
async function getOperationStatus(db,ctx,{restaurantId,operationId}){
  if(!operationIdPattern.test(clean(operationId))||!clean(restaurantId))throw Object.assign(new Error('A valid operation and tenant are required.'),{statusCode:400,code:'invalid_request'});
  const snap=await db.collection('schedulePublishOperations').doc(clean(operationId)).get();if(!snap.exists||clean(snap.data()?.restaurantId)!==clean(restaurantId))throw Object.assign(new Error('Publication operation is unavailable.'),{statusCode:404,code:'not_found'});const data=snap.data()||{};return{operationId:data.operationId,planDigest:data.planDigest,status:data.status,plannedCount:(data.plannedShiftIds||[]).length,committedCount:(data.committedShiftIds||[]).length,verifiedCount:(data.verifiedShiftIds||[]).length,conflictedCount:(data.conflictedShiftIds||[]).length,remainingCount:(data.remainingShiftIds||[]).length,notificationState:data.notificationState,timeOffState:data.timeOffState,updatedAt:data.updatedAt};
}
async function executeSchedulePublish({db,ctx,body,messaging,auth=null,clock=()=>new Date(),reauthorize=null}={}){
  const input=validateRequest(body),intent=requestDigest(body),existingRef=db.collection('schedulePublishOperations').doc(input.operationId),existingSnap=await existingRef.get();let plan;
  if(existingSnap.exists){const current=existingSnap.data()||{};if(current.restaurantId!==input.restaurantId||current.requestDigest!==intent)throw Object.assign(new Error('This operation ID is already bound to a different publication plan.'),{statusCode:409,code:'operation_plan_mismatch'});plan=current.canonicalPlan;if(!plan)throw Object.assign(new Error('Publication operation cannot be resumed safely.'),{statusCode:409,code:'operation_state_invalid'});}
  else{const [roleConfiguration,shifts,people]=await Promise.all([loadRoleConfiguration(db,input.restaurantId),loadCandidateShifts(db,input.restaurantId,input.dayKeys),loadRosterPeople(db,input.restaurantId)]);for(const shift of shifts)shift._employeeResolution=resolveEmployeeForShift(shift,people);plan=buildCanonicalServerPlan({...body,...input,roles:roleConfiguration.roles,roleConfigurationGeneration:roleConfiguration.generation,shifts,actor:{uid:ctx.uid,email:ctx.email}});}
  const operation=await acquireOperation(db,ctx,plan,clock,intent);if(operation.terminal)return operation.state;if(operation.joined)throw Object.assign(new Error('This publication is already running for this account.'),{statusCode:409,code:'publish_in_progress'});
  try{
    if(reauthorize)await reauthorize();
    const alreadyCommitted=new Set(operation.state.committedShiftIds||[]),alreadyConflicted=new Set(operation.state.conflictedShiftIds||[]);const remaining=plan.candidates.filter(row=>!alreadyCommitted.has(row.id)&&!alreadyConflicted.has(row.id));
    for(let index=0;index<remaining.length;index+=CHUNK_SIZE){if(reauthorize)await reauthorize();await commitChunk(db,operation,plan,remaining.slice(index,index+CHUNK_SIZE),Math.floor(index/CHUNK_SIZE),ctx,clock);}
    const stateAfterCommit=(await operation.ref.get()).data()||{},verification=await verifyCommitted(db,operation,plan,unique(stateAfterCommit.committedShiftIds||[]),clock);const verifiedSet=new Set([...(stateAfterCommit.verifiedShiftIds||[]),...verification.verified]);const verifiedRows=plan.candidates.filter(row=>verifiedSet.has(row.id));
    if(reauthorize)await reauthorize();const timeOff=await processTimeOff(db,ctx,operation,plan,verifiedRows,clock);
    let notificationState={status:'complete',recipientCount:0,acceptedCount:0,failedCount:0,ambiguousCount:0,recipients:[]};if(verifiedRows.length){if(reauthorize)await reauthorize();notificationState=await notifyAffected(db,messaging,auth,operation,plan,verifiedRows,body.restaurantName,clock);}
    return finalizeOperation(db,operation,plan,timeOff,notificationState,clock);
  }catch(error){try{await fencedTransaction(db,operation,plan,clock,(tx,op)=>tx.set(operation.ref,{status:'recoverable',lastErrorCode:clean(error.code||'publish_failed'),lastErrorAt:asDate(clock).toISOString(),remainingCount:(op.remainingShiftIds||[]).length,updatedAt:asDate(clock).toISOString()},{merge:true}),{allowExpired:true});}catch(_){}throw error;}
}

module.exports={LEASE_MS,CHUNK_SIZE,NOTIFICATION_BATCH_SIZE,safeError,requestIntent,requestDigest,validateRequest,loadRoles,loadRoleConfiguration,loadCandidateShifts,loadRosterPeople,resolveEmployeeForShift,assertFenceState,fencedTransaction,acquireOperation,publishedStateMatches,commitChunk,verifyCommitted,processTimeOff,collectEligibleRecipients,notifyAffected,finalizeOperation,getOperationStatus,executeSchedulePublish};
