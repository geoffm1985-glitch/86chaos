'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildFoodSafetyEvidence,evidenceQuality,reviewedServingConversion,buildGraphMenuRows,buildTrainingFollowUp}=require('../src/core/operationalEvidence.cjs');
const {buildRestaurantReadiness}=require('../src/core/restaurantReadiness.cjs');
const {buildNeedsAttention}=require('../src/core/needsAttention.cjs');
const {buildRestaurantKnowledgeGraph}=require('../src/core/restaurantKnowledgeGraph.cjs');
const {buildClockAwareness,normalizeItemSalesHistory}=require('../src/core/intelligenceConnections.cjs');
const {zonedAttendanceTime}=require('../src/core/attendanceEvidence.cjs');
const {buildSmartPrepRecommendations}=require('../src/core/smartPrepIntelligence.cjs');
const {readOperationalHistoryPage,historySourceAllowed,projectHistoryRow}=require('./_operational-history');
const {operationalReview,catalogEvidence,validateCatalogRow}=require('./_operational-review');
const {importDemandRows}=require('./_item-demand-history');
const verified={resolved:true,data:[]},owner={restaurantId:'r1',uid:'owner',user:{isOwner:true},permissions:{}};
const actor={restaurantId:'r1',id:'owner',isOwner:true};
const now='2026-10-09T18:00:00Z';

function memoryDb(initial={}) {
  const records=new Map(Object.entries(initial)),writes=[];
  const snapshot=path=>({id:path.split('/').at(-1),ref:doc(path),exists:records.has(path),data:()=>records.get(path)});
  const doc=path=>({path,id:path.split('/').at(-1),get:async()=>snapshot(path),collection:name=>collection(`${path}/${name}`)});
  let sequence=0;
  function collection(path) {
    const filters=[];let cursor='',count=Infinity;
    const query={doc:id=>doc(`${path}/${id || `audit-${sequence++}`}`),where(field,op,value){filters.push([field,op,value]);return query;},orderBy(){return query;},limit(value){count=value;return query;},startAfter(value){cursor=typeof value==='string'?value:value.id;return query;},async get(){const docs=[...records].filter(([key,row])=>key.startsWith(`${path}/`) && !key.slice(path.length+1).includes('/') && key.split('/').at(-1)>cursor && filters.every(([field,op,value])=>op==='=='?row[field]===value:op==='>='?row[field]>=value:op==='<'?row[field]<value:true)).sort(([a],[b])=>a.localeCompare(b)).slice(0,count).map(([key])=>snapshot(key));return {docs};}};
    return query;
  }
  const db={records,writes,doc,collection,runTransaction:async callback=>{const pending=[];const result=await callback({get:async ref=>snapshot(ref.path),set:(ref,value)=>pending.push([ref.path,value]),update:(ref,value)=>pending.push([ref.path,{...records.get(ref.path),...value}])});for(const [path,value] of pending){records.set(path,value);writes.push(path);}return result;}};
  return db;
}

