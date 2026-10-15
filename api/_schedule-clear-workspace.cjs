'use strict';
const crypto=require('node:crypto'),zlib=require('node:zlib');
const {editScheduleWorkspace,tenantMatches}=require('./_schedule-workspace.cjs');
const {workspaceEvidence}=require('../src/core/scheduleWorkspace.shared.js');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const fail=(code,message,statusCode=409)=>{throw Object.assign(new Error(message),{code,statusCode});};
function authority(ctx,tenant) {
  if(!ctx.uid || !tenant || (!ctx.isSuperAdmin && ctx.restaurantId!==tenant) || !(ctx.isSuperAdmin || ctx.user?.isAdmin || ctx.user?.isOwner || ctx.user?.accountOwner || ctx.user?.workspaceOwner || ctx.permissions?.schedule))fail('schedule_permission_required','Schedule Builder permission is required.',403);
}
function groupRef(db,id) {
  if(typeof id!=='string' || !/^[A-Za-z0-9_-]{8,160}$/.test(id))fail('review_required','Review the current month before clearing shifts.',400);
  return db.collection('scheduleClearOperations').doc(id);
}
function checkedGroup(snapshot,ctx,tenant) {
  if(!snapshot.exists || snapshot.data().restaurantId!==tenant || snapshot.data().actor!==ctx.uid)fail('review_unavailable','This month-clear review is unavailable.',404);
  return snapshot.data();
}
async function prepareScheduleClear({db,ctx,restaurantId,month,rows,clock=()=>new Date()}) {
  authority(ctx,restaurantId);
  if(!Array.isArray(rows) || rows.length>5000)fail('review_too_large','Review smaller schedule periods before clearing more than 5,000 shifts.',400);
  if(rows.some(row=>!tenantMatches(row,restaurantId)))fail('workspace_identity_conflict','Repair contradictory shift workspace identities before clearing this month.');
  const changes=rows.map(row=>({kind:'delete',id:row.id,expected:workspaceEvidence(row)}));
  if(new Set(changes.map(row=>row.id)).size!==changes.length)fail('invalid_shift_identity','Month review contains duplicate shift identities.');
  const raw=JSON.stringify(changes),compressed=zlib.gzipSync(raw).toString('base64');
  if(Buffer.byteLength(raw)>16*1024*1024 || Buffer.byteLength(compressed)>800000)fail('review_too_large','Split this month review so recovery evidence fits safely.',400);
  const id=crypto.randomUUID(),ref=groupRef(db,id);
  const group={restaurantId,actor:ctx.uid,month,createdAt:clock().toISOString(),status:changes.length?'review':'cleared',count:changes.length,publishedCount:rows.filter(row=>row.isPublished || row.published || row.status==='published').length,shiftIds:changes.map(row=>row.id),changesGzip:compressed,changesHash:hash(raw),nextChunk:0,receipts:[],lease:null};
  if(Buffer.byteLength(JSON.stringify(group))>950000)fail('review_too_large','Split this month review so recovery evidence fits safely.',400);
  await db.runTransaction(async tx=>{tx.create(ref,group);});
  return {ok:true,reviewId:id,month,count:rows.length,publishedCount:rows.filter(row=>row.isPublished || row.published || row.status==='published').length,authoritative:true};
}
async function advanceScheduleClear({db,ctx,body,clock=()=>new Date()}) {
  const tenant=body.restaurantId;authority(ctx,tenant);
  const ref=groupRef(db,body.reviewId),restore=body.action==='restore-cleared-month',action=restore?'restore':'clear';
  if(body.confirmed!==true || typeof body.reason!=='string' || body.reason.trim().length<4 || body.reason.length>500)fail('review_required','Explicitly confirm this reviewed operation with a reason.',400);
  const intent=hash(JSON.stringify({reason:body.reason.trim(),confirmed:true}));
  const step=await db.runTransaction(async tx=>{
    const group=checkedGroup(await tx.get(ref),ctx,tenant);
    if(group.status===(restore?'restored':'cleared'))return{done:true,group};
    if(!restore && ['restoring','restored'].includes(group.status))fail('review_finished','This clear was restored. Start a fresh review before clearing again.');
    if(group.lease && group.lease.action!==action)fail('outcome_unknown','Resume the interrupted operation to confirm its outcome before changing recovery direction.');
    const intentKey=restore?'restoreIntent':'clearIntent';
    if(group[intentKey] && group[intentKey]!==intent)fail('operation_reused','Resume this operation using its original reviewed reason.');
    const index=restore?(group.restoreIndex ?? group.receipts.length-1):group.nextChunk;
    if(restore && index<0){tx.update(ref,{status:'restored',lease:null});return{done:true,group:{...group,status:'restored'}};}
    const lease={action,index};
    tx.update(ref,{status:restore?'restoring':'clearing',[intentKey]:intent,...(restore?{restoreIndex:index}:{}),lease,updatedAt:clock().toISOString()});
    return{group,index,lease};
  });
  const summary=(group,result={results:[]})=>({ok:true,reviewId:body.reviewId,month:group.month,done:group.status===(restore?'restored':'cleared'),status:group.status,initialCount:group.count,deletedCount:group.receipts.reduce((total,row)=>total+row.count,0),remainingCount:Math.max(0,group.count-group.receipts.reduce((total,row)=>total+row.count,0)),restoredCount:group.restoredCount || 0,reviewedShiftIds:group.shiftIds,results:result.currentResults || result.results,authoritative:true});
  if(step.done)return summary(step.group);
  const {group,index}=step;
  const raw=zlib.gunzipSync(Buffer.from(group.changesGzip,'base64'),{maxOutputLength:16*1024*1024}).toString('utf8');
  if(hash(raw)!==group.changesHash)fail('review_corrupt','The reviewed shift identities failed their integrity check.');
  const changes=JSON.parse(raw).slice(index*100,(index+1)*100);
  let result;
  try {
    result=await editScheduleWorkspace({db,ctx,clock,body:{restaurantId:tenant,operationId:`month_${body.reviewId}_${action}_${index}`,acknowledgedWarnings:true,confirmedPublished:true,reason:body.reason.trim(),...(restore?{undoOf:group.receipts[index].operationId}:{changes})}});
  } catch(error) {
    // Only an authoritative rejection can release the reservation. Network errors retain it for exact retry.
    if(error.statusCode && error.statusCode<500)await db.runTransaction(async tx=>{const current=checkedGroup(await tx.get(ref),ctx,tenant);if(current.lease?.action===action && current.lease.index===index)tx.update(ref,{lease:null});});
    throw error;
  }
  const updated=await db.runTransaction(async tx=>{
    const current=checkedGroup(await tx.get(ref),ctx,tenant);
    if(current.lease?.action!==action || current.lease.index!==index)return current;
    let next;
    if(restore)next={...current,restoreIndex:index-1,restoredCount:(current.restoredCount || 0)+result.results.length,status:index===0?'restored':'restoring',lease:null};
    else {const receipts=[...current.receipts,{index,operationId:result.operationId,count:result.results.length}];next={...current,receipts,nextChunk:index+1,status:(index+1)*100>=current.count?'cleared':'clearing',lease:null};}
    tx.set(ref,{...next,updatedAt:clock().toISOString()});return next;
  });
  return summary(updated,result);
}
module.exports={prepareScheduleClear,advanceScheduleClear};
