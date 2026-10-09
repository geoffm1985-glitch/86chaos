'use strict';
const crypto=require('node:crypto');
const {assertTenant,safeId}=require('./_invoice-approval');
const fail=(statusCode=400)=>{throw Object.assign(new Error('Review the workspace evidence and approval.'),{statusCode});};
const elevated=ctx=>ctx.isSuperAdmin || ctx.user?.isOwner || ctx.user?.accountOwner || ctx.user?.workspaceOwner || ctx.user?.isAdmin;
function validateCatalogRow(row) {
  if(!row || typeof row!=='object' || Array.isArray(row) || typeof row.unitPrice==='boolean')fail();
  const code=String(row.sku || '').replace(/[^A-Za-z0-9]/g,'').toUpperCase(),name=String(row.name || '').trim(),packSize=String(row.packSize || '').trim(),purchaseUnit=String(row.purchaseUnit || '').trim();
  const price=row.unitPrice==='' || row.unitPrice==null ? null : Number(row.unitPrice);
  if(!code || code.length>120 || !name || name.length>160 || !packSize || packSize.length>100 || !purchaseUnit || purchaseUnit.length>30 || price!==null && (!Number.isFinite(price) || price<0 || price>100000))fail();
  let sourceUrl=String(row.sourceUrl || '').trim();
  try{const url=new URL(sourceUrl);if(url.protocol!=='https:' || url.username || url.password || url.search || url.hash)fail();sourceUrl=url.toString();}catch(_){fail();}
  return {code,name,packSize,purchaseUnit,unitPriceCents:price===null?null:Math.round(price*100),sourceUrl};
}
async function operationalReview({db,ctx,body}) {
  if(!ctx?.uid || !ctx.restaurantId || ctx.user?.demoMode || ctx.user?.isDemo)fail(403);
  if(body.action==='attendance-policy-approve') {
    if(!elevated(ctx) && ctx.permissions?.settings!==true)fail(403);
    if(body.approved!==true)fail();
    const candidate=body.policy || {},graceMinutes=Number(candidate.graceMinutes),maxOpenBreakMinutes=Number(candidate.maxOpenBreakMinutes),timeZone=String(candidate.timeZone || '');
    if(!Number.isInteger(graceMinutes) || graceMinutes<0 || graceMinutes>120 || !Number.isInteger(maxOpenBreakMinutes) || maxOpenBreakMinutes<1 || maxOpenBreakMinutes>240 || typeof candidate.enabled!=='boolean' || typeof candidate.graceMinutes==='boolean' || typeof candidate.maxOpenBreakMinutes==='boolean')fail();
    try{new Intl.DateTimeFormat('en-US',{timeZone}).format();}catch(_){fail();}
    const ref=db.collection('restaurants').doc(ctx.restaurantId);
    return db.runTransaction(async tx=>{
      const snapshot=await tx.get(ref);if(!snapshot.exists)fail(403);
      const prior=snapshot.data().attendancePolicy || {};if((prior.approvedAt || '')!==(body.expectedApprovedAt || ''))fail(409);
      const policy={enabled:candidate.enabled,graceMinutes,maxOpenBreakMinutes,timeZone,approvedAt:new Date().toISOString(),approvedBy:ctx.uid,reviewOnly:true};
      tx.update(ref,{attendancePolicy:policy});tx.set(db.collection('auditLogs').doc(),{restaurantId:ctx.restaurantId,userId:ctx.uid,action:'ATTENDANCE_POLICY_APPROVED',timestamp:policy.approvedAt,details:{before:prior,after:policy}});
      return {policy};
    });
  }
  if(!elevated(ctx) && ctx.permissions?.inventory!==true && ctx.permissions?.team!==true)fail(403);
  if(!safeId(body.vendorId))fail();
  const vendor=db.collection('vendors').doc(body.vendorId),vendorSnap=await vendor.get();assertTenant(vendorSnap.exists?vendorSnap.data():null,ctx.restaurantId);
  const collection=vendor.collection('catalogProducts');
  if(body.action==='vendor-catalog-list') {
    if(body.cursor && !safeId(body.cursor))fail();let query=collection.orderBy('__name__').limit(51);if(body.cursor)query=query.startAfter(body.cursor);
    const snapshot=await query.get(),page=snapshot.docs.slice(0,50);
    return {products:page.filter(doc=>doc.data().restaurantId===ctx.restaurantId).map(doc=>({id:doc.id,...doc.data()})),nextCursor:snapshot.docs.length>50?page.at(-1).id:null};
  }
  if(body.approved!==true)fail();
  if(body.action==='vendor-catalog-revoke') {
    if(!safeId(body.productId))fail();const ref=collection.doc(body.productId);
    return db.runTransaction(async tx=>{const snap=await tx.get(ref);assertTenant(snap.exists?snap.data():null,ctx.restaurantId);if(snap.data().approvedAt!==body.expectedApprovedAt)fail(409);const at=new Date().toISOString();tx.update(ref,{active:false,revokedAt:at,revokedBy:ctx.uid});tx.set(db.collection('auditLogs').doc(),{restaurantId:ctx.restaurantId,userId:ctx.uid,action:'VENDOR_CATALOG_REVOKED',timestamp:at,target:ref.path});return {revoked:true};});
  }
  if(body.action!=='vendor-catalog-import' || !Array.isArray(body.rows) || !body.rows.length || body.rows.length>100)fail();
  const rows=body.rows.map(validateCatalogRow),codes=rows.map(row=>row.code);if(new Set(codes).size!==codes.length)fail();
  const refs=rows.map(row=>collection.doc(crypto.createHash('sha256').update(JSON.stringify([ctx.restaurantId,body.vendorId,row.code])).digest('hex')));
  return db.runTransaction(async tx=>{
    const previous=await Promise.all(refs.map(ref=>tx.get(ref)));
    for(let index=0;index<rows.length;index++)if(previous[index].exists) {
      assertTenant(previous[index].data(),ctx.restaurantId);
      if(previous[index].data().active===false || (body.expectedVersions?.[rows[index].code] || '')!==previous[index].data().approvedAt)fail(409);
    }
    const approvedAt=new Date().toISOString();rows.forEach((row,index)=>tx.set(refs[index],{...row,restaurantId:ctx.restaurantId,vendorId:body.vendorId,active:true,approvedAt,approvedBy:ctx.uid,source:'reviewed_vendor_catalog'}));
    tx.set(db.collection('auditLogs').doc(),{restaurantId:ctx.restaurantId,userId:ctx.uid,action:'VENDOR_CATALOG_APPROVED',timestamp:approvedAt,details:{vendorId:body.vendorId,productIds:refs.map(ref=>ref.id)}});
    return {imported:rows.length,approvedAt};
  });
}
async function catalogEvidence({db,restaurantId,vendorId,code}) {
  if(!safeId(vendorId) || !code)return [];
  const vendor=db.collection('vendors').doc(vendorId),snapshot=await vendor.get();assertTenant(snapshot.exists?snapshot.data():null,restaurantId);
  const id=crypto.createHash('sha256').update(JSON.stringify([restaurantId,vendorId,String(code).replace(/[^A-Za-z0-9]/g,'').toUpperCase()])).digest('hex');
  const product=await vendor.collection('catalogProducts').doc(id).get();
  if(!product.exists || product.data().restaurantId!==restaurantId || product.data().active!==true)return [];
  const row=product.data(),age=Date.now()-Date.parse(row.approvedAt);
  return [{name:row.name,package:row.packSize,purchaseUnit:row.purchaseUnit,unitPriceCents:row.unitPriceCents,code:row.code,sourceUrl:row.sourceUrl,evidenceRef:product.ref.path,approvedAt:row.approvedAt,stale:!Number.isFinite(age) || age<0 || age>90*86400000,approvalRequired:true}];
}
module.exports={operationalReview,catalogEvidence,validateCatalogRow};
