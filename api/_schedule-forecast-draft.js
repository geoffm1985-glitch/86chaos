'use strict';
const {forecastDraftId,saveForecastDraft}=require('../src/core/intelligenceConnections.cjs');
const {buildCanonicalScheduleCreateFields}=require('../src/core/scheduleIntegrity.shared');
const fail=(message,statusCode=400)=>{throw Object.assign(new Error(message),{statusCode});};
const validDate=value=>typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;
const validTime=value=>typeof value==='string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);

async function createReviewedForecastDraft({db,ctx,body,now=new Date().toISOString()}) {
  const restaurantId=body.restaurantId,user=ctx.user || {},permissions=ctx.permissions || {};
  if(typeof restaurantId!=='string' || !restaurantId || restaurantId.length>300 || (!ctx.isSuperAdmin && ctx.restaurantId!==restaurantId) || (!ctx.isSuperAdmin && user.isOwner!==true && user.accountOwner!==true && user.workspaceOwner!==true && permissions.schedule!==true && permissions.team!==true))fail('Schedule review permission is required.',403);
  if(body.approved!==true || !validDate(body.date) || typeof body.targetId!=='string' || !body.targetId || body.targetId.includes('/') || body.targetId.length>300 || !Number.isInteger(body.slot) || body.slot<0 || body.slot>=50)fail('Review a valid forecast target and draft slot.');
  const data=body.data || {};
  if(data.restaurantId!==restaurantId || (data.workspaceId && data.workspaceId!==restaurantId) || (data.date && data.date!==body.date) || (data.scheduleDateKey && data.scheduleDateKey!==body.date) || data.source!=='demand_forecast_review' || data.isPublished!==false || data.publishState!=='draft' || !validTime(data.startTime) || !validTime(data.endTime) || data.startTime===data.endTime)fail('Forecast drafts must remain unpublished in this workspace.');
  const id=forecastDraftId({workspaceId:restaurantId,targetId:body.targetId,date:body.date},restaurantId,body.slot);
  if(Buffer.byteLength(id)>1500 || (body.docId && body.docId!==id))fail('Forecast draft identity does not match its target.');
  const evidence=data.forecastEvidence;
  if(!evidence || !Array.isArray(evidence.dates) || evidence.dates.length<3 || evidence.dates.length>8 || new Set(evidence.dates).size!==evidence.dates.length || evidence.dates.some(date=>!validDate(date) || date>=body.date || new Date(date).getUTCDay()!==new Date(body.date).getUTCDay()) || ['average','expectedDemand'].some(key=>!Number.isFinite(evidence[key]) || evidence[key]<=0 || evidence[key]>1e12) || !Number.isFinite(evidence.recent) || evidence.recent<0 || evidence.recent>1e12 || !Number.isFinite(evidence.factor) || evidence.factor<0.8 || evidence.factor>1.5)fail('Dated comparable forecast evidence is required.');
  const identity={};
  for(const key of ['employeeId','scheduleUserId','userId','authUid','rosterUserId','accountUserId','assignedUserId','employeeName','assignedName','employeeEmail','assignedEmail'])if(data[key]!==undefined){if(typeof data[key]!=='string' || data[key].length>(key.endsWith('Email')?320:200))fail('Invalid schedule assignment identity.');identity[key]=data[key];}
  const actor=ctx.uid || ctx.email;
  if(!actor)fail('Verified reviewer identity is required.',403);
  const payload={...buildCanonicalScheduleCreateFields(body.date,restaurantId),...identity,role:String(data.role || '').trim(),targetRole:String(data.targetRole || data.role || '').trim(),startTime:data.startTime,endTime:data.endTime,isPublished:false,publishState:'draft',scheduleBuilderDraft:true,readyToPublish:true,createdAt:now,updatedAt:now,createdBy:actor,updatedBy:actor,source:'demand_forecast_review',assignmentSource:'schedule_copilot',forecastEvidence:{dates:[...evidence.dates],average:evidence.average,recent:evidence.recent,expectedDemand:evidence.expectedDemand,factor:evidence.factor},forecastReviewedAt:now,forecastReviewedBy:actor};
  const ref=db.collection('shifts').doc(id),targetRef=db.collection('scheduleCoverageTargets').doc(body.targetId);
  const result=await saveForecastDraft({ref,payload,transact:callback=>db.runTransaction(async tx=>{
    const targetSnapshot=await tx.get(targetRef),target=targetSnapshot.data() || {};
    if(!targetSnapshot.exists || target.restaurantId!==restaurantId)fail('Coverage target belongs to another workspace or no longer exists.',403);
    if(Number(target.dayIndex)!==new Date(body.date).getUTCDay() || !Number.isFinite(Number(target.count)) || Number(target.count)<=0 || Number(target.count)>50 || String(target.role || '').trim().toLowerCase()!==payload.targetRole.toLowerCase() || target.startTime!==payload.startTime || target.endTime!==payload.endTime)fail('Coverage target changed. Reload and review the forecast.',409);
    payload.role=target.role;payload.targetRole=target.role;
    return callback({get:async document=>{const snap=await tx.get(document);if(snap.exists && snap.data().restaurantId!==restaurantId)fail('Draft identity belongs to another workspace.',409);return {exists:()=>snap.exists,data:()=>snap.data()};},set:(document,value)=>tx.create(document,value)});
  })});
  return {id,created:result.created};
}
module.exports={createReviewedForecastDraft};
