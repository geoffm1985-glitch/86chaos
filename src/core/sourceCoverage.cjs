'use strict';
const SOURCE_REGISTRY = Object.freeze([
  {key:'inventory',label:'Inventory',category:'inventory',tab:'inventory'},
  {key:'prep',label:'Prep plan',category:'prep',tab:'prep'},
  {key:'tasks',label:'Recurring tasks',category:'prep',tab:'prep'},
  {key:'users',label:'Staff roster',category:'staffing',tab:'team'},
  {key:'shifts',label:'Published shifts',category:'staffing',tab:'published'},
  {key:'timeOff',label:'Time off',category:'staffing',tab:'published'},
  {key:'trades',label:'Shift trades',category:'staffing',tab:'published'},
  {key:'punches',label:'Time clock',category:'financial',tab:'labor'},
  {key:'maintenance',label:'Maintenance',category:'maintenance',tab:'maintenance'},
  {key:'safety',label:'Food safety checks',category:'food-safety',tab:'prep'},
  {key:'sales',label:'Sales evidence',category:'financial',tab:'financials'},
  {key:'invoices',label:'Receiving and invoices',category:'financial',tab:'inventory'},
  {key:'orders',label:'Open purchase orders',category:'inventory',tab:'inventory'},
  {key:'waste',label:'Waste evidence',category:'operations',tab:'inventory'},
  {key:'events',label:'Operating events',category:'operations',tab:'events'},
  {key:'training',label:'Training follow-up',category:'staffing',tab:'hr-training'},
  {key:'backup',label:'Backup and recovery',category:'system',tab:'back-office'},
  {key:'integrations',label:'Configured integrations',category:'system',tab:'settings'}
]);
function evaluateCoverage(state) {
  if(state?.allowed===false)return{status:'denied',complete:false,reason:'Evidence is unavailable to this role.'};
  if(!state || state.resolved!==true)return{status:'not-loaded',complete:false,reason:'Evidence has not loaded.'};
  if(state.error)return{status:'error',complete:false,reason:'Evidence could not be verified. Retry its source.'};
  if(state.stale||state.cached)return{status:'stale',complete:false,reason:'Evidence is cached or has not been verified by the server.'};
  if(state.complete===false||state.truncated||Array.isArray(state.data)&&state.data.length>=Number(state.limit||Infinity))return{status:'incomplete',complete:false,reason:'Coverage is incomplete or its read limit was reached.'};
  return{status:'verified',complete:true,reason:'The configured bounded source is loaded and verified.'};
}
function buildSourceCoverage(states={},requiredKeys=SOURCE_REGISTRY.map(row=>row.key)) {
  if(requiredKeys.some(key=>!SOURCE_REGISTRY.some(row=>row.key===key)))throw new Error('Unregistered readiness source.');
  return SOURCE_REGISTRY.filter(row=>requiredKeys.includes(row.key)).map(row=>({...row,...evaluateCoverage(states[row.key])}));
}
module.exports={SOURCE_REGISTRY,evaluateCoverage,buildSourceCoverage};
