'use strict';
const {FieldPath} = require('firebase-admin/firestore');
const {evidenceTime} = require('../src/core/operationalEvidence.cjs');
const SOURCES = Object.freeze({
  prep:{collection:'prepItems',permissions:['prep','kitchen','team']},
  waste:{collection:'wasteLogs',permissions:['inventory','inventoryRead','team']},
  maintenance:{collection:'maintenanceLogs',permissions:['maintenance','ops','team']},
  alerts:{collection:'restaurantAdminAlerts',permissions:['owner','admin']},
  events:{collection:'events',permissions:['ops','team','schedule']},
  invoices:{collection:'invoices',permissions:['inventory','inventoryRead','invoices','team']},
  backup:{collection:'system',permissions:['owner','admin']}
});
const fail = (statusCode) => { throw Object.assign(new Error('Operational history request could not be verified.'),{statusCode}); };
function historySourceAllowed(ctx,source) {
  const config = SOURCES[source];
  if (!config || !ctx?.uid || !ctx.restaurantId || ctx.user?.demoMode || ctx.user?.isDemo) return false;
  const elevated = ctx.isSuperAdmin || ctx.user?.isOwner || ctx.user?.accountOwner || ctx.user?.workspaceOwner || ctx.user?.isAdmin;
  // Manager status permits this review screen, but does not bypass source permissions.
  const reviewer = elevated || ctx.user?.isManager || /^(owner|admin|manager)$/i.test(ctx.user?.role || '') || ['ops','team','hr'].some(key => ctx.permissions?.[key] === true);
  return Boolean(reviewer && (elevated || (!['alerts','backup'].includes(source) && config.permissions.some(key => ctx.permissions?.[key] === true))));
}
const ALLOWED_FIELDS = ['date','businessDate','createdAt','updatedAt','timestamp','approvedAt','approvalAt','status','type','category','title','text','itemName','equipment','reason','cause','classification','errorCategory','outcome','severity','priority','urgency','isCompleted','commandCenterAlert','invoiceNumber','sourceId','receivedQuantity','quantity','recipeId','menuItemId','itemId'];
function projectHistoryRow(id,data,source) {
  const row = {id,restaurantId:data.restaurantId};
  for (const key of ALLOWED_FIELDS) if (data[key] != null) {
    const value=data[key];
    if (['string','number','boolean'].includes(typeof value)) row[key]=typeof value==='string'?value.slice(0,800):value;
    else if (['createdAt','updatedAt','timestamp','approvedAt','approvalAt'].includes(key) && evidenceTime(value)!==null) row[key]=new Date(evidenceTime(value)).toISOString();
  }
  if(Array.isArray(data.snapshots))row.snapshots=data.snapshots.filter(value=>value && typeof value==='object').slice(0,20).map(value=>({key:String(value.key || '').slice(0,80),title:String(value.title || '').slice(0,160),status:String(value.status || '').slice(0,40),score:Number.isFinite(value.score)?value.score:null}));
  // Never return request bodies, stacks, employee HR notes or raw admin diagnostics.
  for (const key of ['title','text','reason','cause','outcome','itemName','equipment']) if (typeof row[key] === 'string') row[key] = row[key].slice(0,800);
  if (row.category === 'error' || row.errorCategory) {row.title='Recorded operational error';row.reason=String(row.errorCategory || row.classification || 'operational-error').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80);delete row.text;delete row.cause;}
  if(source==='alerts') {
    const category=String(data.errorCategory || data.category || data.type || '').toLowerCase();
    row.title='Operational alert review';row.errorCategory=/sync/.test(category)?'sync-error':/integration/.test(category)?'integration-error':/permission|auth/.test(category)?'access-error':'operational-error';
    for(const key of ['reason','cause','text','outcome','classification'])delete row[key];
    row.category='error';row.type='classified-alert';
  }
  if(Array.isArray(data.lineItems))row.lineItems=data.lineItems.filter(line=>line && typeof line==='object').slice(0,150).map(line=>({approvedStockQuantity:Number.isFinite(Number(line.approvedStockQuantity)) && line.approvedStockQuantity!=null?Number(line.approvedStockQuantity):null,substitution:line.substitution===true}));
  return row;
}
async function readOperationalHistoryPage({db,ctx,source,after = '',scanned = 0,currentDate,days = 180}) {
  if (!historySourceAllowed(ctx,source)) fail(403);
  if(source==='backup') {
    const snapshot=await db.collection('system').doc('backupStatus').get();
    const raw=snapshot.exists?snapshot.data():{};
    const last=raw.lastSuccessfulBackupAt || raw.lastBackupAt || raw.nativeBackupLastSuccessfulAt || raw.lastExportAt;
    const lastAt=evidenceTime(last),age=lastAt===null?null:(Date.now()-lastAt)/3600000;
    const known=(value,allowed)=>typeof value==='string' && allowed.includes(value.toLowerCase())?value.toLowerCase():'unknown';
    const summary={id:'workspace-backup-summary',restaurantId:ctx.restaurantId,status:known(raw.status || raw.lastStatus || raw.nativeBackupLatestState,['ok','healthy','success','passed','ready','failed','error','stale','attention']),lastSuccessfulBackupAt:lastAt===null?'':new Date(lastAt).toISOString(),lastIntegrityStatus:known(raw.lastIntegrityStatus || raw.backupIntegrity?.status || raw.nativeBackupVerificationState || (raw.nativeBackupVerified===true?'verified':''),['ok','healthy','success','passed','verified','ready','failed','error']),backupStale:age===null || age<0 || age>26};
    return {source,data:[summary],resolved:true,complete:snapshot.exists,scanned:snapshot.exists?1:0,undated:0,hasMore:false,nextCursor:'',readOnly:true};
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(currentDate) || !Number.isInteger(days) || days < 7 || days > 180 || !Number.isInteger(scanned) || scanned < 0 || scanned >= 2000 || typeof after !== 'string' || after.length > 1500 || /[/\x00-\x1f]/.test(after)) fail(400);
  if (Boolean(after) !== (scanned > 0)) fail(400);
  const end = Date.parse(`${currentDate}T23:59:59.999Z`),start = Date.parse(`${currentDate}T00:00:00Z`)-(days-1)*86400000;
  if (!Number.isFinite(end)) fail(400);
  // Document-id pagination also includes legacy records lacking a date-index field.
  // The hard scan budget and explicit coverage prevent broad scans being called complete.
  let query = db.collection(SOURCES[source].collection).where('restaurantId','==',ctx.restaurantId).orderBy(FieldPath.documentId()).limit(101);
  if (after) query = query.startAfter(after);
  const snapshot = await query.get();
  const docs = snapshot.docs.slice(0,100),data=[];let undated = 0;
  for (const document of docs) {
    const row = document.data();if (row.restaurantId !== ctx.restaurantId) fail(409);
    const at = [row.businessDate,row.date,row.timestamp,row.createdAt,row.updatedAt,row.approvedAt].map(evidenceTime).find(value=>value!==null);
    if (at == null) {undated++;continue;}
    if (at >= start && at <= end) data.push(projectHistoryRow(document.id,row,source));
  }
  const totalScanned = scanned+docs.length,hasMore=snapshot.docs.length>100;
  return {source,data,scanned:totalScanned,undated,hasMore,complete:!hasMore && undated===0,nextCursor:hasMore && totalScanned<2000 ? docs.at(-1).id : '',truncated:hasMore && totalScanned>=2000,window:{from:new Date(start).toISOString().slice(0,10),to:currentDate,days},readOnly:true};
}
module.exports={SOURCES,historySourceAllowed,projectHistoryRow,readOperationalHistoryPage};