test('structured safety uses actual overdue intervals and corrective sign-offs with tenant isolation',()=>{
  const input={workspaceId:'r1',now:Date.parse(now),itemState:verified,logState:verified,items:[{id:'cold',restaurantId:'r1',name:'Cooler',requiredEveryHours:2,lastLoggedAt:'2026-10-09T14:00:00Z'}],logs:[{id:'attention',restaurantId:'r1',itemId:'cold',status:'Attention',managerReviewRequired:true,correctiveAction:'Moved food',timestamp:'2026-10-09T14:00:00Z'},{id:'private',restaurantId:'r2',managerReviewRequired:true}]};
  const report=buildFoodSafetyEvidence(input);assert.equal(report.findings.length,2);assert.ok(report.findings.some(row=>row.id==='missed:cold'));assert.ok(report.findings.some(row=>row.id==='review:attention'));
  const reviewed=buildFoodSafetyEvidence({...input,logs:[{...input.logs[0],reviewedByManager:true,timestamp:now}]});assert.equal(reviewed.findings.length,0);
});
test('cached/limited safety data cannot establish a missed check or healthy readiness',()=>{
  const evidence=buildFoodSafetyEvidence({workspaceId:'r1',items:[{id:'x',restaurantId:'r1',requiredEveryHours:1}],logs:[],itemState:{...verified,cached:true},logState:verified});
  assert.equal(evidence.complete,false);assert.equal(evidence.findings.length,0);
  const category=buildRestaurantReadiness({foodSafetyEvidence:evidence}).categories.find(row=>row.key==='food-safety');assert.equal(category.score,null);assert.equal(category.status,'needs-data');
  assert.equal(evidenceQuality({...verified,data:[{}],limit:1}).complete,false);
});
test('readiness never scores bounded or unauthorized source arrays as complete health',()=>{
  const report=buildRestaurantReadiness({inventoryItems:[{id:'one',currentStock:10,parLevel:1}],sourceStates:{inventory:{...verified,data:[{}],limit:1}}});
  const inventory=report.categories.find(row=>row.key==='inventory');assert.equal(inventory.score,null);assert.equal(inventory.status,'needs-data');assert.equal(inventory.completeness,'incomplete');
  const backup=buildRestaurantReadiness({backupStatus:{status:'failed'},systemDataVisible:true}).categories.find(row=>row.key==='system');assert.equal(backup.status,'critical');assert.notEqual(backup.score,100);
});
test('shared attention includes evidence-linked AI ordering, Python findings and structured safety actions',()=>{
  const cards=buildNeedsAttention({workspaceId:'r1',foodSafetyEvidence:{complete:true,configuredChecks:1,findings:[{id:'due',title:'Check overdue',reason:'Interval passed',severity:'high',evidenceIds:['check'],action:{tab:'prep',focus:'checks'}}]},aiOrderFindings:[{id:'flour',itemName:'Flour',reason:'Below reviewed par'}],pythonFindings:[{id:'quality',title:'Missing vendor mapping',detail:'Review source'}]});
  assert.ok(cards.some(row=>row.sourceKey==='order:flour' && row.approvalRequired));assert.ok(cards.some(row=>row.sourceKey==='python:quality'));assert.ok(cards.some(row=>row.sourceKey==='due' && row.action.focus==='checks'));
});
test('graph menu projection keeps prices, merged recipe links, source IDs and unresolved price conflicts',()=>{
  const menus=buildGraphMenuRows({workspaceId:'r1',dependencies:[{id:'d1',restaurantId:'r1',menuItemId:'m',menuItemName:'Bread',recipeId:'r',menuItemPrice:12},{id:'d2',restaurantId:'r1',menuItemId:'m',recipeId:'s',menuPrice:13},{id:'private',restaurantId:'r2',menuItemId:'secret'}]});
  assert.equal(menus.length,1);assert.equal(menus[0].price,null);assert.equal(menus[0].priceConflict,true);assert.deepEqual(menus[0].recipeIds,['r','s']);assert.deepEqual(menus[0].sourceIds,['d1','d2']);
});
test('downstream graph traces approved batch ingredients to stock/86 and preserves safety provenance',()=>{
  const graph=buildRestaurantKnowledgeGraph({workspaceId:'r1',menuItems:[{id:'m',restaurantId:'r1',name:'Bread',recipeIds:['r'],price:12}],recipes:[{id:'r',restaurantId:'r1',title:'Dough',batchYieldQuantity:5,batchYieldUnit:'lb'}],inventoryItems:[{id:'flour',restaurantId:'r1',name:'Flour',currentStock:0,parLevel:2,allergens:['wheat'],substitutions:['rice flour'],allergensReviewedAt:now,allergensReviewedBy:'owner'}],menuDependencies:[{id:'approved',restaurantId:'r1',recipeId:'r',inventoryItemId:'flour',source:'approved_batch_recipe',status:'approved',approvedBy:'owner'},{id:'pending',restaurantId:'r1',menuItemId:'m',inventoryItemId:'secret',status:'pending'}]});
  assert.deepEqual(graph.impacts[0].ingredientIds,['flour']);assert.equal(graph.impacts[0].stock86Impact,'high');assert.equal(graph.impacts[0].priceCents,1200);assert.equal(graph.impacts[0].allergens[0].verified,true);assert.equal(graph.impacts[0].substitutions[0].reviewRequired,true);assert.ok(!graph.edges.some(row=>row.evidence.sourceId==='pending'));
});
const recipe={id:'bulk',restaurantId:'r1',title:'Sauce',batchYieldQuantity:10,batchYieldUnit:'lb',batchYieldPercent:80,costingApprovedAt:'yield-v1'};
const conversion={servingsPerBatch:16,yieldQuantity:10,yieldPercent:80,yieldUnit:'lb',costingApprovedAt:'yield-v1',reviewed:true};
test('bulk serving conversions require explicit reviewed current yield evidence',()=>{
  assert.equal(reviewedServingConversion(recipe,conversion).usableYield,8);
  for(const patch of [{reviewed:false},{servingsPerBatch:0},{yieldQuantity:9},{yieldUnit:'oz'},{costingApprovedAt:'old'}])assert.equal(reviewedServingConversion(recipe,{...conversion,...patch}).ready,false);
  assert.equal(reviewedServingConversion({...recipe,costingApprovedAt:''},{...conversion,costingApprovedAt:''}).ready,false);
});
test('reviewed bulk imports are private/idempotent and conflicting conversions are atomic failures',async()=>{
  const db=memoryDb({'recipes/bulk':recipe});const row={businessDate:'2026-10-02',recipeId:'bulk',quantity:16,sourceId:'source',lineId:'1',servingConversion:conversion};
  const run=rows=>importDemandRows({db,ctx:owner,rows,approved:true,currentDate:'2026-10-09'});
  assert.equal((await run([row])).imported,1);assert.equal((await run([row])).duplicates,1);const before=db.writes.length;
  await assert.rejects(run([{...row,servingConversion:{...conversion,servingsPerBatch:20}}]),error=>error.statusCode===409);assert.equal(db.writes.length,before);
  const normalized=normalizeItemSalesHistory({workspaceId:'r1',sales:[{id:'source',restaurantId:'r1',date:'2026-10-02',lineItems:[row]}],recipes:[recipe],targetDate:'2026-10-09',sourceState:verified});assert.equal(normalized.complete,true);assert.equal(normalized.rows[0].servingConversion.servingsPerBatch,16);
  assert.ok(db.writes.every(path=>path.startsWith('restaurants/r1/demand') || path.startsWith('auditLogs/')));
});
test('Smart Prep converts reviewed sold servings to production units and existing prep without stock writes',()=>{
  const sales=['2026-09-18','2026-09-25','2026-10-02'].map(date=>({restaurantId:'r1',date,recipeId:'bulk',quantity:16,servingConversion:conversion}));
  const input={workspaceId:'r1',targetDate:'2026-10-09',recipes:[recipe],salesHistory:sales,prepItems:[{restaurantId:'r1',recipeId:'bulk',date:'2026-10-09',quantity:2,unit:'lb'}]};
  const row=buildSmartPrepRecommendations(input).recommendations[0];assert.equal(row.recommendedQuantity,12);assert.equal(row.productionQuantity,6);assert.equal(row.productionUnit,'lb');assert.equal(row.mutationAllowed,false);
  const stale=buildSmartPrepRecommendations({...input,recipes:[{...recipe,costingApprovedAt:'yield-v2'}]}).recommendations[0];assert.equal(stale.recommendedQuantity,null);
});
test('attendance review matches overnight shifts and actual punch identities',()=>{
  const roster=[{id:'roster',authUid:'auth',name:'Alex',restaurantId:'r1'}];
  const input={workspaceId:'r1',actor,now:'2026-10-09T08:00:00Z',sourceState:verified,shiftSourceState:verified,users:roster,attendancePolicy:{enabled:true,timeZone:'America/Chicago',graceMinutes:5,maxOpenBreakMinutes:30},shifts:[{id:'overnight',restaurantId:'r1',employeeId:'roster',date:'2026-10-08',startTime:'22:00',endTime:'06:00',isPublished:true}],timePunches:[{id:'punch',restaurantId:'r1',userId:'auth',status:'clocked_in',clockIn:'2026-10-09T03:00:00Z'}]};
  assert.equal(buildClockAwareness(input).findings.length,0);
  const late=buildClockAwareness({...input,timePunches:[{...input.timePunches[0],clockIn:'2026-10-09T03:20:00Z'}]});assert.equal(late.findings[0].kind,'late-start-review');assert.equal(late.findings[0].reviewRequired,true);
  assert.equal(buildClockAwareness({...input,timePunches:[]}).findings[0].kind,'shift-punch-review');
  assert.equal(buildClockAwareness({...input,shiftSourceState:{...verified,cached:true},timePunches:[]}).findings.length,0);
});
test('open breaks are review-only and ambiguous DST wall times remain unresolved',()=>{
  assert.equal(zonedAttendanceTime('2026-11-01','01:30','America/Chicago'),null);assert.equal(zonedAttendanceTime('2026-03-08','02:30','America/Chicago'),null);
  const report=buildClockAwareness({workspaceId:'r1',actor,now,users:[{id:'a',restaurantId:'r1'}],timePunches:[{id:'p',restaurantId:'r1',userId:'a',status:'on_break',clockIn:'2026-10-09T14:00:00Z',breakStart:'2026-10-09T16:00:00Z'}],sourceState:verified,shifts:[],shiftSourceState:verified,attendancePolicy:{enabled:true,timeZone:'UTC',graceMinutes:5,maxOpenBreakMinutes:30}});
  assert.equal(report.findings[0].kind,'open-break-review');assert.equal(report.mutationAllowed,false);
  assert.equal(buildClockAwareness({...report,workspaceId:'r1',actor:{restaurantId:'r2',isOwner:true}}).allowed,false);
});
test('training follow-up counts real completion and later causes without claiming effectiveness from partial history',()=>{
  const tasks=[{id:'task',restaurantId:'r1',userId:'a',employeeName:'Alex',completed:true,completedAt:'2026-10-05T12:00:00Z',operationalEvidence:{cause:'shortage',evidenceIds:['original']}}];
  const input={workspaceId:'r1',tasks,now:Date.parse(now),events:[{id:'later',at:'2026-10-08',cause:'shortage'},{id:'original',at:'2026-10-08',cause:'shortage'}],sourceState:verified};
  const row=buildTrainingFollowUp(input)[0];assert.equal(row.completed,1);assert.deepEqual(row.repeatedEvidenceIds,['later']);assert.equal(row.state,'review-outcomes');
  assert.equal(buildTrainingFollowUp({...input,sourceState:{...verified,complete:false}})[0].state,'follow-up-incomplete');assert.deepEqual(buildTrainingFollowUp({...input,workspaceId:'r2'}),[]);
});
test('operational history pages preserve tenant scope, cursor coverage, window and undated evidence',async()=>{
  const seed={};for(let i=0;i<102;i++)seed[`prepItems/p${String(i).padStart(3,'0')}`]={restaurantId:'r1',date:'2026-10-08',title:'Prep'};
  seed['prepItems/private']={restaurantId:'r2',date:'2026-10-08'};const db=memoryDb(seed);
  const first=await readOperationalHistoryPage({db,ctx:owner,source:'prep',currentDate:'2026-10-09'});assert.equal(first.data.length,100);assert.equal(first.complete,false);assert.equal(first.nextCursor,'p099');
  const second=await readOperationalHistoryPage({db,ctx:owner,source:'prep',currentDate:'2026-10-09',after:first.nextCursor,scanned:first.scanned});assert.equal(second.data.length,2);assert.equal(second.complete,true);assert.equal(second.scanned,102);assert.equal(db.writes.length,0);
  db.records.set('prepItems/undated',{restaurantId:'r1',title:'Unknown'});const unknown=await readOperationalHistoryPage({db,ctx:owner,source:'prep',currentDate:'2026-10-09',after:first.nextCursor,scanned:first.scanned});assert.equal(unknown.complete,false);assert.equal(unknown.undated,1);
});
test('history permissions, invalid cursors and source names fail closed',async()=>{
  const db=memoryDb();for(const change of [{source:'users'},{source:'alerts',ctx:{...owner,user:{isManager:true},permissions:{ops:true}}},{source:'prep',after:'../x',scanned:1},{source:'prep',scanned:2000},{source:'prep',days:181}])await assert.rejects(readOperationalHistoryPage({db,ctx:owner,source:'prep',currentDate:'2026-10-09',...change}));
  assert.equal(historySourceAllowed({...owner,user:{isManager:true},permissions:{hr:true}},'invoices'),false);
  assert.equal(historySourceAllowed({...owner,user:{demoMode:true,isOwner:true}},'backup'),false);
});
test('history projection retains receiving business evidence while omitting private diagnostics',()=>{
  const row=projectHistoryRow('a',{restaurantId:'r1',lineItems:[{approvedStockQuantity:5,substitution:true,privateToken:'secret'}],rawRequest:{token:'secret'},stack:'secret',errorCategory:'sync-failure',reason:'SDK secret',title:'secret'});
  assert.deepEqual(row.lineItems,[{approvedStockQuantity:5,substitution:true}]);assert.doesNotMatch(JSON.stringify(row),/secret|SDK/);
});

