'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const admin = require('firebase-admin');
const backupRoute = require('./firestore-backup.js');
const { ORDINARY_BACKUP_EXCLUSIONS } = require('./_pos-bridge-boundaries');

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_STORAGE_EMULATOR_HOST);
const normalized = value => backupRoute._test.serializeValue(value);

function assertDisposableTarget(app, runId) {
  const projectId = String(app.options.projectId || '');
  const bucket = String(app.options.storageBucket || '');
  assert.match(projectId, /^(demo|test)-/, 'recovery drill requires a demo/test project');
  assert.match(process.env.FIRESTORE_EMULATOR_HOST || '', /^(127\.0\.0\.1|localhost):\d+$/);
  assert.match(process.env.FIREBASE_STORAGE_EMULATOR_HOST || '', /^(127\.0\.0\.1|localhost):\d+$/);
  assert.equal(bucket, `${projectId}.appspot.com`);
  assert.match(runId, /^recovery_[a-f0-9]{32}$/);
  assert.notEqual(projectId, 'cheers-34b8d');
  assert.notEqual(projectId, 'chaos-test-d1601');
}

test('FIREBASE EMULATOR real production backup and restore are exact while protected security roots advance', { skip:!enabled, timeout:120000 }, async () => {
  const projectId = process.env.GCLOUD_PROJECT || 'demo-86chaos-recovery';
  const app = admin.apps.find(candidate => candidate.name === 'recovery-drill') || admin.initializeApp({ projectId, storageBucket:`${projectId}.appspot.com` }, 'recovery-drill');
  const db = app.firestore();
  const runId = `recovery_${crypto.randomUUID().replace(/-/g, '')}`;
  assertDisposableTarget(app, runId);
  const restaurantId = `${runId}_restaurant`;
  const docId = collection => `${runId}_${collection}`;
  const representative = {
    users:{email:'synthetic@example.invalid',restaurantId,isActive:true}, workspaceMembers:{restaurantId,userId:`${runId}_user`,isActive:true},
    shifts:{restaurantId,date:'2026-03-08',scheduleDateKey:'2026-03-08',revision:1}, timeOffRequests:{restaurantId,date:'2026-11-01',status:'approved'},
    inventoryItems:{restaurantId,name:'Synthetic'}, invoices:{restaurantId,totalCents:1234}, vendors:{restaurantId,name:'Synthetic Vendor'},
    sales:{restaurantId,date:'2028-02-29',netSales:100}, timePunches:{restaurantId,date:'2026-12-31',clockInTime:'2026-12-31T23:30:00-06:00'},
    tasks:{restaurantId,title:'Synthetic Task'}, messages:{restaurantId,text:'Unicode ✓, comma, "quote"\nline'}
  };
  const cleanupRefs=[];
  let storagePath='';
  try {
    for (const [collection,data] of Object.entries(representative)) {
      const ref=db.collection(collection).doc(docId(collection));
      await ref.set({...data,firestoreTypes:{timestamp:admin.firestore.Timestamp.fromDate(new Date('2026-09-18T00:00:00Z')),point:new admin.firestore.GeoPoint(44,-88)}});
      cleanupRefs.push(ref);
    }
    const restaurantRef=db.collection('restaurants').doc(restaurantId),nestedRef=restaurantRef.collection('nestedChecks').doc('n1');
    await restaurantRef.set({restaurantId,name:'Recovery Fixture'}); await nestedRef.set({restaurantId,value:'nested'}); cleanupRefs.push(nestedRef,restaurantRef);
    const protectedRefs=[db.collection('posBridgeScopes').doc(runId),db.collection('schedulePublishOperations').doc(runId),db.collection('schedulePublishLeases').doc(runId),db.collection('inventoryMutationOperations').doc(runId)];
    for(const ref of protectedRefs){await ref.set({restaurantId,securityEpoch:1,generation:1,sentinel:'before'});cleanupRefs.push(ref);}
    for(const root of protectedRefs.map(ref=>ref.parent.id))assert.ok(ORDINARY_BACKUP_EXCLUSIONS.includes(root));
    const canonical=new Map();for(const ref of cleanupRefs.filter(ref=>!protectedRefs.includes(ref)))canonical.set(ref.path,normalized((await ref.get()).data()));
    const artifact=await backupRoute._test.createBackupArtifact({adminApp:app,db,mode:'recovery-drill',runId,actor:'hostile-recovery-test',source:'FIREBASE EMULATOR',startedAt:new Date('2026-09-18T12:00:00Z')});
    storagePath=artifact.filePath;assert.equal(artifact.integrity.ok,true);for(const root of protectedRefs.map(ref=>ref.parent.id))assert.equal(Object.prototype.hasOwnProperty.call(artifact.backup.collections,root),false);
    await cleanupRefs[0].set({extraField:'damage',firestoreTypes:{bad:true}},{merge:true});await db.collection('tasks').doc(docId('tasks')).delete();for(const ref of protectedRefs)await ref.set({securityEpoch:2,generation:2,sentinel:'advanced'},{merge:true});
    const restored=await backupRoute._test.restoreBackupFromStorage({adminApp:app,db,storagePath,actor:'hostile-recovery-test'});assert.ok(restored.restoredDocumentCount>=canonical.size);
    for(const [path,expected] of canonical){const snap=await db.doc(path).get();assert.equal(snap.exists,true,path);assert.deepEqual(normalized(snap.data()),expected,path);}
    for(const ref of protectedRefs)assert.deepEqual((({securityEpoch,generation,sentinel})=>({securityEpoch,generation,sentinel}))((await ref.get()).data()),{securityEpoch:2,generation:2,sentinel:'advanced'});
  } finally {
    assertDisposableTarget(app,runId);
    for(const ref of cleanupRefs.reverse())await ref.delete().catch(()=>null);
    await db.recursiveDelete(db.collection('system').doc('backupStatus')).catch(()=>null);
    if(storagePath)await app.storage().bucket().file(storagePath).delete().catch(()=>null);
  }
});
