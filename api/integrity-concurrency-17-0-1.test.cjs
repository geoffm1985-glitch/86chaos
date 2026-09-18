'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const admin=require('firebase-admin');const {saveDailyClose}=require('./_daily-close-service.cjs');const {mutateWaste}=require('./safe-write.js')._test;const {createTrace,event,createReadBarrier,instrumentFirestoreDb,recordSettlements,writeTrace}=require('../test-tools/firestore-emulator-trace.cjs');
if(!process.env.FIRESTORE_EMULATOR_HOST){test('integrity concurrency requires Firestore emulator',{skip:'FIREBASE EMULATOR fidelity required'},()=>{});}else{
  const projectId=process.env.GCLOUD_PROJECT||'demo-schedule-publish';if(!/^demo-|^test-/.test(projectId))throw new Error('Concurrency tests refuse a non-demo Firebase project.');const app=admin.apps.find(row=>row.name==='integrity-concurrency')||admin.initializeApp({projectId},'integrity-concurrency'),db=app.firestore(),collections=['sales','inventoryItems','wasteLogs','inventoryMutationOperations'];
  async function clear(){for(const name of collections){const snap=await db.collection(name).get();await Promise.all(snap.docs.map(doc=>db.recursiveDelete(doc.ref)));}}test.beforeEach(clear);test.after(clear);
  test('FIREBASE EMULATOR simultaneous first Daily Close saves converge; stale edit fails; lost ACK retry is idempotent',async()=>{
    const trace=createTrace('daily-close-deterministic-concurrency',{fixtureSetupMs:0});
    const barrier=createReadBarrier(2,trace,'daily-close-first-transaction-read');
    const bodies=[
      {restaurantId:'rest',date:'2026-09-18',operationId:'daily_operation_aaaaaaaa',expectedRevision:0,expectedUpdatedAt:'',data:{grossSales:100,winnerMarker:'a'}},
      {restaurantId:'rest',date:'2026-09-18',operationId:'daily_operation_bbbbbbbb',expectedRevision:0,expectedUpdatedAt:'',data:{grossSales:200,winnerMarker:'b'}},
    ];
    let finalState={unavailable:true};
    try{
      const operationStarted=Date.now();
      const settled=await Promise.allSettled(bodies.map((body,index)=>saveDailyClose({db:instrumentFirestoreDb(db,{trace,callerId:`daily-close-${index+1}`,beforeFirstRead:barrier}),ctx:{uid:index===0?'actor-a':'actor-b'},body})));
      trace.firstSaveOperationWallTimeMs=Date.now()-operationStarted;
      recordSettlements(trace,settled);
      assert.equal(settled.filter(row=>row.status==='fulfilled').length,1,JSON.stringify(trace.settlements));
      assert.equal(settled.filter(row=>row.status==='rejected'&&row.reason?.code==='stale_daily_close').length,1,JSON.stringify(trace.settlements));
      const winnerIndex=settled.findIndex(row=>row.status==='fulfilled');
      const snap=await db.collection('sales').where('restaurantId','==','rest').where('date','==','2026-09-18').get();
      assert.equal(snap.size,1);
      const winnerBody=bodies[winnerIndex],row=snap.docs[0].data();
      assert.equal(row.updatedBy,winnerIndex===0?'actor-a':'actor-b');
      assert.equal(row.grossSales,winnerBody.data.grossSales);
      assert.equal(row.winnerMarker,winnerBody.data.winnerMarker);
      assert.equal(row.revision,1);

      const staleSnapshot=structuredClone(row);
      await assert.rejects(()=>saveDailyClose({db,ctx:{uid:'stale-actor'},body:{restaurantId:'rest',date:'2026-09-18',operationId:'daily_operation_stale_1',expectedRevision:0,expectedUpdatedAt:'',data:{grossSales:999,winnerMarker:'stale'}}}),error=>error.code==='stale_daily_close');
      const afterStale=(await snap.docs[0].ref.get()).data();
      assert.equal(afterStale.grossSales,staleSnapshot.grossSales);
      assert.equal(afterStale.revision,staleSnapshot.revision);

      const operationId='daily_operation_retry_123';
      let acknowledgementLost=false;
      const lostAckDb=Object.create(db);lostAckDb.collection=db.collection.bind(db);lostAckDb.runTransaction=async callback=>{const result=await db.runTransaction(callback);if(!acknowledgementLost){acknowledgementLost=true;throw Object.assign(new Error('simulated acknowledgement loss after commit'),{code:'transport_unknown'});}return result;};
      const updateBody={restaurantId:'rest',date:'2026-09-18',operationId,expectedRevision:staleSnapshot.revision,expectedUpdatedAt:staleSnapshot.updatedAt,data:{grossSales:250,winnerMarker:'ack-loss'}};
      await assert.rejects(()=>saveDailyClose({db:lostAckDb,ctx:{uid:'actor-retry'},body:updateBody}),error=>error.code==='transport_unknown');
      const committedAfterLostAck=(await snap.docs[0].ref.get()).data();
      assert.equal(committedAfterLostAck.revision,staleSnapshot.revision+1);
      assert.equal(committedAfterLostAck.grossSales,250);
      const retry=await saveDailyClose({db,ctx:{uid:'actor-retry'},body:updateBody});
      assert.equal(retry.status,'idempotent');
      assert.equal(retry.revision,committedAfterLostAck.revision);
      const finalSnap=await db.collection('sales').where('restaurantId','==','rest').where('date','==','2026-09-18').get();
      assert.equal(finalSnap.size,1);
      const final=finalSnap.docs[0].data();
      assert.equal(final.revision,committedAfterLostAck.revision);
      assert.equal(final.grossSales,250);
      assert.equal(final.winnerMarker,'ack-loss');
      finalState={documentCount:finalSnap.size,revision:final.revision,grossSales:final.grossSales,winnerMarker:final.winnerMarker,firstSaveWinner:winnerIndex};
      event(trace,'integrity-assertions-complete');
    }finally{writeTrace(trace,finalState);}
  });
  test('FIREBASE EMULATOR simultaneous waste deductions both commit and duplicate operation cannot double-decrement',async()=>{await db.collection('inventoryItems').doc('item').set({restaurantId:'rest',currentStock:10,revision:1});const make=(operationId,stockDeducted)=>mutateWaste(db,{action:'waste-create',restaurantId:'rest',body:{operationId,data:{itemId:'item',itemName:'Synthetic',stockDeducted,restaurantId:'rest'}},actor:'manager',nowIso:new Date().toISOString()});const [a,b]=await Promise.all([make('waste_operation_aaaaaaaa',1),make('waste_operation_bbbbbbbb',2)]);assert.equal(a.status,'committed');assert.equal(b.status,'committed');assert.equal((await db.collection('inventoryItems').doc('item').get()).data().currentStock,7);const retry=await make('waste_operation_aaaaaaaa',1);assert.equal(retry.status,'idempotent');assert.equal((await db.collection('inventoryItems').doc('item').get()).data().currentStock,7);assert.equal((await db.collection('wasteLogs').get()).size,2);});
}