test('history projection bounds nested snapshots and strips arbitrary approval/receiving objects',()=>{
  const row=projectHistoryRow('a',{restaurantId:'r1',approval:{privateToken:'secret'},receiving:{secret:'secret'},snapshots:[{key:'prep',title:'Prep',status:'ready',score:100,privateNotes:'secret'}]});
  assert.deepEqual(row.snapshots,[{key:'prep',title:'Prep',status:'ready',score:100}]);assert.doesNotMatch(JSON.stringify(row),/secret|privateNotes|privateToken/);
  assert.doesNotMatch(JSON.stringify(projectHistoryRow('alert',{restaurantId:'r1',title:'secret',reason:'secret',text:'secret',outcome:'secret',classification:'secret',type:'integration failure'},'alerts')),/secret/);
});

test('actual approved invoice lineItems resolve vendor products and ingredient identities',()=>{
  const graph=buildRestaurantKnowledgeGraph({workspaceId:'r1',vendors:[{id:'vendor',restaurantId:'r1',name:'Vendor'}],vendorProducts:[{id:'vendor:SKU1',restaurantId:'r1',vendorId:'vendor',sku:'SKU1',name:'Flour',inventoryItemId:'flour'}],inventoryItems:[{id:'flour',restaurantId:'r1',name:'Flour'}],invoices:[{id:'invoice',restaurantId:'r1',status:'approved',vendorId:'vendor',lineItems:[{productCode:'SKU1',matchedItemId:'flour',unitPrice:20,quantity:1}]}]});
  assert.ok(graph.edges.some(row=>row.from==='invoice:invoice' && row.to==='product:vendor:SKU1' && row.type==='prices'));assert.equal(graph.missingLinks.length,0);
});

