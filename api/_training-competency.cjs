'use strict';
const { safeId, assertTenant, hash } = require('./_invoice-approval');
const { memberDocId, inactiveRecord, legacyMembershipFallbackAllowed } = require('./_chaos-admin');
const fail = (message, statusCode=400) => { throw Object.assign(new Error(message),{statusCode}); };
const canReview = ctx => Boolean(ctx.isSuperAdmin || ctx.user?.isAdmin || ctx.user?.isOwner || ctx.user?.accountOwner || ctx.permissions?.hr || ctx.permissions?.team);
function taskEvidence(id, row) { return {id,userId:row.userId,title:String(row.title || '').slice(0,200),completedAt:String(row.completedAt || ''),completed:row.completed===true}; }
function reviewId(tenant, operationId) { return hash(JSON.stringify([tenant,operationId])); }
async function trainingCompetency({db,ctx,body,clock=()=>new Date()}) {
  if (!ctx.uid || !ctx.restaurantId || ctx.restaurantId!==body.restaurantId) fail('Workspace authorization is required.',403);
  const manager=canReview(ctx),collection=db.collection('trainingCompetencyReviews');
  if(body.action==='training-competency-list') {
    if(body.scope==='workspace'&&!manager)fail('HR review permission is required.',403);
    let query=collection.where('restaurantId','==',ctx.restaurantId);
    if(body.scope!=='workspace')query=query.where('userId','==',ctx.uid);
    query=query.orderBy('__name__').limit(51);
    if(body.cursor){if(!safeId(body.cursor))fail('Invalid review cursor.');query=query.startAfter(body.cursor);}
    const snap=await query.get(),page=snap.docs.slice(0,50);
    const rows=await Promise.all(page.map(async doc=>{
      const row=doc.data();const checks=await Promise.all(row.evidence.map(task=>db.collection('hrOnboardingTasks').doc(task.id).get()));
      const evidenceCurrent=checks.every((task,i)=>task.exists&&task.data().restaurantId===ctx.restaurantId&&JSON.stringify(taskEvidence(task.id,task.data()))===JSON.stringify(row.evidence[i]));
      return{...row,id:doc.id,evidenceCurrent,expired:Boolean(row.expiresAt&&Date.parse(row.expiresAt)<=clock().getTime())};
    }));
    return{rows,nextCursor:snap.docs.length>50?page.at(-1).id:null,complete:snap.docs.length<=50};
  }
  if(!manager)fail('HR review permission is required.',403);
  if(body.action==='training-competency-revoke') {
    if(!safeId(body.reviewId)||body.confirmed!==true||String(body.note||'').trim().length<4)fail('Select a review and explain the revocation.');
    return db.runTransaction(async tx=>{
      const ref=collection.doc(body.reviewId),snap=await tx.get(ref);assertTenant(snap.exists?snap.data():null,ctx.restaurantId);
      const previous=snap.data();if(previous.revokedAt)return{id:ref.id,duplicate:true};
      if(body.expectedReviewedAt!==previous.reviewedAt)fail('Reload this competency review before revoking it.',409);
      const at=clock().toISOString(),patch={revokedAt:at,revokedBy:ctx.uid,revocationNote:String(body.note).trim().slice(0,1000)};
      tx.update(ref,patch);tx.create(db.collection('auditLogs').doc(),{restaurantId:ctx.restaurantId,userId:ctx.uid,action:'TRAINING_COMPETENCY_REVOKED',target:ref.path,timestamp:at,details:patch});
      return{id:ref.id,...patch};
    });
  }
  const evidence=Array.isArray(body.evidence)?body.evidence:[];
  if(body.action!=='training-competency-review'||body.confirmed!==true||!safeId(body.operationId)||!safeId(body.userId)||!safeId(body.roleId)||!String(body.station||'').trim()||String(body.station).length>100||String(body.note||'').trim().length<4||String(body.note).length>1000||!evidence.length||evidence.length>20||new Set(evidence.map(row=>row.id)).size!==evidence.length||evidence.some(row=>!safeId(row.id)||!row.completedAt))fail('Select an employee, role, station and completed evidence; explicitly confirm the observed competency.');
  if(body.userId===ctx.uid)fail('Another authorized reviewer must verify your competency.',403);
  const at=clock().toISOString();let expiresAt='';
  if(body.expiresAt){if(!Number.isFinite(Date.parse(body.expiresAt)))fail('Choose a valid review expiration.');expiresAt=new Date(body.expiresAt).toISOString();}
  if(expiresAt&&Date.parse(expiresAt)<=Date.parse(at))fail('The review expiration must be in the future.');
  const intent=hash(JSON.stringify([body.userId,body.roleId,String(body.station).trim(),String(body.note).trim(),expiresAt,evidence.map(row=>[row.id,row.completedAt]).sort()]));
  return db.runTransaction(async tx=>{
    const ref=collection.doc(reviewId(ctx.restaurantId,body.operationId));
    const [prior,user,member,role]=await Promise.all([tx.get(ref),tx.get(db.collection('users').doc(body.userId)),tx.get(db.collection('workspaceMembers').doc(memberDocId(body.userId,ctx.restaurantId))),tx.get(db.collection('roles').doc(body.roleId))]);
    if(prior.exists){if(prior.data().intent!==intent)fail('This review identity was already used for different evidence.',409);return{id:ref.id,review:prior.data(),duplicate:true};}
    const account=user.exists?user.data():null,membership=member.exists?member.data():null;
    if(inactiveRecord(account)||membership&&inactiveRecord(membership))fail('The employee is unavailable.',404);
    const migrated=account.membershipMigrationVersion>=2||account.workspaceIds?.includes(ctx.restaurantId)||account.memberships?.[ctx.restaurantId];
    if(membership){assertTenant(membership,ctx.restaurantId);}else if(migrated||!legacyMembershipFallbackAllowed(account,ctx.restaurantId))fail('The employee is unavailable.',404);
    assertTenant(role.exists?role.data():null,ctx.restaurantId);if(role.data().archived||role.data().archivedAt)fail('Choose an active roster role.');
    const snapshots=[];for(const row of evidence)snapshots.push(await tx.get(db.collection('hrOnboardingTasks').doc(row.id)));
    const verified=snapshots.map((snap,i)=>{const task=snap.exists?snap.data():null;assertTenant(task,ctx.restaurantId);if(task.userId!==body.userId||task.completed!==true||task.completedAt!==evidence[i].completedAt||!Number.isFinite(Date.parse(task.completedAt))||Date.parse(task.completedAt)>Date.parse(at))fail('Training evidence changed or is incomplete. Reload before review.',409);return taskEvidence(snap.id,task);});
    const review={restaurantId:ctx.restaurantId,userId:body.userId,employeeName:String(account.name||'Employee'),roleId:body.roleId,roleName:String(role.data().name||''),station:String(body.station).trim(),note:String(body.note).trim(),evidence:verified,intent,reviewedAt:at,reviewedBy:ctx.uid,expiresAt,revokedAt:'',meaning:'Manager-observed competency; separate from checklist completion and legal certification.'};
    tx.create(ref,review);tx.create(db.collection('auditLogs').doc(),{restaurantId:ctx.restaurantId,userId:ctx.uid,action:'TRAINING_COMPETENCY_REVIEWED',target:ref.path,timestamp:at,details:{userId:body.userId,roleId:body.roleId,station:review.station,evidenceIds:verified.map(row=>row.id)}});
    return{id:ref.id,review};
  });
}
module.exports={trainingCompetency,canReview,taskEvidence,reviewId};
