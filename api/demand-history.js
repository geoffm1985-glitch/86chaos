'use strict';
const { initAdmin,authorize,requireAppCheckIfEnforced }=require('./_chaos-admin');
const { resolveWorkspaceSubscription,planIsAtLeast,PLAN_IDS }=require('./_plan-access');
const { enforceRateLimit,sendRateLimited }=require('./_rate-limit');
const { assertDemandPermission,workspaceBusinessDate,importDemandRows,readDemandRows }=require('./_item-demand-history');
module.exports=async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store');
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'POST required.'});
  try {
    if(String(req.headers?.['content-encoding'] || 'identity')!=='identity')return res.status(415).json({ok:false,error:'Compressed requests are not accepted.'});
    const raw=typeof req.body==='string' ? req.body : JSON.stringify(req.body || {});
    if(Buffer.byteLength(raw)>256000 || Number(req.headers?.['content-length'] || 0)>256000)return res.status(413).json({ok:false,error:'History request is too large.'});
    let body;try{body=typeof req.body==='string' ? JSON.parse(raw) : req.body || {};}catch(_){return res.status(400).json({ok:false,error:'Malformed JSON.'});}
    if(!['read','import'].includes(body.action))return res.status(400).json({ok:false,error:'Invalid history action.'});
    const restaurantId=String(body.restaurantId || '').trim();if(!/^[A-Za-z0-9_-]{1,160}$/.test(restaurantId))return res.status(400).json({ok:false,error:'Select a workspace.'});
    if(!/^Bearer\s+\S+$/i.test(req.headers?.authorization || ''))return res.status(401).json({ok:false,error:'Sign in to access demand history.'});
    const app=initAdmin(req);const ctx=await authorize(req,app,{allowTenantAdmin:true,targetRestaurantId:restaurantId,requiredPermissions:['sales','salesRead','financialRead','salesEdit','financialEdit','labor','laborRead','wageView','wageEdit']});
    if(!ctx.ok)return res.status(ctx.status || 401).json({ok:false,error:ctx.error});
    assertDemandPermission(ctx,body.action==='import');
    const appCheck=await requireAppCheckIfEnforced(ctx.app || app,req);if(!appCheck.ok)return res.status(appCheck.status || 401).json({ok:false,error:appCheck.error});
    const db=ctx.db || app.firestore();const workspace=await db.collection('restaurants').doc(ctx.restaurantId).get();
    if(!ctx.isSuperAdmin && !planIsAtLeast(resolveWorkspaceSubscription(workspace.data() || {}).planId,PLAN_IDS.OPERATIONS))return res.status(403).json({ok:false,error:'Operations plan is required for demand history.'});
    const rate=await enforceRateLimit({db,req,decoded:ctx.decoded,routeName:'demand-history',limit:body.action==='import'?10:40});if(!rate.ok)return sendRateLimited(res,rate);
    // Dates come from the server. Imported source data cannot select another project or workspace.
    const currentDate=workspaceBusinessDate(workspace.data() || {});
    const result=body.action==='import' ? await importDemandRows({db,ctx,rows:body.rows,approved:body.approved,currentDate}) : await readDemandRows({db,ctx,currentDate});
    return res.status(200).json({ok:true,...result});
  } catch(error) {
    const publicErrors={
      400:'Review the demand history dates, quantities, recipe matches, and explicit approval.',
      403:'Demand history permission is required for this workspace.',
      409:'Demand history conflicts with existing workspace or source records. Refresh and review before retrying.'
    };
    const status=Object.hasOwn(publicErrors,error?.statusCode) ? Number(error.statusCode) : 500;
    return res.status(status).json({ok:false,error:publicErrors[status] || 'Demand history could not be verified.'});
  }
};
