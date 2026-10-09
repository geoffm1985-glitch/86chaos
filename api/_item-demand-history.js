'use strict';
const crypto=require('node:crypto');
const { dateKey }=require('../src/core/intelligenceConnections.cjs');
const failure=(message,statusCode=400)=>{throw Object.assign(new Error(message),{statusCode});};
function assertDemandPermission(ctx,write=false) {
  if (!ctx?.uid || !ctx.restaurantId) failure('Workspace authorization is required.',403);
  if (ctx.user?.demoMode || ctx.user?.isDemo) failure('Demo workspaces cannot import or read live demand history.',403);
  const elevated=ctx.isSuperAdmin || ctx.user?.isOwner || ctx.user?.accountOwner || ctx.user?.workspaceOwner || ctx.user?.isAdmin;
  const permissions=write ? ['sales','salesEdit','financialEdit'] : ['sales','salesRead','financialRead','labor','laborRead','wageView','wageEdit'];
  if (!elevated && !permissions.some(key=>ctx.permissions?.[key]===true)) failure(write ? 'Sales editing permission is required.' : 'Sales read permission is required.',403);
}
const historyCollection=(db,restaurantId)=>db.collection('restaurants').doc(restaurantId).collection('demandItemHistory');
function workspaceBusinessDate(workspace={},now=new Date()) {
  const timeZone=workspace.timezone || workspace.timeZone || workspace.settings?.timezone || 'America/Chicago';
  try {const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);const values=Object.fromEntries(parts.map(part=>[part.type,part.value]));return `${values.year}-${values.month}-${values.day}`;}
  catch(_) {failure('Workspace timezone must be valid before reviewing demand history.');}
}
function normalizeDemandRows(rows,currentDate) {
  if (!Array.isArray(rows) || !rows.length || rows.length>200) failure('Review between 1 and 200 item sales rows at a time.');
  const today=dateKey(currentDate);if(!today) failure('A valid business date is required.');
  return rows.map(row=>{
    const date=dateKey(row.businessDate || row.date);
    const quantity=row.quantity === '' || !['number','string'].includes(typeof row.quantity) ? NaN : Number(row.quantity);
    const age=(new Date(today)-new Date(date))/86400000;
    if(!date || age<0 || age>112 || !Number.isFinite(quantity) || quantity<0 || quantity>100000) failure('Item sales need a valid date in the last 112 days and a non-negative quantity. Refunds require separate review.');
    const recipeId=String(row.recipeId || '').trim();const sourceId=String(row.sourceId || '').trim();const lineId=String(row.lineId || '').trim();
    if(!/^[A-Za-z0-9_-]{1,160}$/.test(recipeId) || !sourceId || sourceId.length>120 || !lineId || lineId.length>120) failure('Select a recipe and supply stable source and line IDs for every row.');
    return {businessDate:date,recipeId,quantity,unit:'each',sourceId,lineId};
  });
}
async function importDemandRows({db,ctx,rows,approved,currentDate}) {
  assertDemandPermission(ctx,true);if(approved!==true) failure('Explicit review and approval are required.');
  const normalized=normalizeDemandRows(rows,currentDate);const ids=[...new Set(normalized.map(row=>row.recipeId))];
  const dates=[...new Set(normalized.map(row=>row.businessDate))];const collection=historyCollection(db,ctx.restaurantId);
  return db.runTransaction(async tx=>{
    const recipes=await Promise.all(ids.map(id=>tx.get(db.collection('recipes').doc(id))));
    for(const recipe of recipes) {
      if(!recipe.exists || recipe.data().restaurantId!==ctx.restaurantId) failure('A selected recipe is unavailable in this workspace.',403);
      if(recipe.data().batchYieldUnit && !['each','ea','portion','portions','serving','servings'].includes(String(recipe.data().batchYieldUnit).toLowerCase())) failure('Weight or bulk recipes require a reviewed serving conversion before importing item demand.');
    }
    const snapshots=await Promise.all(dates.map(date=>tx.get(collection.doc(date))));
    const receiptCollection=db.collection('restaurants').doc(ctx.restaurantId).collection('demandImportLines');
    const keyFor=row=>crypto.createHash('sha256').update(JSON.stringify([ctx.restaurantId,row.sourceId,row.lineId])).digest('hex');
    const keys=[...new Set(normalized.map(keyFor))];
    const receipts=await Promise.all(keys.map(key=>tx.get(receiptCollection.doc(key))));
    const seen=new Map(keys.map((key,index)=>[key,receipts[index].exists ? receipts[index].data() : null]));
    const newReceipts=new Map();
    const daily=new Map(dates.map((date,index)=>[date,{...(snapshots[index].exists ? snapshots[index].data().lines : {})}]));
    let imported=0,duplicates=0;const now=new Date().toISOString();
    for(const row of normalized) {
      const key=keyFor(row);
      const day=daily.get(row.businessDate);const prior=seen.get(key) || day[key];
      if(prior) {if(prior.recipeId!==row.recipeId || prior.quantity!==row.quantity || prior.businessDate!==row.businessDate) failure('A source line conflicts with previously approved history. Review the original source; it cannot be overwritten by an import.',409);duplicates++;continue;}
      day[key]={...row,sourceLineId:key,approvedAt:now,approvedBy:ctx.uid};imported++;
      seen.set(key,day[key]);newReceipts.set(key,day[key]);
      if(Object.keys(day).length>400) failure('A business day exceeds the bounded 400-line history limit.');
    }
    if(!imported) return {imported,duplicates};
    for(const [key,receipt] of newReceipts) tx.set(receiptCollection.doc(key),receipt);
    for(const [date,lines] of daily) tx.set(collection.doc(date),{restaurantId:ctx.restaurantId,date,lines,updatedAt:now,updatedBy:ctx.uid,source:'reviewed_item_sales'});
    tx.set(db.collection('auditLogs').doc(),{restaurantId:ctx.restaurantId,userId:ctx.uid,action:'ITEM_DEMAND_HISTORY_APPROVED',timestamp:now,details:{imported,duplicates,businessDates:dates},target:`restaurants/${ctx.restaurantId}/demandItemHistory`});
    return {imported,duplicates};
  });
}
async function readDemandRows({db,ctx,currentDate}) {
  assertDemandPermission(ctx,false);const today=dateKey(currentDate);if(!today) failure('A valid business date is required.');
  const since=new Date(`${today}T12:00:00Z`);since.setUTCDate(since.getUTCDate()-112);
  const snapshot=await historyCollection(db,ctx.restaurantId).where('date','>=',since.toISOString().slice(0,10)).where('date','<',today).orderBy('date','desc').limit(113).get();
  let count=0;const data=[];
  for(const document of snapshot.docs) {
    const day=document.data();if(day.restaurantId!==ctx.restaurantId) failure('History workspace identity is inconsistent.',409);
    const lineItems=Object.values(day.lines || {});count+=lineItems.length;
    data.push({id:`reviewed:${document.id}`,restaurantId:ctx.restaurantId,date:day.date,lineItems:lineItems.slice(0,Math.max(0,2000-(count-lineItems.length)))});
  }
  return {data,complete:count<=2000,reason:count>2000 ? 'The 2,000-line history limit was reached. Narrow or review the source window before forecasting.' : '',count:Math.min(count,2000)};
}
module.exports={assertDemandPermission,workspaceBusinessDate,normalizeDemandRows,importDemandRows,readDemandRows};
