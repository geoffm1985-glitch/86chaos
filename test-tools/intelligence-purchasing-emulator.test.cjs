'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { approveInvoice } = require('../api/_invoice-approval');
const { recipeCosting } = require('../api/_recipe-costing');
const { saveForecastDraft } = require('../src/core/intelligenceConnections.cjs');
const {importDemandRows,readDemandRows}=require('../api/_item-demand-history');
const {reconcilePurchaseLine}=require('../src/core/purchaseReconciliation.cjs');
const {buildRestaurantKnowledgeGraph}=require('../src/core/restaurantKnowledgeGraph.cjs');
const {buildGraphMenuRows}=require('../src/core/operationalEvidence.cjs');
const {operationalReview,catalogEvidence}=require('../api/_operational-review');
const {readOperationalHistoryPage}=require('../api/_operational-history');
const loadRestaurantModel=require('./load-restaurant-model.cjs');
const {getBatchRecipeCost,buildMenuCostBreakdowns}=loadRestaurantModel('menuCosting');
const {buildAiOrderAssistant}=loadRestaurantModel('aiOrderAssistant');

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

test('real PO/partial receiving approval propagates through costing, menu/86 and order suggestions exactly once',async(t)=>{
  // Approval stamps and the history window must share the fixture's business day.
  t.mock.timers.enable({apis:['Date'],now:Date.UTC(2026,9,9,12)});
  assert.match(process.env.FIRESTORE_EMULATOR_HOST || '',/^127\.0\.0\.1:\d+$/);assert.equal(process.env.GCLOUD_PROJECT,'demo-86chaos-intelligence');
  const app=initializeApp({projectId:'demo-86chaos-intelligence'},`purchasing-86-${Date.now()}`),db=getFirestore(app);
  const ctx={restaurantId:'workflow86',uid:'owner86',user:{isOwner:true}},today='2026-10-09';
  const readModel=async()=>{
    const result={};for(const collection of ['inventoryItems','recipes','menuDependencies']){const snap=await db.collection(collection).where('restaurantId','==',ctx.restaurantId).get();result[collection]=snap.docs.map(doc=>({id:doc.id,...doc.data()}));}return result;
  };
  try {
    await db.doc('inventoryItems/flow86-flour').set({restaurantId:ctx.restaurantId,name:'Flour',currentStock:0,parLevel:5,latestCost:1,price:1,inventoryUnit:'lb',packSize:'1/10 LB',category:'Dry',allergens:['wheat']});
    await db.doc('recipes/flow86-dough').set({restaurantId:ctx.restaurantId,title:'Dough'});
    await db.doc('vendors/flow86-vendor').set({restaurantId:ctx.restaurantId,name:'Vendor'});
    const po={restaurantId:ctx.restaurantId,status:'ordered',items:[{inventoryItemId:'flow86-flour',quantity:2,unit:'CS'}]};await db.doc('orders/flow86-po').set(po);
    await recipeCosting({db,ctx,body:{action:'recipe-costing-approve',approved:true,recipeId:'flow86-dough',yieldQuantity:5,yieldUnit:'lb',yieldPercent:80,rows:[{inventoryItemId:'flow86-flour',batchQuantity:2,batchUnit:'lb'}]}});
    await db.doc('menuDependencies/flow86-pizza').set({restaurantId:ctx.restaurantId,menuItemName:'Pizza',menuItemPrice:10,batchRecipeId:'flow86-dough',estimatedQuantity:8,estimatedUnit:'oz',status:'approved'});
    const before=await readModel(),menuBefore=buildMenuCostBreakdowns(before)[0];assert.equal(menuBefore.totalCost,0.25);
    const orderBefore=buildAiOrderAssistant({...before,currentDate:today});assert.equal(orderBefore.recommendations.find(row=>row.itemId==='flow86-flour').suggestedQty,5);
    const beforeGraph=buildRestaurantKnowledgeGraph({workspaceId:ctx.restaurantId,...before,menuItems:buildGraphMenuRows({workspaceId:ctx.restaurantId,dependencies:before.menuDependencies,recipes:before.recipes})});assert.equal(beforeGraph.impacts.find(row=>row.menuName==='Pizza').stock86Impact,'high');
    const discrepancy=reconcilePurchaseLine({workspaceId:ctx.restaurantId,ordered:{quantity:2,unit:'case'},shipped:{quantity:0.5,unit:'case'},received:{quantity:0.5,unit:'case',backorderQuantity:1.5},invoiced:{quantity:0.5,unit:'case'}});assert.equal(discrepancy.reviewRequired,true);
    const invoice={invoiceNumber:'flow86-invoice',invoiceDate:today,vendorId:'flow86-vendor',vendorName:'Vendor',purchaseOrderId:'flow86-po',lineItems:[{itemName:'Flour',productCode:'FLOUR86',matchedItemId:'flow86-flour',shippedQty:0.5,orderedQty:2,backOrderedQty:1.5,uom:'CS',packSize:'1/10 LB',totalPrice:10}]};
    await assert.rejects(approveInvoice({db,ctx,invoice,approved:false}));assert.equal((await db.doc('inventoryItems/flow86-flour').get()).data().currentStock,0);
    const approved=await approveInvoice({db,ctx,invoice,approved:true}),after=await readModel();assert.equal(approved.duplicate,false);assert.equal(after.inventoryItems[0].currentStock,5);assert.equal(after.inventoryItems[0].latestCost,2);
    const recipe=after.recipes.find(row=>row.id==='flow86-dough'),batch=getBatchRecipeCost({...after,recipe});assert.equal(batch.totalCost,4);assert.equal(batch.unitCost,1);
    const menu=buildMenuCostBreakdowns(after)[0];assert.equal(menu.totalCost,0.5);assert.equal(menu.grossProfit,9.5);assert.equal(menu.foodCostPct,5);
    const graph=buildRestaurantKnowledgeGraph({workspaceId:ctx.restaurantId,...after,menuItems:buildGraphMenuRows({workspaceId:ctx.restaurantId,dependencies:after.menuDependencies,recipes:after.recipes})});assert.equal(graph.impacts.find(row=>row.menuName==='Pizza').stock86Impact,'watch');
    const orderAfter=buildAiOrderAssistant({...after,currentDate:today});assert.ok(!orderAfter.recommendations.some(row=>row.itemId==='flow86-flour' && row.suggestedQty>0));
    assert.equal((await approveInvoice({db,ctx,invoice,approved:true})).duplicate,true);assert.equal((await db.doc('inventoryItems/flow86-flour').get()).data().currentStock,5);assert.deepEqual((await db.doc('orders/flow86-po').get()).data(),po);
    await operationalReview({db,ctx,body:{action:'vendor-catalog-import',vendorId:'flow86-vendor',approved:true,rows:[{sku:'FLOUR86',name:'Flour',packSize:'1/10 LB',purchaseUnit:'CS',unitPrice:20,sourceUrl:'https://vendor.example/catalog/flour'}]}});
    assert.equal((await catalogEvidence({db,restaurantId:ctx.restaurantId,vendorId:'flow86-vendor',code:'FLOUR86'}))[0].unitPriceCents,2000);
    const history=await readOperationalHistoryPage({db,ctx,source:'invoices',currentDate:today});assert.equal(history.complete,true);assert.equal(history.data[0].lineItems[0].approvedStockQuantity,5);
    const conversion={servingsPerBatch:8,yieldQuantity:recipe.batchYieldQuantity,yieldPercent:recipe.batchYieldPercent,yieldUnit:recipe.batchYieldUnit,costingApprovedAt:recipe.costingApprovedAt,reviewed:true};
    const demand={businessDate:'2026-10-02',recipeId:recipe.id,quantity:8,sourceId:'reviewed-sale',lineId:'one',servingConversion:conversion};assert.equal((await importDemandRows({db,ctx,approved:true,currentDate:today,rows:[demand]})).imported,1);
    assert.equal((await importDemandRows({db,ctx,approved:true,currentDate:today,rows:[demand]})).duplicates,1);
    assert.equal((await db.doc('inventoryItems/flow86-flour').get()).data().currentStock,5);
  }finally{await deleteApp(app);}
});
