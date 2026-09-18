const { foodSafety } = require('./_food-safety');
const { authorizeAiScanWorkspace } = require('./_ai-usage');
const { verifyRequestToken } = require('./_firebase-project-admin');
const { requireMfaIfEnforced } = require('./_chaos-admin');
const { initAdmin, readBody, authorize, writeAudit, clean } = require('./_chaos-admin');
const { requireAppCheckIfEnforced } = require('./_chaos-admin');
const { approveInvoice } = require('./_invoice-approval');
const { vendorMemory } = require('./_vendor-memory');
const { approveMenu } = require('./_menu-approval');
const { recipeCosting } = require('./_recipe-costing');
const { assertNotReservedBridgeRoot } = require('./_pos-bridge-boundaries');
const MAX_BODY_BYTES = 1024 * 1024;
function parseBoundedBody(req) {
  if (String(req.headers?.['content-encoding'] || 'identity').toLowerCase() !== 'identity') throw Object.assign(new Error('Compressed requests are not accepted.'), { statusCode:415, code:'invalid_request' });
  const bytes = Buffer.byteLength(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));
  if (Number(req.headers?.['content-length'] || 0) > MAX_BODY_BYTES || bytes > MAX_BODY_BYTES) throw Object.assign(new Error('Request is too large.'), { statusCode:413, code:'payload_too_large' });
  if (!req.body) return {};
  if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  try { return JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body); }
  catch (_) { throw Object.assign(new Error('Malformed JSON.'), { statusCode:400, code:'invalid_request' }); }
}

