const { test } = require('node:test'); const assert = require('node:assert/strict');
const pack = require('../src/core/restaurantPack.cjs'); const memory = require('../src/core/vendorProductMemory.cjs');
const { vendorMemory } = require('./_vendor-memory'); const { approveInvoice } = require('./_invoice-approval'); const { recipeCosting } = require('./_recipe-costing');
const { foodSafety } = require('./_food-safety'); const food = require('../src/core/foodSafety.cjs'); const pos = require('../src/core/posNormalization.cjs');
const { suggestMenuIngredient } = require('../src/core/menuLanguage.cjs'); const { normalizeLabelSettings } = require('../src/core/labelPresets.cjs');
const { fakeFirestore } = require('../test-tools/fakeFirestore.cjs'); const { presenceDiagnostic, withPresenceTimeout } = require('./_presence-diagnostics.cjs');
const { safeProductQuery, researchProduct } = require('./free-ai-services').__test;
for (const [value, amount, unit] of [['4/10 LB',40,'lb'],['2/5 LB',10,'lb'],['6/64 OZ',384,'oz'],['12/8 OZ',96,'oz'],['24 CT',24,'each'],['1 CS',1,'case'],['1 CASE',1,'case'],['1 EA',1,'each'],['1 BAG',1,'bag'],['1 PK',1,'pack'],['.5 CS',0.5,'case'],['6 x 64 FL OZ',384,'fl oz']]) test(`case-pack ${value}`, () => { const result = pack.parseCasePack(value); assert.equal(result.known,true); assert.equal(result.amount,amount); assert.equal(result.unit,unit); });
for (const value of ['', '4//10 LB', '4/0 LB', '4/-10 LB', '4/10', '4/10 KZ', '4-10 LB', '2 PC CW', '40 LB APPROX', '4/10 LB?']) test(`malformed or uncertain pack ${value || '(missing)'}`, () => { const result = pack.parseCasePack(value); assert.equal(result.known,false); assert.equal(result.amount,null); });
test('partial receipts, backorders, weight units, and yield stay explicit', () => {
  const row = { orderedQty: 3, shippedQty: 0.5, backOrderedQty: 2.5, quantity: 3, uom: 'CS', packSize: '4/10 LB', totalPrice: 60 };
  const result = pack.resolveInvoiceQuantity(row, { inventoryUnit: 'lb', packSize: '4/10 LB' }); assert.equal(result.stockQuantity,20); assert.equal(result.stockUnitCost,3); assert.equal(result.needsReview,false);
  assert.equal(pack.resolveInvoiceQuantity({ orderedQty: 3, uom:'CS', packSize:'4/10 LB', unitPrice:120 }).needsReview,true);
  assert.equal(pack.resolveInvoiceQuantity({ ...row, receivedQty: 0, totalPrice: 0 }).stockQuantity,0);
  assert.equal(pack.convertQuantity(1,'oz','fl oz'),null); assert.equal(pack.usableYield(100,80),80); assert.equal(pack.usableYield(100,0),null);
});
test('catch weight, pack conflicts, and substitutions require explicit review', () => {
  const row = { quantity:1, uom:'CS', packSize:'4/10 LB', unitPrice:80 };
  for (const patch of [{ isCatchWeight:true }, { substitution:true }, { packSize:'2/5 LB' }]) assert.equal(pack.resolveInvoiceQuantity({ ...row, ...patch }, { packSize:'4/10 LB' }).needsReview,true);
});
const ctx = { restaurantId:'a', uid:'manager', user:{ isAdmin:true, name:'Manager' }, permissions:{} };
const inventory = { id:'wings', restaurantId:'a', name:'Chicken Wings', supplierId:'v', inventoryUnit:'case', packSize:'4/10 LB', price:80 };
const invoiceRow = { itemName:'CK522 CHIX WNG', productCode:'CK522', quantity:1, uom:'CS', packSize:'4/10 LB', unitPrice:80 };
const mapping = memory.buildApprovedMapping({ restaurantId:'a', vendorId:'v', vendorName:'Vendor', row:invoiceRow, inventoryItem:inventory, approvedBy:'manager', approvedAt:'2026-09-08T12:00:00Z' });
test('learned mappings remain vendor/workspace scoped and explain conflicts', () => {
  const good = memory.suggestInvoiceMatch(invoiceRow,[inventory],[mapping],{restaurantId:'a',vendorId:'v'}); assert.equal(good.matchedItemId,'wings'); assert.match(good.explanation,/previously approved/);
  assert.equal(memory.suggestInvoiceMatch(invoiceRow,[inventory],[mapping],{restaurantId:'b',vendorId:'v'}).matchedItemId,'');
  const changed = memory.suggestInvoiceMatch({...invoiceRow,packSize:'2/5 LB'},[inventory],[mapping],{restaurantId:'a',vendorId:'v'}); assert.equal(changed.needsReview,true); assert.match(changed.explanation,/different package|conflicts/);
  assert.equal(memory.suggestInvoiceMatch(invoiceRow,[inventory],[{...mapping,active:false,state:'revoked'}],{restaurantId:'a',vendorId:'v'}).matchedItemId,'');
});
test('mapping correction/revocation is auditable, optimistic, and idempotent', async () => {
  const db=fakeFirestore({'vendors/v':{restaurantId:'a',name:'Vendor'},'vendors/v/productMappings/m':mapping,'inventoryItems/wings':inventory});
  const body={action:'vendor-memory-revoke',vendorId:'v',mappingId:'m',expectedApprovedAt:mapping.approvedAt}; await vendorMemory({db,ctx,body}); const count=db.writes.length;
  assert.equal(db.records.get('vendors/v/productMappings/m').active,false); assert.equal((await vendorMemory({db,ctx,body})).noOp,true); assert.equal(db.writes.length,count);
  await assert.rejects(vendorMemory({db,ctx:{...ctx,restaurantId:'b'},body}),/workspace/);
  await assert.rejects(vendorMemory({db,ctx,body:{...body,action:'vendor-memory-edit',expectedApprovedAt:'stale',inventoryItemId:'wings',packSize:'4/10 LB'}}),/changed/);
  const repaired=await vendorMemory({db,ctx,body:{...body,action:'vendor-memory-edit',inventoryItemId:'wings',packSize:'4/10 LB'}}); assert.equal(repaired.mapping.active,true);
});
test('approval rechecks learned conflicts even if client hides the review flag', async () => {
  const { mappingId }=require('./_invoice-approval'); const row={...invoiceRow,packSize:'2/5 LB',matchedItemId:'wings'};
  const db=fakeFirestore({'vendors/v':{restaurantId:'a',name:'Vendor'},[`vendors/v/productMappings/${mappingId(row)}`]:mapping,'inventoryItems/wings':{...inventory,packSize:'2/5 LB'}});
  await assert.rejects(approveInvoice({db,ctx,approved:true,invoice:{vendorId:'v',vendorName:'Vendor',invoiceNumber:'changed',lineItems:[row]}}),/package/); assert.equal(db.writes.length,0);
});
test('new items never manufacture a count yield and duplicate SKUs cannot learn conflicting items', async () => {
  const db=fakeFirestore({'vendors/v':{restaurantId:'a',name:'Vendor'}});
  await approveInvoice({db,ctx,approved:true,invoice:{vendorId:'v',vendorName:'Vendor',invoiceNumber:'unknown-yield',lineItems:[{...invoiceRow,matchedItemId:'CREATE_NEW',packSize:'1 CS'}]}});
  const created=[...db.records.entries()].find(([key])=>key.startsWith('inventoryItems/'))[1];
  assert.equal(created.yieldQty,0);
  const db2=fakeFirestore({'vendors/v':{restaurantId:'a',name:'Vendor'},'inventoryItems/wings':inventory,'inventoryItems/other':{...inventory,id:'other'}});
  await assert.rejects(approveInvoice({db:db2,ctx,approved:true,invoice:{vendorId:'v',vendorName:'Vendor',invoiceNumber:'duplicate-sku',lineItems:[{...invoiceRow,matchedItemId:'wings'},{...invoiceRow,matchedItemId:'other'}]}}),/conflicting matches/);
  assert.equal(db2.writes.length,0);
});
test('batch approval cannot delete another workspace dependency through a poisoned recipe reference', async () => {
  const db=fakeFirestore({'recipes/r':{restaurantId:'a',costingDependencyIds:['foreign']},'menuDependencies/foreign':{restaurantId:'b',recipeId:'r',source:'approved_batch_recipe'},'inventoryItems/wings':inventory});
  await assert.rejects(recipeCosting({db,ctx,body:{action:'recipe-costing-approve',approved:true,recipeId:'r',yieldQuantity:10,yieldPercent:100,yieldUnit:'oz',rows:[{inventoryItemId:'wings',batchQuantity:10,batchUnit:'oz'}]}}),/workspace/); assert.equal(db.writes.length,0);
});
test('research checks workspace memory first, stays review-only, and writes no product data', async () => {
  const {mappingId}=require('./_invoice-approval'); const db=fakeFirestore({'vendors/v':{restaurantId:'a',name:'Vendor'},[`vendors/v/productMappings/${mappingId(invoiceRow)}`]:mapping});
  const result=await researchProduct({needsReview:true,productName:'CHIX WNG',productCode:'CK522',vendorId:'v'},{db,restaurantId:'a'},{uid:'manager'});
  assert.equal(result.reviewOnly,true); assert.equal(result.approvalRequired,true); assert.equal(result.confidence,'low'); assert.equal(db.writes.length,0); assert.equal(result.provider,'Workspace vendor memory');
  assert.throws(()=>safeProductQuery({productName:'Customer 12345 12 Main Street'})); await assert.rejects(researchProduct({needsReview:false},{db,restaurantId:'a'},{uid:'u'}),/Needs Review/);
});
test('restaurant aliases outrank generic wording and ambiguous products stay in review', () => {
  assert.equal(suggestMenuIngredient('burger',[{id:'beef',name:'Beef patty'}]).id,'beef');
  assert.equal(suggestMenuIngredient('chicken sandwich',[{id:'breast',name:'Chicken breast',aliases:['chicken sandwich']}]).id,'breast');
  assert.equal(suggestMenuIngredient('ranch',[{id:'ranch',name:'House ranch'},{id:'boom',name:'Boom boom sauce'}]).id,'ranch');
  assert.equal(suggestMenuIngredient('ranch',[{id:'r',name:'House ranch'},{id:'b',name:'Batch ranch'}]).matchConfidence,'needs review');
});
test('stale and missing menu dependency reviews are visible without additional reads', () => {
  const { menuScanReviewReason }=require('../src/core/menuApproval.cjs'); const now=Date.parse('2026-09-09');
  assert.match(menuScanReviewReason({dependencyCount:0},now),/No approved/);
  assert.match(menuScanReviewReason({dependencyCount:2,approvedAt:'2026-01-01'},now),/90 days/);
  assert.equal(menuScanReviewReason({dependencyCount:2,updatedAt:'2026-09-01'},now),'');
});
test('food safety validates ranges, cooling evidence, zero/freezer values, and missed checks', () => {
  assert.equal(food.evaluateFoodSafety({category:'Freezer temperature',requiredMax:0},{temp:0}).result,'pass');
  assert.throws(()=>food.evaluateFoodSafety({category:'Cold Holding (≤ 41°F)'},{temp:50}),/corrective action/);
  assert.throws(()=>food.evaluateFoodSafety({category:'Cooling checkpoint'},{temp:60}),/start time/);
  assert.throws(()=>food.expectation({category:'Equipment temperature',requiredMin:50,requiredMax:30}),/Minimum/);
  assert.equal(food.missedFoodSafetyChecks([{id:'c',requiredEveryHours:2}],[],Date.now()).length,1);
});
test('food logs are tenant-safe, server-stamped, idempotent, and manager sign-off is protected', async () => {
  const db=fakeFirestore({'lineCheckItems/c':{restaurantId:'a',name:'Cooler',category:'Cooler temperature'}}); const staff={...ctx,user:{name:'Cook'},permissions:{prep:true}};
  const body={action:'food-safety-log',itemId:'c',requestId:'request-one',temp:50,correctiveAction:'Moved food; notified manager.'};
  const log=await foodSafety({db,ctx:staff,body}); assert.equal(log.result,'attention'); const count=db.writes.length;
  assert.equal((await foodSafety({db,ctx:staff,body})).duplicate,true); assert.equal(db.writes.length,count);
  await assert.rejects(foodSafety({db,ctx:staff,body:{action:'food-safety-signoff',logId:log.id,note:'Verified'}}),/Manager/);
  await foodSafety({db,ctx,body:{action:'food-safety-signoff',logId:log.id,note:'Verified corrective action.'}}); assert.equal(db.records.get(`tempLogs/${log.id}`).reviewedBy,'manager');
  await assert.rejects(foodSafety({db,ctx:{...staff,restaurantId:'b'},body:{...body,requestId:'foreign'}}),/workspace/);
});
test('POS CSV preserves item/category/daily identities, explicit mapping, tax, tips, labor, and deposit drafts', () => {
  const parsed=pos.parsePosCsv('recordType,date,posId,menuItemName,quantity,netSales,salesTax,tipsPaidOut,depositAmount,laborCost\ndaily,2026-09-08,day,,,1000,60,90,700,200\nitem,2026-09-08,42,"Wings, large",10,150,,,,');
  const draft=pos.normalizePosImport({...parsed,restaurantId:'a',provider:'CSV'}); assert.equal(draft.records[0].laborPercent,20); assert.equal(draft.records[0].salesTax,60); assert.equal(draft.records[1].quantity,10); assert.equal(draft.records[1].mappingNeedsReview,true); assert.equal(draft.approvalRequired,true);
  assert.throws(()=>pos.normalizePosImport({rows:[...parsed.rows,parsed.rows[0]],restaurantId:'a'}),/duplicate/); assert.throws(()=>pos.parsePosCsv('a,b\n"unclosed,1'),/unterminated/);
});
test('label presets bound calibration while keeping the reliable default', () => assert.deepEqual(normalizeLabelSettings({preset:'unknown',offsetX:100,offsetY:-100}),{preset:'legacy',offsetX:5,offsetY:-5}));
test('presence diagnostics distinguish a missing instance from timeout without changing configuration', async () => {
  const app={options:{projectId:'testing-project',databaseURL:'https://example.invalid'}}; assert.equal(presenceDiagnostic(app,new Error('RTDB REST 404'),'fallback').code,'RTDB_INSTANCE_NOT_FOUND');
  assert.equal(await withPresenceTimeout(Promise.resolve('ok'),1000,'test'),'ok'); await assert.rejects(withPresenceTimeout(new Promise(()=>{}),5,'test'),{code:'PRESENCE_TIMEOUT'});
});
test('QuickBooks preserves draft credits and requires explicit account mapping', () => {
  const {normalizeDraft}=require('./quickbooks-bill-draft'); const draft=normalizeDraft({draftType:'VendorCredit',vendorName:'Vendor',vendorId:'v',lines:[{description:'Returned wings',amount:20}]});
  assert.equal(draft.draftType,'VendorCredit'); assert.equal(draft.quickBooksShape.entity,'VendorCredit'); assert(draft.validationIssues.some(issue=>/account/.test(issue))); assert.equal(draft.ownerApprovalRequired,true); assert.equal(draft.sendStatus,'not_sent');
});
