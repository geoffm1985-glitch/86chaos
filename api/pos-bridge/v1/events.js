'use strict';
const {handler,json,readBoundedJson,method,requireContract:baseRequireContract,rejectMachineAuthorityOverrides,assertKeys}=require('../../_pos-bridge-route');
function requireContract(req){baseRequireContract(req);rejectMachineAuthorityOverrides(req);if(req.method==='POST')assertKeys(req.body||{},['contractVersion','events']);else assertKeys(req.query||{},['eventId']);}
const {getPosBridgeAdminApp:getAdminAppForRequest}=require('../../_pos-bridge-project');
const {verifyAccessToken,admitRate}=require('../../_pos-bridge-auth');
const {LIMITS}=require('../../_pos-bridge-config');
const {receiptByEventId}=require('../../_pos-bridge-storage');
const {processEventBatch}=require('../../_pos-bridge-events');
module.exports=handler(async(req,res)=>{method(req,['GET','POST']);requireContract(req);const db=getAdminAppForRequest(req,{requireCredentials:true}).firestore();const auth=await verifyAccessToken(db,req,{requiredCapability:req.method==='POST'?'event.staging':'receipt.read'});if(req.method==='GET'){await admitRate(db,auth.claims.posInstallationId,'read');const eventId=String(req.query?.eventId||'').trim();if(!/^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,127}$/.test(eventId))throw Object.assign(new Error('Event ID required.'),{code:'invalid_request',statusCode:400});return json(res,200,{ok:true,receipt:await receiptByEventId(db,auth,eventId)});}
  const body=readBoundedJson(req);const events=Array.isArray(body.events)?body.events:[];if(!events.length||events.length>LIMITS.maxBatchEvents)throw Object.assign(new Error('Invalid event batch.'),{code:'invalid_request',statusCode:400});await admitRate(db,auth.claims.posInstallationId,'eventRequest');const sequences=events.map(e=>Number(e?.sequence));if(Math.max(...sequences)-Math.min(...sequences)>LIMITS.maxBatchSequenceSpan)throw Object.assign(new Error('Batch sequence span too large.'),{code:'invalid_request',statusCode:400});for(const event of events)if(event?.posInstallationId!==auth.claims.posInstallationId)throw Object.assign(new Error('Installation mismatch.'),{code:'forbidden',statusCode:403});
  await admitRate(db,auth.claims.posInstallationId,'event',events.length);const result=await processEventBatch(db,auth,events);json(res,result.ok?200:207,result);
});
