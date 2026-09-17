'use strict';
const crypto = require('node:crypto');
const { LIMITS } = require('./_pos-bridge-config');
const { hashTuple,eventContentHash,entityContentHash } = require('./_pos-bridge-schema');
const { currentAuthority } = require('./_pos-bridge-auth');

function refsFor(db,scopeId,event) {
  const scope=db.collection('posBridgeScopes').doc(scopeId);
  const deliveryKey=hashTuple('delivery',[event.posInstallationId,event.eventId]);
  const entityKey=hashTuple('entity',[event.sourceEntityType,event.sourceEntityId]);
  const versionKey=hashTuple('entity-version',[event.sourceEntityType,event.sourceEntityId,event.sourceEntityVersion]);
  const windowId=String(Math.floor((event.sequence-1)/LIMITS.sequenceWindowSize)).padStart(12,'0');
  return {scope,deliveryKey,entityKey,versionKey,windowId,eventRef:scope.collection('events').doc(deliveryKey),versionRef:scope.collection('entityVersions').doc(versionKey),headRef:scope.collection('entityHeads').doc(entityKey),streamRef:scope.collection('streams').doc(event.posInstallationId),windowRef:scope.collection('streams').doc(event.posInstallationId).collection('sequenceWindows').doc(windowId)};
}
function receiptId() { return `pbr_${crypto.randomBytes(18).toString('base64url')}`; }
async function advanceContiguous(tx,streamDoc,scope,installationId,highestObserved,prefetchedWindows=[]) {
  let cursor=Number(streamDoc.highestContiguousSequence||0)+1; let advanced=0; const cache=new Map(prefetchedWindows.map(window=>[window.ref.id,window.data()||{}]));
  while(advanced<LIMITS.sequenceWindowSize&&cursor<=highestObserved) {
    const windowId=String(Math.floor((cursor-1)/LIMITS.sequenceWindowSize)).padStart(12,'0');
    let doc=cache.get(windowId);
    if(!doc){const ref=scope.collection('streams').doc(installationId).collection('sequenceWindows').doc(windowId);const snap=await tx.get(ref);doc=snap.exists?snap.data()||{}:{};cache.set(windowId,doc);}
    const slot=String((cursor-1)%LIMITS.sequenceWindowSize);
    if(!doc.slots?.[slot]) break;
    cursor+=1;advanced+=1;
  }
  const checkpointWorkPending=cursor<=highestObserved&&advanced===LIMITS.sequenceWindowSize;
  return {highestContiguousSequence:cursor-1,checkpointComplete:!checkpointWorkPending,checkpointWorkPending,advanced};
}
async function stageEvent(db,authority,event) {
  const contentHash=eventContentHash(event); const logicalHash=entityContentHash(event); const refs=refsFor(db,authority.installation.tenantScopeId,event); const now=new Date().toISOString();
  const result=await db.runTransaction(async tx=>{
    const current=await currentAuthority(db,event.posInstallationId,{transaction:tx});
    if(current.installation.tenantScopeId!==authority.installation.tenantScopeId) throw Object.assign(new Error('Authority changed.'),{code:'authority_changed',statusCode:401});
    const authorizedCredential=Number(authority.claims?.credentialVersion??authority.installation.credentialVersion);
    const authorizedEpoch=Number(authority.claims?.securityEpoch??authority.installation.securityEpoch);
    if(Number(current.installation.credentialVersion)!==authorizedCredential||current.expectedEpoch!==authorizedEpoch)throw Object.assign(new Error('Authority changed.'),{code:'authority_changed',statusCode:401});
    const [existing,streamSnap,windowSnap,versionSnap,headSnap]=await Promise.all([tx.get(refs.eventRef),tx.get(refs.streamRef),tx.get(refs.windowRef),tx.get(refs.versionRef),tx.get(refs.headRef)]);
    const stream=streamSnap.exists?streamSnap.data()||{}:{};
    if(existing.exists){const prior=existing.data()||{};if(prior.contentHash!==contentHash){tx.set(refs.streamRef,{conflictAttempts:Number(stream.conflictAttempts||0)+1,lastEventReceivedAt:now},{merge:true});return {__conflict:true};}return {...prior,deliveryOutcome:'duplicate'};}
    const slots=windowSnap.exists?{...(windowSnap.data()?.slots||{})}:{}; const slot=String((event.sequence-1)%LIMITS.sequenceWindowSize); const existingSlot=slots[slot];
    if(existingSlot&&existingSlot!==contentHash){tx.set(refs.streamRef,{conflictAttempts:Number(stream.conflictAttempts||0)+1,lastEventReceivedAt:now},{merge:true});return {__conflict:true};}
    if(versionSnap.exists&&(versionSnap.data()?.contentHash!==logicalHash)){tx.set(refs.streamRef,{conflictAttempts:Number(stream.conflictAttempts||0)+1,lastEventReceivedAt:now},{merge:true});return {__conflict:true};}
    if(event.sequence>Number(stream.highestContiguousSequence||0)+LIMITS.maxAheadOfContiguous) throw Object.assign(new Error('Sequence is too far ahead.'),{code:'conflict',statusCode:409});
    const logicalDuplicate=versionSnap.exists; const id=receiptId(); const receipt={receiptId:id,outcome:logicalDuplicate?'duplicate':'accepted',status:logicalDuplicate?'duplicate':'accepted',processingStatus:'staged',processingEnabled:false,contentHash,hashVersion:1,eventId:event.eventId,eventType:event.eventType,schemaVersion:event.schemaVersion,posInstallationId:event.posInstallationId,restaurantId:current.installation.restaurantId,locationId:current.installation.locationId,sourceNamespaceId:current.installation.sourceNamespaceId,sourceEntityType:event.sourceEntityType,sourceEntityId:event.sourceEntityId,sourceEntityVersion:event.sourceEntityVersion,sequence:event.sequence,occurredAt:event.occurredAt,receivedAt:now,...(logicalDuplicate?{logicalDuplicateOf:versionSnap.data().receiptId}:{payload:event.payload})};
    slots[slot]=contentHash;
    const highestObserved=Math.max(Number(stream.highestSequenceObserved||0),event.sequence);const advancement=await advanceContiguous(tx,stream,refs.scope,event.posInstallationId,highestObserved,[{ref:refs.windowRef,data:()=>({slots})}]);
    tx.create(refs.eventRef,receipt);
    tx.set(refs.windowRef,{windowId:refs.windowId,startSequence:Math.floor((event.sequence-1)/LIMITS.sequenceWindowSize)*LIMITS.sequenceWindowSize+1,endSequence:(Math.floor((event.sequence-1)/LIMITS.sequenceWindowSize)+1)*LIMITS.sequenceWindowSize,slots,updatedAt:now},{merge:false});
    if(!logicalDuplicate)tx.create(refs.versionRef,{contentHash:logicalHash,hashVersion:1,receiptId:id,eventId:event.eventId,sourceEntityType:event.sourceEntityType,sourceEntityId:event.sourceEntityId,sourceEntityVersion:event.sourceEntityVersion,sequence:event.sequence,receivedAt:now});
    const head=headSnap.exists?headSnap.data()||{}:{};
    if(!logicalDuplicate&&event.sourceEntityVersion>Number(head.sourceEntityVersion||0))tx.set(refs.headRef,{sourceEntityType:event.sourceEntityType,sourceEntityId:event.sourceEntityId,sourceEntityVersion:event.sourceEntityVersion,contentHash:logicalHash,receiptId:id,sequence:event.sequence,updatedAt:now},{merge:false});
    const uniqueSequences=Number(stream.uniqueSequencesObserved||0)+(existingSlot?0:1); const uniqueEvents=Number(stream.uniqueEventsReceived||0)+(logicalDuplicate?0:1);const missingSequenceCount=Math.max(0,highestObserved-uniqueSequences);const reconciliationStatus=missingSequenceCount>0?'transport-gaps':advancement.checkpointWorkPending?'checkpoint-pending':'transport-contiguous';
    tx.set(refs.streamRef,{restaurantId:current.installation.restaurantId,locationId:current.installation.locationId,sourceNamespaceId:current.installation.sourceNamespaceId,lastEventReceivedAt:now,highestSequenceObserved:highestObserved,highestContiguousSequence:advancement.highestContiguousSequence,uniqueSequencesObserved:uniqueSequences,uniqueEventsReceived:uniqueEvents,stagedEvents:Number(stream.stagedEvents||0)+(logicalDuplicate?0:1),validationFailureAttempts:Number(stream.validationFailureAttempts||0),logicalDuplicateEvents:Number(stream.logicalDuplicateEvents||0)+(logicalDuplicate?1:0),conflictAttempts:Number(stream.conflictAttempts||0),missingSequenceCount,checkpointComplete:advancement.checkpointComplete,checkpointWorkPending:advancement.checkpointWorkPending,processingEnabled:false,lastSequenceProcessed:null,reconciliationStatus,updatedAt:now},{merge:true});
    return receipt;
  });
  if(result?.__conflict)throw Object.assign(new Error('Conflicting durable evidence.'),{code:'conflict',statusCode:409});
  return result;
}
async function continueSequenceCheckpoint(db,authority){const installationId=authority.claims?.posInstallationId||authority.installation.posInstallationId;const ref=db.collection('posBridgeScopes').doc(authority.installation.tenantScopeId).collection('streams').doc(installationId);return db.runTransaction(async tx=>{const current=await currentAuthority(db,installationId,{transaction:tx});if(current.installation.tenantScopeId!==authority.installation.tenantScopeId||Number(current.installation.credentialVersion)!==Number(authority.claims?.credentialVersion??authority.installation.credentialVersion)||current.expectedEpoch!==Number(authority.claims?.securityEpoch??authority.installation.securityEpoch))throw Object.assign(new Error('Authority changed.'),{code:'authority_changed',statusCode:401});const snap=await tx.get(ref);if(!snap.exists)return null;const stream=snap.data()||{};if(stream.checkpointWorkPending!==true&&stream.checkpointComplete!==false)return stream;const highestObserved=Number(stream.highestSequenceObserved||0);const advancement=await advanceContiguous(tx,stream,current.refs.scopeRef,installationId,highestObserved);const missingSequenceCount=Number(stream.missingSequenceCount||0);const reconciliationStatus=missingSequenceCount>0?'transport-gaps':advancement.checkpointWorkPending?'checkpoint-pending':highestObserved?'transport-contiguous':'no-events';const patch={highestContiguousSequence:advancement.highestContiguousSequence,checkpointComplete:advancement.checkpointComplete,checkpointWorkPending:advancement.checkpointWorkPending,reconciliationStatus,updatedAt:new Date().toISOString()};if(advancement.highestContiguousSequence!==Number(stream.highestContiguousSequence||0)||stream.checkpointWorkPending!==patch.checkpointWorkPending||stream.checkpointComplete!==patch.checkpointComplete)tx.set(ref,patch,{merge:true});return {...stream,...patch};});}
async function recordValidationFailureAttempt(db,authority){const ref=db.collection('posBridgeScopes').doc(authority.installation.tenantScopeId).collection('streams').doc(authority.claims.posInstallationId);await db.runTransaction(async tx=>{const currentAuthorityState=await currentAuthority(db,authority.claims.posInstallationId,{transaction:tx});if(currentAuthorityState.installation.tenantScopeId!==authority.installation.tenantScopeId||Number(currentAuthorityState.installation.credentialVersion)!==Number(authority.claims.credentialVersion)||currentAuthorityState.expectedEpoch!==Number(authority.claims.securityEpoch))throw Object.assign(new Error('Authority changed.'),{code:'authority_changed',statusCode:401});const snap=await tx.get(ref);const current=snap.exists?snap.data()||{}:{};tx.set(ref,{validationFailureAttempts:Number(current.validationFailureAttempts||0)+1,updatedAt:new Date().toISOString(),processingEnabled:false},{merge:true});});}
async function receiptByEventId(db,authority,eventId){const key=hashTuple('delivery',[authority.installation.posInstallationId||authority.claims?.posInstallationId,eventId]);const ref=db.collection('posBridgeScopes').doc(authority.installation.tenantScopeId).collection('events').doc(key);const snap=await ref.get();if(!snap.exists)throw Object.assign(new Error('Not found.'),{code:'not_found',statusCode:404});return snap.data();}

module.exports={refsFor,stageEvent,receiptByEventId,recordValidationFailureAttempt,advanceContiguous,continueSequenceCheckpoint};
