'use strict';
const { getMessaging } = require('firebase-admin/messaging');
const { initAdmin, authorize, requireAppCheckIfEnforced } = require('./_chaos-admin');
const { executeSchedulePublish, getOperationStatus, safeError } = require('./_schedule-publish-service.cjs');

const MAX_BODY_BYTES = 2 * 1024 * 1024;
function bodyBytes(req) { try { return Buffer.byteLength(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}),'utf8'); } catch (_) { return MAX_BODY_BYTES + 1; } }
function parseBody(req) {
  if (String(req.headers?.['content-encoding'] || 'identity').toLowerCase() !== 'identity') throw Object.assign(new Error('Compressed requests are not accepted.'),{statusCode:415,code:'invalid_request'});
  if (Number(req.headers?.['content-length'] || 0)>MAX_BODY_BYTES || bodyBytes(req)>MAX_BODY_BYTES) throw Object.assign(new Error('Request is too large.'),{statusCode:413,code:'payload_too_large'});
  if (!req.body) return {};
  if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  try { return JSON.parse(Buffer.isBuffer(req.body)?req.body.toString('utf8'):req.body); } catch (_) { throw Object.assign(new Error('Malformed JSON.'),{statusCode:400,code:'invalid_request'}); }
}
function canPublishSchedule(ctx={}){const user=ctx.user||{},permissions=ctx.permissions||{};return Boolean(ctx.isSuperAdmin||user.isAdmin===true||user.isOwner===true||user.accountOwner===true||user.workspaceOwner===true||permissions.schedule===true);}
module.exports = async function handler(req,res) {
  if(req.method!=='POST') return res.status(405).json({ok:false,code:'method_not_allowed',error:'Use POST.'});
  try{
    const body=parseBody(req);const restaurantId=String(body.restaurantId||'').trim();const app=initAdmin(req);const authorizeSchedule=()=>authorize(req,app,{allowTenantAdmin:true,targetRestaurantId:restaurantId,requiredPermissions:['schedule']});const ctx=await authorizeSchedule();if(!ctx.ok)return res.status(ctx.status||403).json({ok:false,error:ctx.error});
    const appCheck=await requireAppCheckIfEnforced(ctx.app||app,req);if(!appCheck.ok)return res.status(appCheck.status||401).json({ok:false,error:appCheck.error});
    if(!canPublishSchedule(ctx))return res.status(403).json({ok:false,error:'Schedule publishing permission is required.'});
    if(body.action==='status'){const result=await getOperationStatus(ctx.db||app.firestore(),ctx,body);return res.status(200).json({ok:true,...result});}
    const reauthorize=async()=>{const fresh=await authorizeSchedule();if(!fresh.ok)throw Object.assign(new Error('Schedule publication authority changed during execution.'),{statusCode:403,code:'authority_changed'});return fresh;};
    const result=await executeSchedulePublish({db:ctx.db||app.firestore(),ctx,body,messaging:getMessaging(ctx.app||app),auth:(ctx.app||app).auth(),reauthorize});return res.status(['partial','recoverable'].includes(result.status)?409:200).json({ok:result.status==='complete',...result});
  }catch(error){const out=safeError(error);return res.status(Number(error?.statusCode||500)).json({ok:false,...out});}
};
module.exports._test={MAX_BODY_BYTES,bodyBytes,parseBody,canPublishSchedule};
