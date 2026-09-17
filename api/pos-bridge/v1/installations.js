'use strict';
const {handler,json,readBoundedJson,method,requireContract}=require('../../_pos-bridge-route');
const {authorizeControlPlane}=require('../../_pos-bridge-authority');
const {ACTIONS,registerInstallation,transitionInstallation,publicInstallation}=require('../../_pos-bridge-installations');
const clean=v=>String(v||'').trim();
module.exports=handler(async(req,res)=>{
  method(req,['POST']);const body=readBoundedJson(req);requireContract(req);const action=clean(body.action);if(!ACTIONS.has(action))throw Object.assign(new Error('Invalid action.'),{code:'invalid_request',statusCode:400});
  const restaurantId=clean(body.restaurantId);const ctx=await authorizeControlPlane(req,restaurantId,{recent:true});const db=ctx.db;
  if(action==='register'){
    const record=await registerInstallation(db,ctx,body);return json(res,201,{ok:true,installation:publicInstallation(record)});
  }
  const result=await transitionInstallation(db,ctx,body);return json(res,200,{ok:true,installation:publicInstallation(result)});
});
