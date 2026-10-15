'use strict';
const {initAdmin,authorize,requireAppCheckIfEnforced} = require('./_chaos-admin');
const {parseBody} = require('./schedule-shift-assign')._test;
const {editScheduleWorkspace,readScheduleWorkspace} = require('./_schedule-workspace.cjs');
module.exports = async function scheduleWorkspace(req,res) {
  if(req.method!=='POST')return res.status(405).json({ok:false,code:'method_not_allowed',error:'Use POST.'});
  try {
    const body=parseBody(req);
    const restaurantId=typeof body.restaurantId==='string'?body.restaurantId.trim():'';
    if(!restaurantId || restaurantId.length>160)return res.status(400).json({ok:false,code:'workspace_required',error:'Choose a restaurant workspace.'});
    const app=initAdmin(req);
    const ctx=await authorize(req,app,{allowTenantAdmin:true,targetRestaurantId:restaurantId,requiredPermissions:['schedule']});
    if(!ctx.ok)return res.status(ctx.status || 403).json({ok:false,error:ctx.error});
    const appCheck=await requireAppCheckIfEnforced(ctx.app || app,req);
    if(!appCheck.ok)return res.status(appCheck.status || 401).json({ok:false,error:appCheck.error});
    const operation=body.action==='read'?readScheduleWorkspace:editScheduleWorkspace;
    return res.status(200).json(await operation({db:ctx.db || app.firestore(),ctx,body}));
  } catch(error) {
    const status=Number(error.statusCode || 500);
    return res.status(status).json({ok:false,code:status<500?error.code || 'schedule_edit_failed':'schedule_edit_failed',error:status<500?error.message:'The edit could not be confirmed. Reload before retrying.',...(status<500 && error.findings?{findings:error.findings}: {})});
  }
};