test('mixed allergen reviews and batch-only menu dependencies preserve uncertainty and actual paths',()=>{
  const deps=[{id:'one',restaurantId:'r1',menuItemName:'Bread',batchRecipeId:'dough',allergens:['wheat'],allergensReviewedAt:now,allergensReviewedBy:'owner',source:'approved_menu_scan',status:'approved',approvedBy:'owner'},{id:'two',restaurantId:'r1',menuItemName:'Bread',batchRecipeId:'dough',allergens:['milk'],source:'approved_menu_scan',status:'approved',approvedBy:'owner'}];
  const menuItems=buildGraphMenuRows({workspaceId:'r1',dependencies:deps});assert.equal(menuItems[0].safetyVerified,false);
  const graph=buildRestaurantKnowledgeGraph({workspaceId:'r1',menuItems,menuDependencies:deps,recipes:[{id:'dough',restaurantId:'r1',ingredients:[{inventoryItemId:'flour'}]}],inventoryItems:[{id:'flour',restaurantId:'r1',currentStock:2,parLevel:1}]});
  assert.equal(graph.missingLinks.filter(row=>row.type==='menu-inventory').length,0);assert.deepEqual(graph.impacts[0].ingredientIds,['flour']);assert.ok(graph.impacts[0].allergens.every(row=>!row.verified));
});

