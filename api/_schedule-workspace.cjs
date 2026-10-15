'use strict';
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const rules = require('../src/core/scheduleWorkspace.shared.js');
const { loadRosterPeople } = require('./_schedule-publish-service.cjs');
const { headRef, recordPublication, materialShift } = require('./_shift-change-review.cjs');
const { canonicalEmployeeIdentity } = require('./_schedule-publish-core.cjs');
const clean = value => String(value == null ? '' : value).trim();
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail = (code,message,statusCode=409) => { throw Object.assign(new Error(message),{code,statusCode}); };
const safeId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{8,160}$/.test(value);
function operationResult(receipt) {
  if(receipt.result)return receipt.result;
  if(!receipt.compressedResult)fail('history_unavailable','This action history is incomplete.');
  const raw=zlib.gunzipSync(Buffer.from(receipt.compressedResult,'base64'),{maxOutputLength:4*1024*1024}).toString('utf8');
  if(hash(raw)!==receipt.resultHash)fail('history_unavailable','This action history failed its integrity check.');
  return JSON.parse(raw);
}
function assertScheduleContext(ctx,tenant) {
  if(!ctx.uid || !tenant || (!ctx.isSuperAdmin && ctx.restaurantId!==tenant))fail('workspace_required','Workspace authorization is required.',403);
  if(!(ctx.isSuperAdmin || ctx.user?.isAdmin || ctx.user?.isOwner || ctx.user?.accountOwner || ctx.user?.workspaceOwner || ctx.permissions?.schedule))fail('schedule_permission_required','Schedule Builder permission is required.',403);
}
function tenantMatches(row,tenant) {
  const identities=['restaurantId','workspaceId','tenantId'].map(field=>clean(row?.[field])).filter(Boolean);
  return identities.length>0 && identities.every(id=>id===tenant);
}
function publicShift(row) {
  if (!row) return null;
  const date=clean(row.scheduleDateKey || row.date),tenant=clean(row.restaurantId || row.workspaceId || row.tenantId);
  return {...rules.workspaceEditable(row),id:row.id,restaurantId:tenant,workspaceId:tenant,scheduleDateKey:date,scheduleMonth:row.scheduleMonth || date.slice(0,7),revision:Number(row.revision || 0),updatedAt:rules.workspaceStamp(row.updatedAt),isPublished:row.isPublished===true || row.published===true,published:row.isPublished===true || row.published===true,publishState:row.publishState || (row.isPublished?'published':'draft'),createdAt:rules.workspaceStamp(row.createdAt),createdBy:clean(row.createdBy),scheduleId:clean(row.scheduleId),publishOperationId:clean(row.publishOperationId),publishGeneration:Number(row.publishGeneration || 0)};
}
async function boundedRead(tx, reference, maximum=1000) {
  const snapshot = await tx.get(reference.limit(maximum+1));
  if (snapshot.docs.length>maximum) fail('incomplete_context','The selected schedule contains more records than can be safely verified. Narrow the selection.');
  return snapshot.docs.map(doc=>({id:doc.id,...doc.data()}));
}
async function loadEditContext(db,tx,restaurantId,dates) {
  const weeks = [...new Set(dates.filter(rules.workspaceDate).map(date=>rules.workspaceWeek(date)[0]))];
  if (weeks.length>8) fail('selection_too_wide','Limit one edit operation to eight weeks.',400);
  const restaurantSnap = await tx.get(db.collection('restaurants').doc(restaurantId));
  if (!restaurantSnap.exists) fail('workspace_unavailable','The restaurant workspace is unavailable.',404);
  const people = await loadRosterPeople(db,restaurantId,{get:ref=>tx.get(ref),limit:1001});
  const [roles,availability,competencies] = await Promise.all(['roles','availabilityRecords','trainingCompetencyReviews'].map(name=>boundedRead(tx,db.collection(name).where('restaurantId','==',restaurantId))));
  const shiftMap = new Map(), offMap = new Map();
  for (const monday of weeks) {
    const start=rules.shiftDateBy(monday,-1),end=rules.shiftDateBy(monday,7);
    for (const field of ['date','scheduleDateKey']) {
      const rows=await boundedRead(tx,db.collection('shifts').where('restaurantId','==',restaurantId).where(field,'>=',start).where(field,'<=',end),5000);
      for (const row of rows) shiftMap.set(row.id,row);
    }
    for (const row of await boundedRead(tx,db.collection('timeOffRequests').where('restaurantId','==',restaurantId).where('date','>=',start).where('date','<=',end))) offMap.set(row.id,row);
  }
  return {people,roles,availability,competencies,shifts:[...shiftMap.values()],timeOff:[...offMap.values()],settings:restaurantSnap.data().systemSettings || {}};
}
function normalizeProposal(patch,current,context,restaurantId) {
  if (!patch || typeof patch!=='object' || Array.isArray(patch)) fail('invalid_patch','A shift edit is required.',400);
  if (Object.keys(patch).some(key=>!rules.editableFields.includes(key))) fail('unsupported_field','Only scheduling fields can be edited.',400);
  for(const [key,value] of Object.entries(patch)) {
    if(['isOpenShift','paidBreak','endsNextDay'].includes(key)){if(typeof value!=='boolean')fail('invalid_field','Use a boolean for shift flags.',400);}
    else if(key==='breakMinutes'){if(typeof value!=='number' || !Number.isInteger(value))fail('invalid_break','Enter whole break minutes.',400);}
    else if(typeof value!=='string' || value.length>2000)fail('invalid_field','Enter valid scheduling text.',400);
    if(['startFold','endFold'].includes(key) && !['earlier','later',''].includes(value))fail('invalid_clock_occurrence','Choose an earlier or later clock occurrence.',400);
  }
  const result={...rules.workspaceEditable(current || {}),...patch};
  result.date=clean(result.date); result.startTime=clean(result.startTime); result.endTime=clean(result.endTime);
  result.notes=clean(result.notes); result.station=clean(result.station);
  result.breakMinutes=Number(result.breakMinutes || 0); result.paidBreak=result.paidBreak===true;
  result.isOpenShift=result.isOpenShift===true;
  const matchingRoles=context.roles.filter(role=>(result.rosterRoleId?role.id===result.rosterRoleId:clean(role.name)===clean(result.role || result.rosterRoleNameSnapshot)) && !role.archived && !role.archivedAt && clean(role.name));
  const role=matchingRoles.length===1?matchingRoles[0]:null;
  if (!role) fail('role_unavailable','Choose one active restaurant role.',400);
  result.rosterRoleId=role.id;
  result.role=clean(role.name); result.rosterRoleNameSnapshot=result.role;
  const identityKeys=['employeeId','scheduleUserId','rosterUserId','userId','authUid','accountUserId','assignedUserId','employeeName','employeeEmail','uid','email','name','userName','userEmail','assignedName','assignedEmail','membershipId','workspaceMemberId'];
  if (result.isOpenShift) for(const key of identityKeys)result[key]='';
  else {
    // Only the selected canonical employee may supply identity fields.
    const selected=clean(patch.employeeId || patch.scheduleUserId || result.employeeId || result.scheduleUserId);
    const matches=context.people.filter(person=>rules.workspaceAliases(person).has(selected) && person.isActive!==false);
    if(matches.length!==1)fail('employee_unavailable','Choose one active employee with a verified roster identity.',400);
    const person=matches[0];
    for(const key of identityKeys)result[key]='';
    const canonical=canonicalEmployeeIdentity(person);
    Object.assign(result,canonical,{uid:canonical.authUid,email:canonical.employeeEmail,userEmail:canonical.employeeEmail,name:canonical.employeeName,userName:canonical.employeeName});
    if (role.requiresVerifiedCompetency===true && !context.competencies.some(review=>review.userId===result.authUid && review.roleId===role.id && review.reviewedBy && review.reviewedBy!==review.userId && !review.revokedAt && (!review.expiresAt || Date.parse(review.expiresAt)>Date.now()))) fail('role_qualification','This role requires current manager-verified competency.',400);
  }
  return {...result,location:result.station,shiftNotes:result.notes,openShift:result.isOpenShift,assignmentStatus:result.isOpenShift?'open':'assigned',restaurantId,workspaceId:restaurantId,scheduleDateKey:result.date,scheduleMonth:result.date.slice(0,7)};
}
async function editScheduleWorkspace({db,ctx,body,clock=()=>new Date()}) {
  const tenant=clean(body.restaurantId),actor=clean(ctx.uid);
  assertScheduleContext(ctx,tenant);
  if(!safeId(body.operationId))fail('operation_required','A durable edit operation identity is required.',400);
  if(body.undoOf && !safeId(body.undoOf))fail('invalid_history','Choose a valid history operation.',400);
  const intent=hash({actor,changes:body.changes || null,undoOf:body.undoOf || null,confirmedPublished:body.confirmedPublished===true,acknowledgedWarnings:body.acknowledgedWarnings===true,reason:clean(body.reason)});
  const operationId=hash([tenant,body.operationId]);
  const opRef=db.collection('scheduleEditOperations').doc(operationId);
  return db.runTransaction(async tx=>{
    const prior=await tx.get(opRef);
    if(prior.exists){
      if(prior.data().restaurantId!==tenant || prior.data().intent!==intent || prior.data().actor!==actor)fail('operation_reused','This operation identity was already used for a different edit.');
      const original=operationResult(prior.data());
      const current=[];
      const refs=(original.results || []).flatMap(row=>[db.collection('shifts').doc(row.id),db.collection('scheduleRevisionHeads').doc(hash([tenant,row.id]))]);
      const snapshots=refs.length?(tx.getAll?await tx.getAll(...refs):await Promise.all(refs.map(ref=>tx.get(ref)))):[];
      for(const [index,row] of (original.results || []).entries()){
        const [snapshot,revision]=snapshots.slice(index*2,index*2+2);
        const after=snapshot.exists && tenantMatches(snapshot.data(),tenant)?publicShift({id:row.id,...snapshot.data()}):null;
        current.push({id:row.id,before:row.before,after,currentRevision:Math.max(Number(after?.revision || 0),Number(revision.exists?revision.data().revision:0))});
      }
      return{...original,duplicate:true,currentResults:current};
    }
    let changes=body.changes;
    if(body.undoOf){
      const receipt=await tx.get(db.collection('scheduleEditOperations').doc(body.undoOf));
      if(!receipt.exists || receipt.data().restaurantId!==tenant || receipt.data().actor!==actor)fail('history_unavailable','This action history is unavailable.',404);
      changes=operationResult(receipt.data()).results.map(row=>({kind:row.before?'update':'delete',id:row.id,expected:rules.workspaceEvidence(row.after),expectedHead:row.afterHeadVersion,patch:row.before?rules.workspaceEditable(row.before):undefined,restore:!row.after,restoredRevision:Number(row.before?.revision || 0)+2,restoredPublication:row.before}));
    }
    if(!Array.isArray(changes) || !changes.length || changes.length>150)fail('invalid_changes','Choose between one and 150 shift changes.',400);
    const lease=await tx.get(db.collection('schedulePublishLeases').doc(crypto.createHash('sha256').update(tenant).digest('hex')));
    if(lease.exists && Date.parse(lease.data().leaseExpiresAt || '')>clock().getTime())fail('publication_active','Wait for the active schedule publication to finish before editing.');
    const seen=new Set(), records=[],references=[];
    for(let index=0;index<changes.length;index++){
      const change=changes[index];
      if(!['create','update','delete'].includes(change.kind))fail('invalid_change','Choose a supported shift action.',400);
      const id=change.kind==='create'?`sw_${hash([tenant,body.operationId,index]).slice(0,28)}`:clean(change.id);
      if(!id || id.length>256 || /[\/\u0000-\u001f]/.test(id) || ['.','..'].includes(id) || seen.has(id))fail('invalid_shift_identity','Every change requires a distinct shift identity.',400);
      if(change.restore && !body.undoOf)fail('invalid_restore','Use authorized action history for restoration.',400);
      seen.add(id);
      references.push({change,id,ref:db.collection('shifts').doc(id),publicationRef:headRef(db,tenant,id),revisionRef:db.collection('scheduleRevisionHeads').doc(hash([tenant,id]))});
    }
    const readRefs=references.flatMap(row=>[row.ref,row.publicationRef,row.revisionRef]);
    const snapshots=tx.getAll?await tx.getAll(...readRefs):await Promise.all(readRefs.map(ref=>tx.get(ref)));
    for(let index=0;index<references.length;index++){
      const {change,id,ref,revisionRef}=references[index];
      const [snapshot,head,revisionHead]=snapshots.slice(index*3,index*3+3),current=snapshot.exists?{id,...snapshot.data()}:null;
      if(current && (!Number.isInteger(Number(current.revision || 0)) || Number(current.revision || 0)<0))fail('invalid_revision','This shift has invalid revision evidence. Repair its identity before editing.');
      if(current && !tenantMatches(current,tenant))fail('shift_unavailable','This shift is unavailable in the current workspace.',404);
      if(change.kind==='create' && current)fail('shift_exists','This shift identity already exists.');
      if(change.kind!=='create' && (!Object.prototype.hasOwnProperty.call(change,'expected') || change.expected!==rules.workspaceEvidence(current)))fail('shift_changed','The shift changed after you opened it. Reload before editing or undoing.');
      if(body.undoOf && (!revisionHead.exists || revisionHead.data().version!==change.expectedHead))fail('shift_changed','A newer action affected this shift. Older history cannot replace it.');
      if(change.kind!=='create' && !current && !change.restore)fail('shift_missing','The shift is no longer available.');
      records.push({change,id,ref,current,head:head.exists?head.data():null,revisionRef,revisionHead:revisionHead.exists?revisionHead.data():null});
    }
    const dates=records.flatMap(({change,current})=>[current?.scheduleDateKey || current?.date,change.patch?.date]).filter(Boolean);
    const context=await loadEditContext(db,tx,tenant,dates);
    const at=clock().toISOString(),proposals=[];
    for(const record of records){
      const {change,id,current}=record;
      const next=change.kind==='delete'?null:{...normalizeProposal(change.patch,current,context,tenant),id};
      proposals.push({...record,next});
    }
    const replaced=new Set(records.map(row=>row.id));
    const finalShifts=[...context.shifts.filter(row=>!replaced.has(row.id)),...proposals.map(row=>row.next).filter(Boolean)];
    const warnings=[];
    const changed=proposals.filter(row=>!row.next || !row.current || rules.workspaceEvidence({...row.next,revision:row.current.revision,updatedAt:row.current.updatedAt,isPublished:row.current.isPublished,published:row.current.published})!==rules.workspaceEvidence(row.current));
    if(!changed.length)return{ok:true,noChange:true,results:[],warnings:[],events:[]};
    for(const row of changed)if(row.next){
      const validation=rules.validateWorkspaceShift(row.next,{...context,shifts:finalShifts,now:clock().getTime()});
      if(!validation.ok)throw Object.assign(new Error(validation.errors[0].message),{statusCode:409,code:'shift_constraints',findings:validation.errors});
      warnings.push(...validation.warnings.map(warning=>({...warning,shiftId:row.id})));
    }
    if(warnings.length && body.acknowledgedWarnings!==true)throw Object.assign(new Error('Review the scheduling warnings before saving.'),{statusCode:409,code:'review_warnings',findings:warnings});
    const published=changed.some(row=>row.current?.isPublished || row.current?.published || row.head);
    if(changed.filter(row=>row.current?.isPublished || row.current?.published || row.head).length>100)fail('published_selection_limit','Review at most 100 published changes in one atomic operation.',400);
    if(published && (body.confirmedPublished!==true || clean(body.reason).length<4))fail('published_review_required','Preview and confirm the published change with a reason.',400);
    const results=[],events=[];
    for(const {id,ref,current,head,next,change,revisionRef,revisionHead} of changed){
      if(next && rules.workspaceEvidence({...next,revision:current?.revision,updatedAt:current?.updatedAt,isPublished:current?.isPublished,published:current?.published})===rules.workspaceEvidence(current))continue;
      let saved=null;
      if(next){
        const publishedNow=Boolean(current?.isPublished || current?.published || (change.restore && change.restoredPublication?.isPublished));
        saved={...next,revision:Math.max(Number(current?.revision || 0),Number(revisionHead?.revision || 0))+1,updatedAt:at,updatedBy:actor,createdAt:current?.createdAt || change.restoredPublication?.createdAt || at,createdBy:current?.createdBy || change.restoredPublication?.createdBy || actor,isPublished:publishedNow,published:publishedNow,publishState:publishedNow?'published':'draft',status:publishedNow?'published':'draft',publishStatus:publishedNow?'published':'draft',scheduleBuilderDraft:!publishedNow,readyToPublish:true,assignmentType:next.isOpenShift?'open':'assigned',assignmentSource:'schedule-workspace'};
        if(publishedNow)Object.assign(saved,{scheduleId:current?.scheduleId || change.restoredPublication?.scheduleId || `schedule_edit_${operationId}`,publishOperationId:operationId,publishGeneration:Number(current?.publishGeneration || change.restoredPublication?.publishGeneration || 0),publishedAt:at});
        // Merge scheduling fields only; payroll/inventory/POS fields are never supplied by this endpoint.
        if(current)tx.update(ref,Object.fromEntries(Object.entries(saved).filter(([key])=>key!=='id')));
        else tx.create(ref,Object.fromEntries(Object.entries(saved).filter(([key])=>key!=='id')));
      } else tx.delete(ref);
      if(saved?.isPublished || current?.isPublished || current?.published || (head && !saved)){
        const before=head?{...head,after:{...materialShift(current || {}),...head.after}}:{after:materialShift(current || {})};
        const event=recordPublication({db,tx,head:before,tenant,shiftId:id,shift:saved || {...current,cancelled:true},operationId,actor,at});
        if(event)events.push({version:event.version,shiftId:id});
      }
      const revision=Math.max(Number(current?.revision || 0),Number(revisionHead?.revision || 0))+1;
      const afterHeadVersion=hash([tenant,id,operationId,revision]);
      tx.set(revisionRef,{restaurantId:tenant,shiftId:id,version:afterHeadVersion,revision,exists:Boolean(saved),updatedAt:at,actor,operationId});
      results.push({id,before:publicShift(current),after:publicShift(saved),afterHeadVersion});
    }
    if(!results.length)return{ok:true,noChange:true,results:[],warnings,events:[]};
    const result={ok:true,operationId,results,warnings,events,notificationState:events.length?'in-app-change-recorded':'not-applicable',authoritative:true};
    const serialized=JSON.stringify(result);
    if(Buffer.byteLength(serialized)>4*1024*1024)fail('history_too_large','Split this selection so every change can retain safe recovery evidence.',400);
    const historyPayload=Buffer.byteLength(serialized)<300000?{result}:{compressedResult:zlib.gzipSync(serialized).toString('base64'),resultHash:hash(serialized)};
    if(Buffer.byteLength(JSON.stringify(historyPayload))>800000)fail('history_too_large','Split this selection so every change can retain safe recovery evidence.',400);
    tx.create(opRef,{restaurantId:tenant,actor,intent,createdAt:at,undoOf:body.undoOf || '',reason:clean(body.reason),...historyPayload});
    tx.create(db.collection('auditLogs').doc(),{restaurantId:tenant,userId:actor,action:body.undoOf?'SCHEDULE_ACTION_COMPENSATED':'SCHEDULE_WORKSPACE_EDIT',target:opRef.path,timestamp:at,details:{operationId,shiftIds:results.map(row=>row.id),published,reason:clean(body.reason),eventVersions:events.map(row=>row.version)}});
    return result;
  });
}
async function readScheduleWorkspace({db,ctx,body,clock=()=>new Date()}) {
  const tenant=clean(body.restaurantId);assertScheduleContext(ctx,tenant);
  if(!Array.isArray(body.ids) || !body.ids.length || body.ids.length>150 || new Set(body.ids).size!==body.ids.length || body.ids.some(id=>typeof id!=='string' || !id || id.length>256 || /[\/\u0000-\u001f]/.test(id) || ['.','..'].includes(id)))fail('invalid_shift_identity','Choose one to 150 distinct shift identities.',400);
  return db.runTransaction(async tx=>{
    const refs=body.ids.map(id=>db.collection('shifts').doc(id));
    const snapshots=tx.getAll?await tx.getAll(...refs):await Promise.all(refs.map(ref=>tx.get(ref)));
    return {ok:true,authoritative:true,verifiedAt:clock().toISOString(),shifts:snapshots.map((snapshot,index)=>snapshot.exists && tenantMatches(snapshot.data(),tenant)?publicShift({id:body.ids[index],...snapshot.data()}):{id:body.ids[index],exists:false})};
  });
}
async function readScheduleWeek({db,ctx,body,clock=()=>new Date()}) {
  const tenant=clean(body.restaurantId),weekStart=clean(body.weekStart);
  assertScheduleContext(ctx,tenant);
  if(!rules.workspaceDate(weekStart) || rules.workspaceWeek(weekStart)[0]!==weekStart)fail('invalid_week','Choose a Monday schedule week.',400);
  const dateStart=rules.shiftDateBy(weekStart,-1),dateEnd=rules.shiftDateBy(weekStart,7);
  return db.runTransaction(async tx=>{
    const rows=new Map();
    for(const field of ['date','scheduleDateKey']){
      for(const row of await boundedRead(tx,db.collection('shifts').where('restaurantId','==',tenant).where(field,'>=',dateStart).where(field,'<=',dateEnd),5000)){
        if(!tenantMatches(row,tenant))fail('workspace_mismatch','The schedule contains conflicting workspace identities.',409);
        // The editor projection omits archival metadata. Filter before projecting
        // so a cancelled/deleted legacy record can never reappear as an active shift.
        if(rules.workspaceActive(row))rows.set(row.id,publicShift(row));
      }
    }
    if(rows.size>5000)fail('incomplete_context','This week exceeds the safe verification limit. Narrow the schedule selection.');
    return {ok:true,authoritative:true,restaurantId:tenant,weekStart,dateStart,dateEnd,verifiedAt:clock().toISOString(),shifts:[...rows.values()]};
  });
}
module.exports={editScheduleWorkspace,readScheduleWorkspace,readScheduleWeek,loadEditContext,normalizeProposal,publicShift,boundedRead,operationResult,tenantMatches};
