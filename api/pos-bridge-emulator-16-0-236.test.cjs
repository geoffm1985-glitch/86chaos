'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const admin = require('firebase-admin');
const { stageEvent, refsFor } = require('./_pos-bridge-storage');
const { summary } = require('./_pos-bridge-reconciliation');
const { changeMapping } = require('./_pos-bridge-mappings');
const { scopeId } = require('./_pos-bridge-authority');
const { eventContentHash, entityContentHash } = require('./_pos-bridge-schema');
const { validateSimulatorTarget } = require('../test-tools/pos-bridge-simulator.cjs');
const { orderEvent } = require('../test-tools/pos-bridge-fixtures.cjs');
const {
  createTrace, event: traceEvent, createReadBarrier, instrumentFirestoreDb,
  recordSettlements, writeTrace,
} = require('../test-tools/firestore-emulator-trace.cjs');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  test('POS Bridge concurrency suite runs only through required emulator command', { skip: 'Run npm run test:pos-bridge:emulator; release gate requires it.' }, () => {});
} else {
  Object.assign(process.env, {
    POS_BRIDGE_ENABLED: 'true', POS_BRIDGE_ENVIRONMENT: 'testing',
    POS_BRIDGE_TOKEN_ISSUER: 'issuer', POS_BRIDGE_TOKEN_AUDIENCE: 'audience',
    POS_BRIDGE_ASSERTION_AUDIENCE: 'token-audience', POS_BRIDGE_SIGNING_KEY_ID: 'key',
    POS_BRIDGE_SIGNING_PRIVATE_JWK: JSON.stringify({ kty:'EC', crv:'P-256', x:'x', y:'y', d:'d', alg:'ES256' }),
    POS_BRIDGE_SECURITY_EPOCH: '1',
  });
  const app = admin.apps.find(row => row.name === 'pos-bridge-emulator') || admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-pos-bridge' }, 'pos-bridge-emulator');
  const db = app.firestore();
  const roots = ['posBridgeInstallations','posBridgeScopes','posBridgeControl','posBridgeAuthReplays','restaurants','workspaceMembers','auditLogs'];
  const operational = ['inventoryItems','sales','ledger','shifts','timePunches','payroll','recipes','menuDependencies','vendors','orders','parLevels','customers'];
  let targetProof;

  async function requireSafeTarget() {
    if (!targetProof) targetProof = await validateSimulatorTarget('http://127.0.0.1:5001', { ...process.env, GCLOUD_PROJECT: process.env.GCLOUD_PROJECT || 'demo-pos-bridge' });
    return targetProof;
  }
  async function clear() {
    await requireSafeTarget();
    for (const name of [...roots, ...operational]) {
      const snap = await db.collection(name).get();
      await Promise.all(snap.docs.map(doc => db.recursiveDelete(doc.ref)));
    }
  }
  async function seed() {
    await clear();
    const installation = { posInstallationId:'pbi-test', restaurantId:'rest-a', locationId:'loc-a', sourceNamespaceId:'ns-a', tenantScopeId:'scope-a', environment:'testing', status:'active', credentialVersion:1, securityEpoch:1, approvedCapabilities:['event.staging'] };
    await Promise.all([
      db.collection('posBridgeInstallations').doc('pbi-test').set(installation),
      db.collection('restaurants').doc('rest-a').set({ isActive:true, status:'active' }),
      db.collection('posBridgeControl').doc('global').set({ enabled:true, securityEpoch:1 }),
      db.collection('posBridgeScopes').doc('scope-a').set({ restaurantId:'rest-a', locationId:'loc-a', sourceNamespaceId:'ns-a', active:true, locationStatus:'active', activeInstallationId:'pbi-test' }),
    ]);
    return { installation, claims:{ posInstallationId:'pbi-test', credentialVersion:1, securityEpoch:1 } };
  }
  async function durableState(authority, events) {
    const scope = db.collection('posBridgeScopes').doc('scope-a');
    const [eventSnap, versionSnap, headSnap, streamSnap, windowSnap, domainSnaps] = await Promise.all([
      scope.collection('events').get(), scope.collection('entityVersions').get(), scope.collection('entityHeads').get(),
      scope.collection('streams').doc('pbi-test').get(), scope.collection('streams').doc('pbi-test').collection('sequenceWindows').doc('000000000000').get(),
      Promise.all(operational.map(name => db.collection(name).get())),
    ]);
    return {
      eventCount: eventSnap.size,
      receiptIds: eventSnap.docs.map(doc => doc.data().receiptId).sort(),
      eventIds: eventSnap.docs.map(doc => doc.data().eventId).sort(),
      versionCount: versionSnap.size,
      versions: versionSnap.docs.map(doc => ({ id:doc.id, ...doc.data() })),
      heads: headSnap.docs.map(doc => ({ id:doc.id, ...doc.data() })),
      stream: streamSnap.data() || {},
      slots: windowSnap.data()?.slots || {},
      submitted: events.map(row => ({ eventId:row.eventId, contentHash:eventContentHash(row), entityHash:entityContentHash(row), refs:refsFor(db, authority.installation.tenantScopeId, row) })),
      operationalWrites: domainSnaps.reduce((sum, snap) => sum + snap.size, 0),
    };
  }
  function oneWinner(settled) {
    const reasons = settled.map(row => row.status === 'fulfilled' ? { status:row.status, receiptId:row.value?.receiptId } : { status:row.status, code:row.reason?.code, message:row.reason?.message });
    assert.equal(settled.filter(row => row.status === 'fulfilled').length, 1, JSON.stringify(reasons));
    assert.equal(settled.filter(row => row.status === 'rejected' && row.reason?.code === 'conflict').length, 1, JSON.stringify(reasons));
    return settled.findIndex(row => row.status === 'fulfilled');
  }

  let authority;
  let fixtureSetupMs=0;
  test.before(requireSafeTarget);
  test.beforeEach(async()=>{const started=Date.now();authority=await seed();fixtureSetupMs=Date.now()-started;});
  test.after(clear);

  test('simultaneous identical delivery returns one durable receipt', async () => {

    const results = await Promise.all(Array.from({ length:8 }, () => stageEvent(db, authority, orderEvent())));
    assert.equal(new Set(results.map(row => row.receiptId)).size, 1);
    const state = await durableState(authority, [orderEvent()]);
    assert.equal(state.eventCount, 1);
    assert.equal(state.versionCount, 1);
    assert.equal(state.stream.highestContiguousSequence, 1);
    assert.equal(state.operationalWrites, 0);
  });

  test('concurrent conflicting claims for the same sequence have one winner without winner assumptions', async () => {

    const events = [orderEvent(), orderEvent({ eventId:'other', sourceEntityId:'order-2', payload:{ ...orderEvent().payload, orderId:'order-2' } })];
    const trace = createTrace('pos-same-sequence-conflict',{fixtureSetupMs});
    const barrier = createReadBarrier(2, trace, 'same-sequence-first-read');
    const callers = events.map((row, index) => stageEvent(instrumentFirestoreDb(db, { trace, callerId:`sequence-${index + 1}`, beforeFirstRead:barrier }), authority, row));
    let state;
    try {
      const settled = await Promise.allSettled(callers);
      recordSettlements(trace, settled);
      const winner = oneWinner(settled);
      state = await durableState(authority, events);
      const winning = events[winner];
      const losing = events[winner === 0 ? 1 : 0];
      assert.equal(state.eventCount, 1);
      assert.deepEqual(state.eventIds, [winning.eventId]);
      assert.equal(state.versionCount, 1);
      assert.equal(state.heads.length, 1);
      assert.equal(state.heads[0].contentHash, entityContentHash(winning));
      assert.equal(state.slots['0'], eventContentHash(winning));
      assert.notEqual(state.slots['0'], eventContentHash(losing));
      assert.equal(state.stream.uniqueSequencesObserved, 1);
      assert.equal(state.stream.uniqueEventsReceived, 1);
      assert.equal(state.stream.highestContiguousSequence, 1);
      assert.equal(state.stream.conflictAttempts, 1);
      assert.equal(state.operationalWrites, 0);
    } finally {
      writeTrace(trace, state ? { eventCount:state.eventCount, versionCount:state.versionCount, eventIds:state.eventIds, stream:{ highestContiguousSequence:state.stream.highestContiguousSequence, conflictAttempts:state.stream.conflictAttempts }, slots:state.slots, operationalWrites:state.operationalWrites } : { unavailable:true });
    }
  });

  test('same entity and version with different content has one durable winner at distinct sequences', async () => {

    await stageEvent(db, authority, orderEvent());
    const basePayload = orderEvent().payload;
    const events = [
      orderEvent({ eventId:'version-a', eventType:'order.updated', sourceEntityVersion:2, sequence:2, payload:{ ...basePayload, totalCents:111 } }),
      orderEvent({ eventId:'version-b', eventType:'order.updated', sourceEntityVersion:2, sequence:3, payload:{ ...basePayload, totalCents:222 } }),
    ];
    const settled = await Promise.allSettled(events.map(row => stageEvent(db, authority, row)));
    const winner = oneWinner(settled);
    const state = await durableState(authority, events);
    const winning = events[winner];
    const losing = events[winner === 0 ? 1 : 0];
    assert.equal(state.eventCount, 2);
    assert.ok(state.eventIds.includes(winning.eventId));
    assert.ok(!state.eventIds.includes(losing.eventId));
    assert.equal(state.versionCount, 2);
    const version = state.versions.find(row => row.sourceEntityVersion === 2);
    assert.equal(version.contentHash, entityContentHash(winning));
    assert.equal(state.heads[0].contentHash, entityContentHash(winning));
    assert.equal(state.slots[String(winning.sequence - 1)], eventContentHash(winning));
    assert.equal(state.slots[String(losing.sequence - 1)], undefined);
    assert.equal(state.stream.conflictAttempts, 1);
    assert.equal(state.operationalWrites, 0);
  });

  test('legitimate new entity and version is accepted at an available sequence', async () => {

    await stageEvent(db, authority, orderEvent());
    const next = orderEvent({ eventId:'new-entity', sourceEntityId:'order-2', sequence:2, payload:{ ...orderEvent().payload, orderId:'order-2' } });
    const accepted = await stageEvent(db, authority, next);
    assert.equal(accepted.outcome, 'accepted');
    const state = await durableState(authority, [orderEvent(), next]);
    assert.equal(state.eventCount, 2);
    assert.equal(state.versionCount, 2);
    assert.equal(state.heads.length, 2);
    assert.equal(state.stream.highestContiguousSequence, 2);
    assert.equal(state.operationalWrites, 0);
  });

  test('sequence gap closure advances only with complete evidence', async () => {

    await stageEvent(db, authority, orderEvent());
    await stageEvent(db, authority, orderEvent({ eventId:'e3', eventType:'order.updated', sourceEntityVersion:3, sequence:3 }));
    let stream = (await db.collection('posBridgeScopes').doc('scope-a').collection('streams').doc('pbi-test').get()).data();
    assert.equal(stream.highestContiguousSequence, 1);
    await stageEvent(db, authority, orderEvent({ eventId:'e2', eventType:'order.updated', sourceEntityVersion:2, sequence:2 }));
    stream = (await db.collection('posBridgeScopes').doc('scope-a').collection('streams').doc('pbi-test').get()).data();
    assert.equal(stream.highestContiguousSequence, 3);
  });

  test('credential rotation and revocation serialize against event acceptance', async () => {

    const install = db.collection('posBridgeInstallations').doc('pbi-test');
    await Promise.allSettled([stageEvent(db,authority,orderEvent()),db.runTransaction(async tx=>{const snap=await tx.get(install);tx.update(install,{credentialVersion:snap.data().credentialVersion+1});})]);
    await assert.rejects(()=>stageEvent(db,authority,orderEvent({eventId:'after-rotation',sequence:2,sourceEntityVersion:2,eventType:'order.updated'})),error=>error.code==='authority_changed');
    const rotated=(await install.get()).data();const fresh={installation:rotated,claims:{posInstallationId:'pbi-test',credentialVersion:2,securityEpoch:1}};
    await Promise.allSettled([stageEvent(db,fresh,orderEvent({eventId:'during-revoke',sequence:2,sourceEntityVersion:2,eventType:'order.updated'})),db.runTransaction(async tx=>{await tx.get(install);tx.update(install,{status:'revoked',securityEpoch:2});})]);
    await assert.rejects(()=>stageEvent(db,fresh,orderEvent({eventId:'after-revoke',sequence:3,sourceEntityVersion:3,eventType:'order.updated'})),error=>error.code==='installation_inactive');
  });

  test('concurrent scope claims permit one active writer only', async () => {
    await clear();const scope=db.collection('posBridgeScopes').doc('activation-scope');
    const claim=id=>db.runTransaction(async tx=>{const snap=await tx.get(scope);const active=snap.data()?.activeInstallationId;if(active&&active!==id)throw Object.assign(new Error('writer exists'),{code:'conflict'});tx.set(scope,{active:true,locationStatus:'active',activeInstallationId:id},{merge:true});return id;});
    const settled=await Promise.allSettled([claim('writer-a'),claim('writer-b')]);
    assert.equal(settled.filter(row=>row.status==='fulfilled').length,1);assert.equal(settled.filter(row=>row.status==='rejected').length,1);
  });

  test('simultaneous bounded checkpoint continuations converge across multiple idle windows', async () => {
    const stream=db.collection('posBridgeScopes').doc('scope-a').collection('streams').doc('pbi-test');const windows=new Map();
    for(let sequence=2;sequence<=600;sequence+=1){const windowId=String(Math.floor((sequence-1)/256)).padStart(12,'0');const slots=windows.get(windowId)||{};slots[String((sequence-1)%256)]=`hash-${sequence}`;windows.set(windowId,slots);}
    for(const [windowId,slots] of windows)await stream.collection('sequenceWindows').doc(windowId).set({slots});
    await stream.set({highestSequenceObserved:600,highestContiguousSequence:0,uniqueSequencesObserved:599,uniqueEventsReceived:599,stagedEvents:599,missingSequenceCount:1,checkpointComplete:true,checkpointWorkPending:false,reconciliationStatus:'transport-gaps'});
    await stageEvent(db,authority,orderEvent());await Promise.all([summary(db,authority),summary(db,authority)]);const final=await summary(db,authority);
    assert.equal(final.highestContiguousSequence,600);assert.equal(final.checkpointComplete,true);assert.equal(final.checkpointWorkPending,false);assert.equal(final.missingSequenceCount,0);
  });

  test('concurrent late identical arrivals recover a narrowly classified closed transaction without duplicates', async () => {
    
    await stageEvent(db,authority,orderEvent());
    await stageEvent(db,authority,orderEvent({eventId:'e3',eventType:'order.updated',sourceEntityVersion:3,sequence:3}));
    const late=orderEvent({eventId:'e2',eventType:'order.updated',sourceEntityVersion:2,sequence:2});
    const trace=createTrace('pos-late-arrival-closed-transaction',{fixtureSetupMs});
    const barrier=createReadBarrier(2,trace,'late-arrival-first-read');
    let final;
    try{
      const settled=await Promise.allSettled([
        stageEvent(instrumentFirestoreDb(db,{trace,callerId:'late-a',beforeFirstRead:barrier}),authority,late),
        stageEvent(instrumentFirestoreDb(db,{trace,callerId:'late-b',beforeFirstRead:barrier}),authority,late),
      ]);
      recordSettlements(trace,settled);
      assert.equal(settled.filter(row=>row.status==='fulfilled').length,2,JSON.stringify(trace.settlements));
      assert.equal(new Set(settled.map(row=>row.value.receiptId)).size,1);
      final=await summary(db,authority);
      const state=await durableState(authority,[orderEvent(),late]);
      assert.equal(final.highestContiguousSequence,3);
      assert.equal(final.reconciliationStatus,'transport-contiguous');
      assert.equal(state.eventCount,3);
      assert.equal(state.versionCount,3);
      assert.equal(state.stream.uniqueEventsReceived,3);
      assert.equal(state.operationalWrites,0);
      traceEvent(trace,'integrity-assertions-complete');
    }finally{writeTrace(trace,final||{unavailable:true});}
  });

  test('concurrent stale create cannot resurrect a revoked mapping',async()=>{const sid=scopeId('rest-a','map-loc','map-ns');await db.collection('posBridgeScopes').doc(sid).set({restaurantId:'rest-a',locationId:'map-loc',sourceNamespaceId:'map-ns'});await db.collection('workspaceMembers').doc('member-a').set({restaurantId:'rest-a',isActive:true});const ctx={uid:'owner-a',userDocId:'owner-a',email:'owner@example.test'};const body={action:'create',expectedRevision:0,restaurantId:'rest-a',locationId:'map-loc',sourceNamespaceId:'map-ns',provider:'86-chaos-pos',entityType:'employee',externalId:'employee-1',internalEntityType:'workspaceMember',internalEntityId:'member-a'};const created=await changeMapping(db,ctx,body);const settled=await Promise.allSettled([changeMapping(db,ctx,{...body,action:'revoke',expectedRevision:created.revision}),changeMapping(db,ctx,body)]);assert.ok(settled.some(result=>result.status==='fulfilled'));const snap=await db.collection('posBridgeScopes').doc(sid).collection('mappings').doc(created.mappingKey).get();assert.equal(snap.data().status,'revoked');assert.equal(snap.data().revision,2);});
}