test('Smart Prep rejects incomplete prep and unreviewed units while qualifying purchasing evidence',()=>{
  const input={workspaceId:'r1',targetDate:'2026-10-09',recipes:[{...recipe,ingredients:[{inventoryItemId:'flour'}]}],salesHistory:['2026-09-18','2026-09-25','2026-10-02'].map(date=>({restaurantId:'r1',date,recipeId:'bulk',quantity:16,servingConversion:conversion})),prepItems:[],inventoryItems:[{id:'flour',restaurantId:'r1',currentStock:4,parLevel:1}],sourceStates:Object.fromEntries(['prep','inventory','waste','orders','prices','history'].map(key=>[key,verified])),orders:[{id:'po',restaurantId:'r1',status:'ordered',items:[{inventoryItemId:'flour',quantity:100}]}],invoices:[{id:'invoice',restaurantId:'r1',status:'approved',lineItems:[{matchedItemId:'flour',previousStockUnitCost:1,approvedStockUnitCost:2}]}]};
  const row=buildSmartPrepRecommendations(input).recommendations[0];assert.equal(row.recommendedQuantity,16);assert.deepEqual(row.evidence.orderIds,['po']);assert.equal(row.evidence.priceEvidence[0].currentCost,2);assert.match(row.sourceQualifiers.join(' '),/ordered stock is not counted as received/);
  assert.equal(buildSmartPrepRecommendations({...input,sourceStates:{...input.sourceStates,prep:{...verified,cached:true}}}).recommendations[0].recommendedQuantity,null);
  assert.equal(buildSmartPrepRecommendations({...input,prepItems:[{restaurantId:'r1',recipeId:'bulk',date:'2026-10-09',quantity:3,unit:'unknown'}]}).recommendations[0].recommendedQuantity,null);
  const noWaste=buildSmartPrepRecommendations({...input,wasteLogs:[{restaurantId:'r1',recipeId:'bulk',quantity:100,unit:'unknown'}]}).recommendations[0];assert.equal(noWaste.evidence.wasteAdjustment,0);
});
test('backup evidence exposes only the authorized workspace summary',async()=>{
  const db=memoryDb({'system/backupStatus':{status:'ok',lastSuccessfulBackupAt:now,lastIntegrityStatus:'passed',storagePath:'private/path',rawError:'secret'}});
  const result=await readOperationalHistoryPage({db,ctx:owner,source:'backup'});assert.equal(result.data[0].restaurantId,'r1');assert.doesNotMatch(JSON.stringify(result),/private|secret|storagePath/);
  await assert.rejects(readOperationalHistoryPage({db,ctx:{...owner,user:{isManager:true},permissions:{team:true}},source:'backup'}),error=>error.statusCode===403);
});
const catalogRow={sku:'SKU-1',name:'Flour',packSize:'1/10 LB',purchaseUnit:'CS',unitPrice:20,sourceUrl:'https://vendor.example/catalog/flour'};
test('catalog approval, research, conflicts and revocation never mutate operational quantities',async()=>{
  const db=memoryDb({'vendors/vendor':{restaurantId:'r1',name:'Vendor'}}),body={action:'vendor-catalog-import',vendorId:'vendor',rows:[catalogRow],approved:true};
  await operationalReview({db,ctx:owner,body});const evidence=await catalogEvidence({db,restaurantId:'r1',vendorId:'vendor',code:'SKU1'});assert.equal(evidence[0].unitPriceCents,2000);assert.equal(evidence[0].approvalRequired,true);
  const before=db.writes.length;await assert.rejects(operationalReview({db,ctx:owner,body}),error=>error.statusCode===409);assert.equal(db.writes.length,before);
  const listed=await operationalReview({db,ctx:owner,body:{action:'vendor-catalog-list',vendorId:'vendor'}});const product=listed.products[0];
  await operationalReview({db,ctx:owner,body:{action:'vendor-catalog-revoke',vendorId:'vendor',productId:product.id,expectedApprovedAt:product.approvedAt,approved:true}});assert.deepEqual(await catalogEvidence({db,restaurantId:'r1',vendorId:'vendor',code:'SKU1'}),[]);
  await assert.rejects(operationalReview({db,ctx:owner,body:{...body,expectedVersions:{SKU1:product.approvedAt}}}),error=>error.statusCode===409);
  assert.ok(db.writes.every(path=>path.startsWith('vendors/vendor/catalogProducts/') || path.startsWith('auditLogs/')));
});
test('catalog rejects private URLs, malformed quantities, missing approval and foreign vendors',async()=>{
  for(const sourceUrl of ['http://vendor.example/x','https://vendor.example/x?token=secret','https://user:pass@vendor.example/x','javascript:alert(1)'])assert.throws(()=>validateCatalogRow({...catalogRow,sourceUrl}));
  assert.throws(()=>validateCatalogRow({...catalogRow,unitPrice:-1}));const db=memoryDb({'vendors/foreign':{restaurantId:'r2'}});
  await assert.rejects(operationalReview({db,ctx:owner,body:{action:'vendor-catalog-import',vendorId:'foreign',rows:[catalogRow],approved:true}}));assert.equal(db.writes.length,0);
  await assert.rejects(operationalReview({db,ctx:{...owner,user:{},permissions:{hr:true}},body:{action:'vendor-catalog-list',vendorId:'foreign'}}),error=>error.statusCode===403);
});
test('attendance policy is explicitly approved, permission-checked, audited and conflict guarded',async()=>{
  const db=memoryDb({'restaurants/r1':{name:'Restaurant'}}),body={action:'attendance-policy-approve',approved:true,policy:{enabled:true,timeZone:'America/Chicago',graceMinutes:5,maxOpenBreakMinutes:30}};
  await assert.rejects(operationalReview({db,ctx:{...owner,user:{isManager:true},permissions:{labor:true}},body}),error=>error.statusCode===403);
  const result=await operationalReview({db,ctx:owner,body});assert.equal(result.policy.reviewOnly,true);assert.equal(db.records.get('restaurants/r1').attendancePolicy.approvedBy,'owner');const count=db.writes.length;
  await assert.rejects(operationalReview({db,ctx:owner,body}),error=>error.statusCode===409);assert.equal(db.writes.length,count);
});
test('history endpoint rejects invalid requests before touching project credentials',async()=>{
  const handler=require('./operational-history');for(const [req,status] of [[{method:'GET'},405],[{method:'POST',body:{restaurantId:'r1',source:'prep'}},401],[{method:'POST',body:'bad'},400],[{method:'POST',body:'x'.repeat(8001)},413]]){const res={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};await handler({...req,headers:{}},res);assert.equal(res.code,status);assert.equal(res.body.ok,false);}
});