const PERMS = {
  shifts: ['schedule','team'], timeOffRequests: ['schedule','team'], scheduleTemplates: ['schedule','team'], scheduleCoverageTargets: ['schedule','team'],
  inventoryItems: ['inventory','team'], vendors: ['inventory','team'], orders: ['inventory','team'], invoices: ['inventory','team'],
  prepItems: ['prep','team'], prepCategories: ['prep','team'], lineCheckItems: ['prep','team'], recipes: ['prep','team'], menuDependencies: ['prep','inventory','team'],
  sales: ['sales','labor','team'], timePunches: ['labor','team'],
  tasks: ['prep','team'], tempLogs: ['prep','team'], wasteLogs: ['inventory','prep','team'],
  maintenanceLogs: ['team'], pmSchedules: ['team'], events: ['events','schedule','team'], messages: ['messages','team']
};
const GENERIC_COLLECTION_CONTRACTS = Object.freeze(Object.fromEntries(Object.entries(PERMS).map(([collectionName, permissions]) => [collectionName, Object.freeze({
  actions: Object.freeze(['add', 'set', 'update', 'replace', 'delete']),
  permissions: Object.freeze([...permissions]),
  ownerAllowed: true
})])));
const FORBIDDEN_AUTHORITY_FIELDS = new Set([
  'isSuperAdmin','systemAccess','isAdmin','isOwner','owner','accountOwner','workspaceOwner',
  'permissions','rolePermissions','platformRole','accountRole','securityEpoch','credentialVersion',
  'generation','leaseToken','leaseOwnerUid','leaseExpiresAt','tenantLeaseGeneration','planDigest',
  'publishGeneration','publishOperationId','authorityRevision','membershipMigrationVersion',
  'legacyMembershipFallback'
]);
const PUBLICATION_FIELDS = new Set([
  'isPublished','published','publishedAt','publishedBy','publishedByName','publishState','publishStatus',
  'schedulePublishStatus','schedulePublishOperations','schedulePublishLeases','visibility','scheduleId',
  'schedulePeriodStart','schedulePeriodEnd','publishScope','publishWeekKeys','readyToPublish',
  'scheduleBuilderDraft','draft','isDraft'
]);
const DENIED_COLLECTIONS = new Set([
  'users','workspaceMembers','restaurants','system','auditLogs','apiRateLimits',
  'schedulePublishOperations','schedulePublishLeases','posBridgeInstallations','posBridgeScopes',
  'posBridgeAuthReplays','posBridgeControl','inventoryMutationOperations'
]);
function canWrite(ctx, collectionName, restaurantId) {
  if (ctx.isSuperAdmin) return true;
  if (!restaurantId || ctx.restaurantId !== restaurantId) return false;
  const isOwner=ctx.user?.isOwner||ctx.user?.accountOwner||ctx.user?.workspaceOwner;
  if (isOwner && GENERIC_COLLECTION_CONTRACTS[collectionName]?.ownerAllowed === true) return true;
  return (PERMS[collectionName] || []).some(p => ctx.permissions?.[p] === true);
}
const SERVER_OWNED_FIELDS = new Set(['restaurantId','workspaceId','createdAt','createdBy','ownerId','tenantId','securityEpoch','credentialVersion','revision','updatedAt','updatedBy','writeEngine']);
function existingTenantId(data = {}) { return clean(data.restaurantId || data.workspaceId || data.tenantId || ''); }
function assertGenericContract(collectionName, action) {
  const contract = GENERIC_COLLECTION_CONTRACTS[collectionName];
  if (!contract || DENIED_COLLECTIONS.has(collectionName) || !contract.actions.includes(action)) {
    const error = new Error('This operation is not available through the generic write service.');
    error.statusCode = 403; error.code = 'generic_write_contract_denied'; throw error;
  }
  return contract;
}
function forbiddenPayloadPath(value, collectionName, prefix = '') {
  if (!value || typeof value !== 'object') return '';
  for (const [key, nested] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (FORBIDDEN_AUTHORITY_FIELDS.has(key) || (collectionName === 'shifts' && PUBLICATION_FIELDS.has(key))) return path;
    const child = forbiddenPayloadPath(nested, collectionName, path);
    if (child) return child;
  }
  return '';
}
function assertPayloadAllowed(collectionName, data) {
  const forbidden = forbiddenPayloadPath(data, collectionName);
  if (forbidden) {
    const error = new Error('The requested fields are server-owned and cannot be changed here.');
    error.statusCode = 403; error.code = 'server_owned_field_denied'; error.field = forbidden; throw error;
  }
}
function protectServerOwnedFields(incoming = {}, existing = {}) {
  const payload = { ...incoming };
  for (const field of SERVER_OWNED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(existing, field)) payload[field] = existing[field];
    else if (['ownerId','tenantId','securityEpoch','credentialVersion','revision'].includes(field)) delete payload[field];
  }
  return payload;
}
async function verifyExistingTargetOwnership(db, collectionName, docId, restaurantId) {
  const ref = db.collection(collectionName).doc(docId);
  const snap = await ref.get();
  if (!snap.exists) return { ref, exists: false, data: {} };
  const data = snap.data() || {};
  const ownerTenant = existingTenantId(data);
  if (!ownerTenant || ownerTenant !== clean(restaurantId)) {
    const error = new Error('The requested record is unavailable.');
    error.statusCode = 403;
    error.code = 'foreign_target_denied';
    throw error;
  }
  return { ref, exists: true, data };
}
async function executeGenericMutation(db, { collectionName, action, docId, data, restaurantId, actor, nowIso }) {
  const ref = action === 'add' ? db.collection(collectionName).doc() : db.collection(collectionName).doc(docId);
  let existed = false;
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    existed = snap.exists;
    const existing = snap.exists ? (snap.data() || {}) : {};
    if (snap.exists) {
      const ownerTenant = existingTenantId(existing);
      if (!ownerTenant || ownerTenant !== restaurantId) {
        const error = new Error('The requested record is unavailable.');
        error.statusCode = 404; error.code = 'target_unavailable'; throw error;
      }
    }
    if (action === 'delete') {
      if (!snap.exists) { const error = new Error('The requested record is unavailable.'); error.statusCode = 404; error.code = 'target_unavailable'; throw error; }
      tx.delete(ref); return;
    }
    if (!snap.exists && !['add','set'].includes(action)) {
      const error = new Error('The requested record is unavailable.'); error.statusCode = 404; error.code = 'target_unavailable'; throw error;
    }
    const guarded = protectServerOwnedFields(data, existing);
    const revision = snap.exists ? Number(existing.revision || 0) + 1 : 1;
    const payload = {
      ...guarded,
      restaurantId,
      workspaceId: clean(existing.workspaceId || guarded.workspaceId || restaurantId),
      revision,
      updatedAt: nowIso,
      updatedBy: actor,
      writeEngine: 'v17.0.2-safe-write',
      ...(snap.exists ? {} : { createdAt: nowIso, createdBy: actor })
    };
    if (action === 'replace') tx.set(ref, payload, { merge: false });
    else tx.set(ref, payload, { merge: action !== 'add' });
  });
  return { id: ref.id, path: `${collectionName}/${ref.id}`, existed };
}
const roleName = value => clean(value).replace(/\s+/g, ' ');
const roleNameKey = value => roleName(value).toLowerCase();
async function mutateRosterRole(db, { action, restaurantId, roleId, name, actor, nowIso }) {
  const rolesQuery=db.collection('roles').where('restaurantId','==',restaurantId),targetRef=roleId?db.collection('roles').doc(roleId):db.collection('roles').doc();
  return db.runTransaction(async tx=>{
    const configRef=db.collection('restaurants').doc(restaurantId);const [rolesSnap,configSnap]=await Promise.all([tx.get(rolesQuery),tx.get(configRef)]),rows=rolesSnap.docs.map(doc=>({id:doc.id,...doc.data()}));
    const target=roleId?rows.find(row=>row.id===roleId):null;
    if(roleId&&(!target||existingTenantId(target)!==restaurantId)){const error=new Error('The requested record is unavailable.');error.statusCode=404;error.code='target_unavailable';throw error;}
    const nextName=roleName(name),nextKey=roleNameKey(nextName);
    if(['roster-role-create','roster-role-rename'].includes(action)){
      if(!nextName||nextName.length>120){const error=new Error('A valid role name is required.');error.statusCode=400;error.code='invalid_role_name';throw error;}
      const conflicts=rows.filter(row=>row.id!==roleId).some(row=>roleNameKey(row.name)===nextKey||(row.previousNames||[]).some(previous=>roleNameKey(previous)===nextKey));
      if(conflicts){const error=new Error('That current or historical role name is already reserved.');error.statusCode=409;error.code='role_name_reserved';throw error;}
    }
    let payload;
    if(action==='roster-role-create')payload={name:nextName,restaurantId,workspaceId:restaurantId,revision:1,previousNames:[],archived:false,archivedAt:null,createdAt:nowIso,createdBy:actor,updatedAt:nowIso,updatedBy:actor};
    else if(action==='roster-role-rename'){const previousNames=uniqueRoleNames([...(target.previousNames||[]),target.name]).filter(previous=>roleNameKey(previous)!==nextKey);payload={name:nextName,previousNames,revision:Number(target.revision||1)+1,updatedAt:nowIso,updatedBy:actor};}
    else if(action==='roster-role-archive')payload={archived:true,archivedAt:nowIso,revision:Number(target.revision||1)+1,updatedAt:nowIso,updatedBy:actor};
    else{const error=new Error('Unsupported roster role operation.');error.statusCode=400;error.code='invalid_request';throw error;}
    if(action==='roster-role-create')tx.create(targetRef,payload);else tx.set(targetRef,payload,{merge:true});
    const config=configSnap.exists?configSnap.data()||{}:{};tx.set(configRef,{rosterRoleConfigurationGeneration:Number(config.rosterRoleConfigurationGeneration||0)+1,rosterRoleConfigurationUpdatedAt:nowIso,rosterRoleConfigurationUpdatedBy:actor},{merge:true});
    return{id:targetRef.id,path:`roles/${targetRef.id}`,revision:payload.revision};
  });
}
function uniqueRoleNames(values){const seen=new Set();return values.map(roleName).filter(value=>{const key=roleNameKey(value);if(!key||seen.has(key))return false;seen.add(key);return true;});}
function wasteOperationId(value){const id=clean(value);if(!/^[A-Za-z0-9_-]{16,160}$/.test(id)){const error=new Error('A valid inventory operation ID is required.');error.statusCode=400;error.code='invalid_request';throw error;}return id;}
async function mutateWaste(db,{action,restaurantId,body,actor,nowIso}){
  const operationId=wasteOperationId(body.operationId),opRef=db.collection('inventoryMutationOperations').doc(operationId),itemId=clean(body.data?.itemId||body.itemId),logId=clean(body.docId),itemRef=db.collection('inventoryItems').doc(itemId),logRef=action==='waste-create'?db.collection('wasteLogs').doc(`waste_${operationId}`):db.collection('wasteLogs').doc(logId);
  if(!itemId||(!logId&&action!=='waste-create')){const error=new Error('Inventory item and waste record identity are required.');error.statusCode=400;error.code='invalid_request';throw error;}
  return db.runTransaction(async tx=>{
    const [opSnap,itemSnap,logSnap]=await Promise.all([tx.get(opRef),tx.get(itemRef),tx.get(logRef)]);
    if(opSnap.exists){const prior=opSnap.data()||{};if(prior.restaurantId!==restaurantId||prior.action!==action)throw Object.assign(new Error('Inventory operation ID is already bound to another request.'),{statusCode:409,code:'operation_mismatch'});return{status:'idempotent',id:prior.logId,currentStock:prior.resultingStock};}
    if(!itemSnap.exists||existingTenantId(itemSnap.data()||{})!==restaurantId)throw Object.assign(new Error('The requested record is unavailable.'),{statusCode:404,code:'target_unavailable'});
    const item=itemSnap.data()||{},currentStock=Number(item.currentStock||0);let resultingStock=currentStock,logPayload=null;
    if(action==='waste-create'){
      if(logSnap.exists)throw Object.assign(new Error('Waste operation already exists without valid idempotency evidence.'),{statusCode:409,code:'operation_conflict'});
      const deduction=Math.max(0,Number(body.data?.stockDeducted||0));resultingStock=Math.max(0,currentStock-deduction);logPayload={...body.data,itemId,restaurantId,workspaceId:restaurantId,stockDeducted:deduction,inventoryOperationId:operationId,revision:1,createdAt:nowIso,createdBy:actor,updatedAt:nowIso,updatedBy:actor};tx.create(logRef,logPayload);
    }else{
      if(!logSnap.exists||existingTenantId(logSnap.data()||{})!==restaurantId)throw Object.assign(new Error('The requested record is unavailable.'),{statusCode:404,code:'target_unavailable'});const currentLog=logSnap.data()||{},oldDeduction=Math.max(0,Number(currentLog.stockDeducted||0));
      if(action==='waste-delete'){resultingStock=currentStock+oldDeduction;tx.delete(logRef);}
      else if(action==='waste-update'){const nextDeduction=Math.max(0,Number(body.data?.stockDeducted||0)),difference=nextDeduction-oldDeduction;resultingStock=Math.max(0,currentStock-difference);logPayload={...body.data,itemId,restaurantId,workspaceId:clean(currentLog.workspaceId||restaurantId),stockDeducted:nextDeduction,revision:Number(currentLog.revision||0)+1,updatedAt:nowIso,updatedBy:actor,lastInventoryOperationId:operationId};tx.set(logRef,logPayload,{merge:true});}
      else throw Object.assign(new Error('Unsupported waste operation.'),{statusCode:400,code:'invalid_request'});
    }
    tx.set(itemRef,{currentStock:resultingStock,revision:Number(item.revision||0)+1,updatedAt:nowIso,updatedBy:actor,...(body.data?.weightPerStockUnit>0?{weightPerStockUnit:Number(body.data.weightPerStockUnit)}:{}),...(body.data?.burnMode?{burnDefaultMode:body.data.burnMode}:{})},{merge:true});
    tx.create(opRef,{restaurantId,action,operationId,itemId,logId:logRef.id,resultingStock,createdAt:nowIso,createdBy:actor});return{status:'committed',id:logRef.id,currentStock:resultingStock};
  });
}
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Use POST.' });
  try {
    const app = initAdmin(req);
    const db = app.firestore();
    const body = parseBoundedBody(req);
    const collectionName = clean(body.collectionName || '');
    const action = clean(body.action || 'set');
    const docId = clean(body.docId || '');
    const data = body.data && typeof body.data === 'object' ? body.data : {};
    const restaurantId = clean(data.restaurantId || body.restaurantId || '');
    if (action.startsWith('food-safety-')) {
      const verified = await verifyRequestToken(req, { requireProjectCredentials: true });
      const check = await requireAppCheckIfEnforced(verified.app, req);
      if (!check.ok) return res.status(check.status || 401).json({ ok: false, error: check.error });
      const workspace = await authorizeAiScanWorkspace({ app: verified.app, decoded: verified.decoded, restaurantId, scanType: 'recipe' });
      const mfa = requireMfaIfEnforced(verified.decoded, workspace.workspaceUser, workspace.isSuperAdmin);
      if (!mfa.ok) return res.status(mfa.status || 403).json({ ok: false, error: mfa.error });
      const ctx = { ...workspace, uid: verified.decoded.uid, user: workspace.workspaceUser, permissions: workspace.workspaceUser?.permissions || {} };
      return res.status(200).json({ ok: true, ...await foodSafety({ db: workspace.db, ctx, body }) });
    }
    const requestedPermissions = collectionName && GENERIC_COLLECTION_CONTRACTS[collectionName]?.permissions || [];
    const roleMutation=action.startsWith('roster-role-'),wasteMutation=action.startsWith('waste-');
    const auth = await authorize(req, app, { allowTenantAdmin: true, targetRestaurantId: restaurantId, requiredPermissions: roleMutation?['schedule','team','settings']:wasteMutation?['inventory']:requestedPermissions });
    if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });
    if(wasteMutation){const appCheck=await requireAppCheckIfEnforced(auth.app||app,req);if(!appCheck.ok)return res.status(appCheck.status||401).json({ok:false,error:appCheck.error});const out=await mutateWaste(auth.db||db,{action,restaurantId:clean(restaurantId||auth.restaurantId),body,actor:auth.email||auth.uid,nowIso:new Date().toISOString()});await writeAudit(auth.db||db,auth,`WASTE_${action.replace('waste-','').toUpperCase()}`,`wasteLogs/${out.id}`,'Atomic waste and stock mutation',restaurantId||auth.restaurantId);return res.status(200).json({ok:true,...out});}
    if(roleMutation){
      const appCheck=await requireAppCheckIfEnforced(auth.app||app,req);if(!appCheck.ok)return res.status(appCheck.status||401).json({ok:false,error:appCheck.error});
      const out=await mutateRosterRole(auth.db||db,{action,restaurantId:clean(restaurantId||auth.restaurantId),roleId:docId,name:data.name||body.name,actor:auth.email||auth.uid,nowIso:new Date().toISOString()});
      await writeAudit(auth.db||db,auth,`ROSTER_ROLE_${action.replace('roster-role-','').toUpperCase()}`,out.path,'Canonical roster role lifecycle',restaurantId||auth.restaurantId);
      return res.status(200).json({ok:true,...out});
    }
    if (action === 'invoice-approve' || action === 'menu-approve' || action.startsWith('vendor-memory-') || action.startsWith('recipe-costing-')) {
      const appCheck = await requireAppCheckIfEnforced(auth.app || app, req);
      if (!appCheck.ok) return res.status(appCheck.status || 401).json({ ok: false, error: appCheck.error });
      if (!canWrite(auth, action === 'menu-approve' || action.startsWith('recipe-costing-') ? 'menuDependencies' : 'inventoryItems', restaurantId)) return res.status(403).json({ ok: false, error: 'Inventory or recipe approval permission is required.' });
      const result = action.startsWith('recipe-costing-') ? await recipeCosting({ db: auth.db || db, ctx: auth, body }) : action === 'menu-approve' ? await approveMenu({ db: auth.db || db, ctx: auth, scan: body.scan, approved: body.approved }) : action === 'invoice-approve'
        ? await approveInvoice({ db: auth.db || db, ctx: auth, invoice: body.invoice, approved: body.approved })
        : await vendorMemory({ db: auth.db || db, ctx: auth, body });
      return res.status(200).json({ ok: true, ...result });
    }
    if (!collectionName || !/^[A-Za-z0-9_-]+$/.test(collectionName)) return res.status(400).json({ ok: false, error: 'Invalid collection name.' });
    assertNotReservedBridgeRoot(collectionName);
    assertGenericContract(collectionName, action);
    assertPayloadAllowed(collectionName, data);
    if (!canWrite(auth, collectionName, restaurantId)) return res.status(403).json({ ok: false, error: `Missing write permission for ${collectionName}.` });
    const activeDb = auth.db || db;
    const requestedTenant = clean(restaurantId || auth.restaurantId);
    if (!requestedTenant || requestedTenant !== clean(auth.restaurantId) && !auth.isSuperAdmin) return res.status(403).json({ ok: false, error: 'The requested record is unavailable.' });
    if (action !== 'add' && !docId) return res.status(400).json({ ok: false, error: 'docId is required for set/update/delete.' });
    const out = await executeGenericMutation(activeDb, { collectionName, action, docId, data, restaurantId: requestedTenant, actor: auth.email || auth.uid, nowIso: new Date().toISOString() });
    await writeAudit(db, auth, `SAFE_WRITE_${action.toUpperCase()}`, out.path, body.label || 'Safe Write Engine route', restaurantId || auth.restaurantId);
    return res.status(200).json({ ok: true, ...out });
  } catch (err) {
    const publicMessage = Number(err.statusCode || 500) >= 500 ? 'The write could not be completed.' : err.message;
    return res.status(err.statusCode || 500).json({ ok: false, code: err.code, error: publicMessage });
  }
};
module.exports._test = { MAX_BODY_BYTES, parseBoundedBody, PERMS, canWrite, GENERIC_COLLECTION_CONTRACTS, DENIED_COLLECTIONS, FORBIDDEN_AUTHORITY_FIELDS, SERVER_OWNED_FIELDS, existingTenantId, assertGenericContract, forbiddenPayloadPath, assertPayloadAllowed, protectServerOwnedFields, verifyExistingTargetOwnership, executeGenericMutation, mutateRosterRole, uniqueRoleNames, mutateWaste, wasteOperationId };
