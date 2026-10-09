'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { approveInvoice } = require('../api/_invoice-approval');
const { recipeCosting } = require('../api/_recipe-costing');
const { saveForecastDraft } = require('../src/core/intelligenceConnections.cjs');
const {importDemandRows,readDemandRows}=require('../api/_item-demand-history');

test('actual Firestore transactions preserve approval, retry, recipe links and forecast draft idempotency',async()=>{
  assert.match(process.env.FIRESTORE_EMULATOR_HOST || '',/^127\.0\.0\.1:\d+$/,'Loopback emulator required');
  assert.equal(process.env.GCLOUD_PROJECT,'demo-86chaos-intelligence','Demo project required');
  const app=initializeApp({projectId:'demo-86chaos-intelligence'},`intelligence-${Date.now()}`);
  const db=getFirestore(app);db.settings({preferRest:false});
  const ctx={restaurantId:'r1',uid:'owner',user:{name:'Owner'}};
  try {
    await db.doc('inventoryItems/flour').set({restaurantId:'r1',name:'Flour',inventoryUnit:'lb',packSize:'1/10 LB',price:1,currentStock:1});
    await db.doc('recipes/dough').set({restaurantId:'r1',title:'Dough'});
    const invoice={invoiceNumber:'intelligence-85',invoiceDate:'2026-10-08',vendorName:'Vendor',lineItems:[{itemName:'Flour',matchedItemId:'flour',shippedQty:0.5,uom:'CS',packSize:'1/10 LB',totalPrice:10}]};
    const result=await approveInvoice({db,ctx,invoice,approved:true});
    assert.equal(result.duplicate,false);assert.equal((await db.doc('inventoryItems/flour').get()).data().currentStock,6);
    assert.equal((await approveInvoice({db,ctx,invoice,approved:true})).duplicate,true);
    assert.equal((await db.doc('inventoryItems/flour').get()).data().currentStock,6);
    assert.equal((await db.doc('inventoryItems/flour').get()).data().latestCost,2);
    await recipeCosting({db,ctx,body:{action:'recipe-costing-approve',approved:true,recipeId:'dough',yieldQuantity:5,yieldUnit:'lb',yieldPercent:80,rows:[{inventoryItemId:'flour',batchQuantity:2,batchUnit:'lb'}]}});
    const recipe=(await db.doc('recipes/dough').get()).data();assert.equal(recipe.costingDependencyIds.length,1);
    assert.equal((await db.doc(`menuDependencies/${recipe.costingDependencyIds[0]}`).get()).data().status,'approved');
    await assert.rejects(approveInvoice({db,ctx,approved:true,invoice:{...invoice,invoiceNumber:'bad-row',lineItems:[...invoice.lineItems,{...invoice.lineItems[0],matchedItemId:'missing'}]}}));
    assert.equal((await db.doc('inventoryItems/flour').get()).data().currentStock,6);
    await assert.rejects(approveInvoice({db,ctx:{...ctx,restaurantId:'r2'},approved:true,invoice}));
    const ref=db.doc('shifts/forecast-slot');
    const transact=callback=>db.runTransaction(tx=>callback({get:async target=>{const snap=await tx.get(target);return {exists:()=>snap.exists,data:()=>snap.data()};},set:(target,payload)=>tx.set(target,payload)}));
    assert.equal((await saveForecastDraft({transact,ref,payload:{restaurantId:'r1',isPublished:false}})).created,true);
    await ref.update({isPublished:true});assert.equal((await saveForecastDraft({transact,ref,payload:{restaurantId:'r1',isPublished:false}})).created,false);
    assert.equal((await ref.get()).data().isPublished,true);
    await db.doc('recipes/pizza').set({restaurantId:'r1',title:'Pizza'});
    const demandCtx={...ctx,user:{isOwner:true}};
    const row={businessDate:'2026-10-01',recipeId:'pizza',quantity:5,sourceId:'receipt',lineId:'one'};
    const importRows=rows=>importDemandRows({db,ctx:demandCtx,rows,approved:true,currentDate:'2026-10-08'});
    assert.equal((await importRows([row])).imported,1);
    assert.equal((await importRows([row])).duplicates,1);
    await assert.rejects(importRows([{...row,businessDate:'2026-10-02'}]),error=>error.statusCode===409);
    const history=await readDemandRows({db,ctx:demandCtx,currentDate:'2026-10-08'});
    assert.equal(history.complete,true);assert.equal(history.data.length,1);assert.equal(history.data[0].lineItems[0].quantity,5);
    assert.equal((await db.doc('inventoryItems/flour').get()).data().currentStock,6);
    await assert.rejects(readDemandRows({db,ctx:{...ctx,user:{},permissions:{team:true}},currentDate:'2026-10-08'}));
  } finally { await deleteApp(app); }
});
