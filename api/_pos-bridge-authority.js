'use strict';
const crypto = require('node:crypto');
const { authorize, requireAppCheckIfEnforced } = require('./_chaos-admin');
const { canonicalMembershipState, verifyFirebaseAccount, inactive } = require('./_shift4-authority');
const { getPosBridgeAdminApp } = require('./_pos-bridge-project');
const { bridgeEnabled, bridgeEnvironment } = require('./_pos-bridge-config');
const { hashTuple } = require('./_pos-bridge-schema');

const RECENT_AUTH_SECONDS = 15 * 60;
function installationId() { return `pbi_${crypto.randomBytes(24).toString('base64url')}`; }
function scopeId(restaurantId, locationId, namespace) { return hashTuple('scope',[restaurantId,locationId,namespace]); }
function isOwnerAdmin(ctx) { const u=ctx.user||{}; return Boolean(ctx.isSuperAdmin || u.isOwner || u.accountOwner || u.owner || u.workspaceOwner || u.isAdmin); }
function recordInactive(value) {
  const status=String(value?.status||value?.recordStatus||'').trim().toLowerCase();
  return !value || value.isActive===false || value.disabled===true || value.accountDisabled===true || value.deleted===true || value.archived===true || value.removed===true || ['inactive','revoked','disabled','deleted','archived','removed','deactivated'].includes(status);
}
function isActiveRestaurantRecord(value) { return !recordInactive(value); }
function requireCanonicalOwnerAdmin(auth, memberState) {
  if (recordInactive(auth.accountUser) || recordInactive(auth.user)) throw Object.assign(new Error('This account is inactive.'),{code:'forbidden',statusCode:403});
  if (!memberState?.exists || recordInactive(memberState.member) || inactive(memberState.member) || memberState.hasExplicitInactive) throw Object.assign(new Error('Workspace membership is inactive or unavailable.'),{code:'forbidden',statusCode:403});
  if (!isOwnerAdmin({user:memberState.member,isSuperAdmin:false})) throw Object.assign(new Error('Owner or administrator required.'),{code:'forbidden',statusCode:403});
  return memberState.member;
}
function requireRecentAuth(decoded, nowSeconds=Math.floor(Date.now()/1000)) {
  const authTime=Number(decoded?.auth_time||0);
  if (!authTime || nowSeconds-authTime>RECENT_AUTH_SECONDS || authTime>nowSeconds+30) throw Object.assign(new Error('Recent authentication is required.'),{code:'forbidden',statusCode:403});
}
function assertHumanTokenProject(req, projectId) {
  const token=String(req?.headers?.authorization||'').replace(/^Bearer\s+/,'').trim();
  try {
    const parts=token.split('.');
    if(parts.length!==3)throw new Error('malformed');
    const payload=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
    if(payload.aud!==projectId)throw new Error('wrong project');
  } catch (_) { throw Object.assign(new Error('Firebase user token is not for this deployment.'),{code:'forbidden',statusCode:403}); }
}
async function authorizeControlPlane(req, restaurantId, { recent=true, dependencies={} }={}) {
  if (!bridgeEnabled()) throw Object.assign(new Error('Bridge disabled.'),{code:'bridge_disabled',statusCode:503});
  const getApp=dependencies.getPosBridgeAdminApp||getPosBridgeAdminApp;
  const authorizeHuman=dependencies.authorize||authorize;
  const requireAppCheck=dependencies.requireAppCheckIfEnforced||requireAppCheckIfEnforced;
  const verifyAccount=dependencies.verifyFirebaseAccount||verifyFirebaseAccount;
  const readCanonicalMembership=dependencies.canonicalMembershipState||canonicalMembershipState;
  const app=getApp(req);
  assertHumanTokenProject(req,app.options?.projectId);
  const auth=await authorizeHuman(req,app,{allowTenantAdmin:true,targetRestaurantId:String(restaurantId||'').trim()});
  if (!auth.ok) throw Object.assign(new Error(auth.error),{code:auth.status===401?'forbidden':'forbidden',statusCode:auth.status});
  const token=String(req?.headers?.authorization||'').replace(/^Bearer\s+/i,'').trim();
  try{await verifyAccount(auth.app||app,auth.uid,token);}catch(_){throw Object.assign(new Error('Firebase session or account is inactive.'),{code:'forbidden',statusCode:403});}
  const memberState=await readCanonicalMembership(auth.db||(auth.app||app).firestore(),auth.uid,auth.email,String(restaurantId||'').trim());
  const canonicalMembership=requireCanonicalOwnerAdmin(auth,memberState);
  const appCheck=await requireAppCheck(auth.app||app,req);
  if (!appCheck.ok) throw Object.assign(new Error(appCheck.error),{code:'forbidden',statusCode:appCheck.status||403});
  if (!auth.isSuperAdmin && auth.restaurantId!==restaurantId) throw Object.assign(new Error('Tenant mismatch.'),{code:'forbidden',statusCode:403});
  if (recent) requireRecentAuth(auth.decoded);
  const db=auth.db||(auth.app||app).firestore();
  const restaurant=await db.collection('restaurants').doc(String(restaurantId||'').trim()).get();
  if(!restaurant.exists||!isActiveRestaurantRecord(restaurant.data()))throw Object.assign(new Error('Tenant unavailable.'),{code:'forbidden',statusCode:403});
  return {...auth,canonicalMembership,app:auth.app||app,db,environment:bridgeEnvironment()};
}
function validatePublicKeys(publicKeys) {
  if (!Array.isArray(publicKeys) || publicKeys.length<1 || publicKeys.length>3) throw Object.assign(new Error('One to three public keys are required.'),{code:'invalid_request',statusCode:400});
  const kids=new Set();
  return publicKeys.map(entry=>{
    const kid=String(entry?.kid||'').trim(); const jwk=entry?.jwk;
    if (!kid || kid.length>128 || kids.has(kid) || !jwk || typeof jwk!=='object') throw Object.assign(new Error('Invalid public key registration.'),{code:'invalid_request',statusCode:400});
    kids.add(kid);
    const entryKeys=Object.keys(entry).sort(),jwkKeys=Object.keys(jwk).sort();
    if (entryKeys.some(k=>!['jwk','kid'].includes(k)) || jwkKeys.some(k=>!['alg','crv','kid','kty','use','x','y'].includes(k)) || 'd' in jwk || jwk.kty!=='EC' || jwk.crv!=='P-256' || jwk.alg && jwk.alg!=='ES256' || !jwk.x || !jwk.y || jwk.use && jwk.use!=='sig') throw Object.assign(new Error('Only ES256 P-256 public JWKs are accepted.'),{code:'invalid_request',statusCode:400});
    const normalized={kty:'EC',crv:'P-256',x:String(jwk.x),y:String(jwk.y),alg:'ES256',use:'sig',kid};
    try { const key=crypto.createPublicKey({key:normalized,format:'jwk'}); if(key.asymmetricKeyType!=='ec'||key.asymmetricKeyDetails?.namedCurve!=='prime256v1')throw new Error('wrong curve'); }
    catch(_){throw Object.assign(new Error('Malformed ES256 public key.'),{code:'invalid_request',statusCode:400});}
    return {kid,jwk:normalized,status:'active'};
  });
}
function auditRecord(ctx, action, target, details, restaurantId) { return {restaurantId,action,target,details,userId:ctx.userDocId||ctx.uid,userName:ctx.email||ctx.uid,timestamp:new Date().toISOString(),sessionSource:'pos-bridge-control-plane',isGhost:false}; }

module.exports={RECENT_AUTH_SECONDS,installationId,scopeId,isOwnerAdmin,recordInactive,isActiveRestaurantRecord,requireCanonicalOwnerAdmin,requireRecentAuth,assertHumanTokenProject,authorizeControlPlane,validatePublicKeys,auditRecord};
