'use strict';
const crypto = require('node:crypto');
const { config, LIMITS, SERVER_CAPABILITIES } = require('./_pos-bridge-config');
const { hashTuple, canonicalJson } = require('./_pos-bridge-schema');
const { isActiveRestaurantRecord } = require('./_pos-bridge-authority');

async function jose() { return import('jose'); }
function assertInstallationId(value){const id=String(value||'');if(!/^pbi_[A-Za-z0-9_-]{32}$/.test(id))throw Object.assign(new Error('Invalid installation identity.'),{code:'invalid_assertion',statusCode:401});return id;}
function bearer(req) { const value=String(req.headers?.authorization||''); return value.startsWith('Bearer ')?value.slice(7).trim():''; }
function constantIntersection(...sets) { const normalized=sets.map(values=>new Set(Array.isArray(values)?values:[])); return SERVER_CAPABILITIES.filter(cap=>normalized.every(set=>set.has(cap))); }
function epochFromEnv(env=process.env) { const n=Number(env.POS_BRIDGE_SECURITY_EPOCH||1); return Number.isSafeInteger(n)&&n>=1?n:1; }
async function currentAuthority(db, installationId, {transaction=null}={}) {
  const installRef=db.collection('posBridgeInstallations').doc(installationId); const controlRef=db.collection('posBridgeControl').doc('global');
  const get=ref=>transaction?transaction.get(ref):ref.get();
  const [snap,controlSnap]=await Promise.all([get(installRef),get(controlRef)]);
  if (!snap.exists) throw Object.assign(new Error('Unknown installation.'),{code:'invalid_access_token',statusCode:401});
  const installation=snap.data()||{}; const control=controlSnap.exists?controlSnap.data()||{}:{}; const cfg=config();
  const expectedEpoch=Math.max(epochFromEnv(),Number(control.securityEpoch||1));
  if (control.enabled===false || installation.status!=='active') throw Object.assign(new Error('Installation inactive.'),{code:'installation_inactive',statusCode:401});
  if (installation.environment!==cfg.environment || Number(installation.securityEpoch)!==expectedEpoch) throw Object.assign(new Error('Authority changed.'),{code:'authority_changed',statusCode:401});
  const scopeRef=db.collection('posBridgeScopes').doc(installation.tenantScopeId); const restaurantRef=db.collection('restaurants').doc(installation.restaurantId); const [scopeSnap,restaurantSnap]=await Promise.all([get(scopeRef),get(restaurantRef)]);
  const scope=scopeSnap.exists?scopeSnap.data()||{}:{};
  if(!restaurantSnap.exists||!isActiveRestaurantRecord(restaurantSnap.data()))throw Object.assign(new Error('Owning tenant is inactive.'),{code:'installation_inactive',statusCode:401});
  if (!scopeSnap.exists || scope.active!==true || scope.locationStatus!=='active' || scope.activeInstallationId!==installationId || scope.restaurantId!==installation.restaurantId || scope.locationId!==installation.locationId || scope.sourceNamespaceId!==installation.sourceNamespaceId) throw Object.assign(new Error('Installation authority changed.'),{code:'authority_changed',statusCode:401});
  return {installation,scope,expectedEpoch,refs:{installRef,controlRef,scopeRef,restaurantRef},cfg};
}
function publicKeyFingerprint(entry) {
  const jwk=entry?.jwk||{};
  return crypto.createHash('sha256').update(canonicalJson({kty:jwk.kty,crv:jwk.crv,x:jwk.x,y:jwk.y,alg:jwk.alg||'ES256',use:jwk.use||'sig'}),'utf8').digest('hex');
}
async function importAssertionKey(installation, protectedHeader) {
  if (protectedHeader.alg!=='ES256' || !protectedHeader.kid) throw Object.assign(new Error('Invalid assertion algorithm.'),{code:'invalid_assertion',statusCode:401});
  const entry=(installation.publicKeys||[]).find(k=>k.kid===protectedHeader.kid&&k.status==='active');
  if (!entry || entry.jwk?.d || entry.jwk?.kty!=='EC' || entry.jwk?.crv!=='P-256') throw Object.assign(new Error('Unknown assertion key.'),{code:'invalid_assertion',statusCode:401});
  const {importJWK}=await jose(); return {key:await importJWK(entry.jwk,'ES256'),binding:{kid:entry.kid,credentialVersion:Number(installation.credentialVersion),fingerprint:publicKeyFingerprint(entry)}};
}
async function consumeAssertionAndIssueToken(db,{clientAssertion,installationId,requestedCapabilities=[]}) {
  const cfg=config(); if (!cfg.enabled) throw Object.assign(new Error('Disabled.'),{code:'bridge_disabled',statusCode:503});
  installationId=assertInstallationId(installationId);
  const installSnap=await db.collection('posBridgeInstallations').doc(installationId).get();
  if (!installSnap.exists) throw Object.assign(new Error('Invalid assertion.'),{code:'invalid_assertion',statusCode:401});
  const installation=installSnap.data()||{}; const {decodeProtectedHeader,jwtVerify,SignJWT,importJWK}=await jose();
  let header; try { header=decodeProtectedHeader(clientAssertion); } catch (_) { throw Object.assign(new Error('Invalid assertion.'),{code:'invalid_assertion',statusCode:401}); }
  const verifiedKey=await importAssertionKey(installation,header); let verified;
  try { verified=await jwtVerify(clientAssertion,verifiedKey.key,{algorithms:['ES256'],audience:cfg.tokenEndpointAudience,issuer:installationId,subject:installationId,clockTolerance:LIMITS.assertionClockToleranceSeconds,requiredClaims:['exp','iat','jti','iss','sub','aud','credentialVersion']}); } catch (_) { throw Object.assign(new Error('Invalid assertion.'),{code:'invalid_assertion',statusCode:401}); }
  const claims=verified.payload; const now=Math.floor(Date.now()/1000);
  if (!claims.jti || String(claims.jti).length>128 || claims.exp<=claims.iat || claims.exp-claims.iat>LIMITS.assertionLifetimeSeconds || claims.iat>now+LIMITS.assertionClockToleranceSeconds || claims.environment!==cfg.environment || claims.token_type!=='urn:86chaos:pos-bridge:client-assertion' || Number(claims.credentialVersion)!==verifiedKey.binding.credentialVersion) throw Object.assign(new Error('Invalid assertion claims.'),{code:'invalid_assertion',statusCode:401});
  let signingKey;try{signingKey=await importJWK(cfg.privateJwk,'ES256');}catch(_){throw Object.assign(new Error('Invalid bridge signing key.'),{code:'bridge_configuration_invalid',statusCode:503});}
  const replayId=hashTuple('assertion',[installationId,claims.jti]);
  const authority=await db.runTransaction(async tx=>{
    const current=await currentAuthority(db,installationId,{transaction:tx}); const currentKey=(current.installation.publicKeys||[]).find(entry=>entry.kid===verifiedKey.binding.kid&&entry.status==='active');
    if(Number(current.installation.credentialVersion)!==verifiedKey.binding.credentialVersion||!currentKey||publicKeyFingerprint(currentKey)!==verifiedKey.binding.fingerprint)throw Object.assign(new Error('Credential generation changed during assertion verification.'),{code:'authority_changed',statusCode:401});
    const transactionNow=Math.floor(Date.now()/1000);if(Number(claims.exp)+LIMITS.assertionClockToleranceSeconds<transactionNow||Number(claims.iat)>transactionNow+LIMITS.assertionClockToleranceSeconds)throw Object.assign(new Error('Assertion is no longer fresh.'),{code:'invalid_assertion',statusCode:401});
    const ref=db.collection('posBridgeAuthReplays').doc(replayId);const minute=Math.floor(transactionNow/60);const quotaRef=db.collection('posBridgeControl').doc('quota').collection('windows').doc(hashTuple('quota',[installationId,'token']));const [replay,quotaSnap]=await Promise.all([tx.get(ref),tx.get(quotaRef)]);
    if (replay.exists) throw Object.assign(new Error('Assertion replayed.'),{code:'assertion_replayed',statusCode:401});
    const quotaCount=Number(quotaSnap.data()?.minute)===minute?Number(quotaSnap.data()?.count||0):0;if(quotaCount+1>LIMITS.tokenExchangesPerMinute)throw Object.assign(new Error('Rate limited.'),{code:'rate_limited',statusCode:429,retryAfter:60-(Math.floor(Date.now()/1000)%60)});
    tx.set(quotaRef,{installationId,kind:'token',minute,count:quotaCount+1,expiresAt:new Date((minute+2)*60000).toISOString()},{merge:true});
    tx.create(ref,{installationId,jtiHash:crypto.createHash('sha256').update(String(claims.jti)).digest('hex'),consumedAt:new Date().toISOString(),expiresAt:new Date((claims.exp+LIMITS.assertionClockToleranceSeconds+300)*1000).toISOString(),environment:cfg.environment,securityEpoch:current.expectedEpoch});
    return current;
  });
  const approved=authority.installation.approvedCapabilities||[]; const requested=requestedCapabilities.length?requestedCapabilities:approved; const effective=constantIntersection(approved,requested);
  const token=await new SignJWT({token_type:'urn:86chaos:pos-bridge:access-token',posInstallationId:installationId,restaurantId:authority.installation.restaurantId,locationId:authority.installation.locationId,sourceNamespaceId:authority.installation.sourceNamespaceId,environment:cfg.environment,credentialVersion:authority.installation.credentialVersion,securityEpoch:authority.expectedEpoch,capabilities:effective})
    .setProtectedHeader({alg:'ES256',kid:cfg.keyId,typ:'at+jwt'}).setIssuer(cfg.issuer).setAudience(cfg.audience).setSubject(installationId).setIssuedAt().setJti(crypto.randomUUID()).setExpirationTime(`${LIMITS.accessTokenLifetimeSeconds}s`).sign(signingKey);
  return {accessToken:token,tokenType:'Bearer',expiresIn:LIMITS.accessTokenLifetimeSeconds,capabilities:effective};
}
async function verifyAccessToken(db,req,{requiredCapability}={}) {
  const cfg=config(); if(!cfg.enabled)throw Object.assign(new Error('Disabled.'),{code:'bridge_disabled',statusCode:503});const token=bearer(req); if (!token) throw Object.assign(new Error('Missing token.'),{code:'invalid_access_token',statusCode:401});
  const {importJWK,jwtVerify}=await jose(); const publicJwk={...cfg.privateJwk};delete publicJwk.d;const key=await importJWK(publicJwk,'ES256'); let verified;
  try { verified=await jwtVerify(token,key,{algorithms:['ES256'],issuer:cfg.issuer,audience:cfg.audience,clockTolerance:0,requiredClaims:['exp','iat','iss','aud','sub','jti']}); } catch (_) { throw Object.assign(new Error('Invalid access token.'),{code:'invalid_access_token',statusCode:401}); }
  const claims=verified.payload;
  if (verified.protectedHeader.typ!=='at+jwt' || claims.token_type!=='urn:86chaos:pos-bridge:access-token' || claims.environment!==cfg.environment || claims.sub!==claims.posInstallationId) throw Object.assign(new Error('Wrong token type.'),{code:'invalid_access_token',statusCode:401});
  const authority=await currentAuthority(db,String(claims.posInstallationId||'')); const i=authority.installation;
  if (claims.restaurantId!==i.restaurantId || claims.locationId!==i.locationId || claims.sourceNamespaceId!==i.sourceNamespaceId || Number(claims.credentialVersion)!==Number(i.credentialVersion) || Number(claims.securityEpoch)!==authority.expectedEpoch) throw Object.assign(new Error('Stale authority.'),{code:'authority_changed',statusCode:401});
  const capabilities=constantIntersection(i.approvedCapabilities||[],claims.capabilities||[]);
  if (requiredCapability&&!capabilities.includes(requiredCapability)) throw Object.assign(new Error('Capability denied.'),{code:'forbidden',statusCode:403});
  return {...authority,claims,capabilities};
}
async function admitRate(db,installationId,kind,units=1) {
  const limits={token:LIMITS.tokenExchangesPerMinute,eventRequest:LIMITS.eventRequestsPerMinute,event:LIMITS.eventsPerMinute,read:LIMITS.readsPerMinute}; const limit=limits[kind];
  if (!limit) throw new Error('Unknown bridge rate class.'); const minute=Math.floor(Date.now()/60000); const id=hashTuple('quota',[installationId,kind]); const ref=db.collection('posBridgeControl').doc('quota').collection('windows').doc(id);
  await db.runTransaction(async tx=>{const snap=await tx.get(ref);const count=Number(snap.data()?.minute)===minute?Number(snap.data()?.count||0):0;if(count+units>limit)throw Object.assign(new Error('Rate limited.'),{code:'rate_limited',statusCode:429,retryAfter:60-(Math.floor(Date.now()/1000)%60)});tx.set(ref,{installationId,kind,minute,count:count+units,expiresAt:new Date((minute+2)*60000).toISOString()},{merge:false});});
}

module.exports={jose,bearer,assertInstallationId,constantIntersection,currentAuthority,consumeAssertionAndIssueToken,verifyAccessToken,admitRate,epochFromEnv,publicKeyFingerprint};
