'use strict';
const {initAdmin,authorize,requireAppCheckIfEnforced}=require('./_chaos-admin');
const {resolveWorkspaceSubscription,planIsAtLeast,PLAN_IDS}=require('./_plan-access');
const {enforceRateLimit,sendRateLimited}=require('./_rate-limit');
const {workspaceBusinessDate}=require('./_item-demand-history');
const {readOperationalHistoryPage,SOURCES}=require('./_operational-history');
module.exports=async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store');
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'POST required.'});
  try {
    const raw=typeof req.body==='string'?req.body:JSON.stringify(req.body || {});
    if(Buffer.byteLength(raw)>8000 || String(req.headers?.['content-encoding'] || 'identity')!=='identity')return res.status(413).json({ok:false,error:'History request is too large.'});
    let body;try{body=JSON.parse(raw);}catch(_){return res.status(400).json({ok:false,error:'Malformed JSON.'});}
    if(!Object.hasOwn(SOURCES,body?.source))return res.status(400).json({ok:false,error:'Choose an available history source.'});
    const restaurantId=String(body.restaurantId || '');if(!/^[A-Za-z0-9_-]{1,160}$/.test(restaurantId))return res.status(400).json({ok:false,error:'Select a workspace.'});
    if(!/^Bearer\s+\S+$/i.test(req.headers?.authorization || ''))return res.status(401).json({ok:false,error:'Sign in to review history.'});
    const app=initAdmin(req),ctx=await authorize(req,app,{allowTenantAdmin:true,targetRestaurantId:restaurantId,requiredPermissions:['ops','team','hr','prep','inventory','maintenance']});
    if(!ctx.ok)return res.status(ctx.status || 401).json({ok:false,error:ctx.error});
    const appCheck=await requireAppCheckIfEnforced(ctx.app || app,req);if(!appCheck.ok)return res.status(appCheck.status || 401).json({ok:false,error:appCheck.error});
    const db=ctx.db || app.firestore(),workspace=await db.collection('restaurants').doc(ctx.restaurantId).get();
    if(!ctx.isSuperAdmin && !planIsAtLeast(resolveWorkspaceSubscription(workspace.data() || {}).planId,PLAN_IDS.OPERATIONS))return res.status(403).json({ok:false,error:'Operations plan is required.'});
    const rate=await enforceRateLimit({db,req,decoded:ctx.decoded,routeName:'operational-history',limit:120});if(!rate.ok)return sendRateLimited(res,rate);
    const result=await readOperationalHistoryPage({db,ctx,source:body.source,after:body.after,scanned:body.scanned,currentDate:workspaceBusinessDate(workspace.data() || {}),days:body.days});
    return res.status(200).json({ok:true,...result});
  }catch(error){const status=[400,403,409].includes(error?.statusCode)?error.statusCode:500;return res.status(status).json({ok:false,error:status===403?'This source is unavailable to your role.':status===400?'Review the history window and cursor.':'Operational history could not be verified. Retry when the connection recovers.'});}
};
