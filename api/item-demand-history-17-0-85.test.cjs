'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {fakeFirestore}=require('../test-tools/fakeFirestore.cjs');
const {assertDemandPermission,workspaceBusinessDate,normalizeDemandRows,importDemandRows}=require('./_item-demand-history');
const ctx={restaurantId:'r1',uid:'owner',user:{isOwner:true}};
const row={businessDate:'2026-10-01',recipeId:'pizza',quantity:3,sourceId:'receipt-1',lineId:'line-1'};
const seed=()=>fakeFirestore({'recipes/pizza':{restaurantId:'r1',title:'Pizza'},'recipes/bulk':{restaurantId:'r1',batchYieldUnit:'lb'},'recipes/foreign':{restaurantId:'r2'},'sales/close':{restaurantId:'r1',netSales:100},'inventoryItems/pizza':{restaurantId:'r1',currentStock:8}});
const run=(db,rows=[row],context=ctx,approved=true)=>importDemandRows({db,ctx:context,rows,approved,currentDate:'2026-10-08'});
test('server history windows use the workspace business date across UTC midnight and DST',()=>{assert.equal(workspaceBusinessDate({timezone:'America/Chicago'},new Date('2026-10-09T02:00:00Z')),'2026-10-08');assert.equal(workspaceBusinessDate({timezone:'Asia/Tokyo'},new Date('2026-10-09T02:00:00Z')),'2026-10-09');assert.equal(workspaceBusinessDate({},new Date('2026-11-01T06:30:00Z')),'2026-11-01');assert.throws(()=>workspaceBusinessDate({timezone:'invalid/timezone'}));});
test('reviewed imports persist private history and stable receipts; repeated source lines do not duplicate or touch stock/POS/Daily Close',async()=>{const db=seed();assert.deepEqual(await run(db),{imported:1,duplicates:0});const writes=db.writes.length;assert.deepEqual(await run(db),{imported:0,duplicates:1});assert.equal(db.writes.length,writes);assert.equal(db.records.get('sales/close').netSales,100);assert.equal(db.records.get('inventoryItems/pizza').currentStock,8);assert.ok(db.writes.every(path=>path.startsWith('restaurants/r1/demand') || path.startsWith('auditLogs/')));});
test('a replay with a changed date, quantity or recipe is rejected atomically',async()=>{for(const change of [{businessDate:'2026-10-02'},{quantity:4},{recipeId:'other'}]){const db=seed();db.records.set('recipes/other',{restaurantId:'r1'});await run(db);const writes=db.writes.length;await assert.rejects(run(db,[{...row,...change}]),error=>error.statusCode===409);assert.equal(db.writes.length,writes);}});
test('duplicates and conflicting repeats within a batch are handled before any writes',async()=>{const db=seed();assert.deepEqual(await run(db,[row,row]),{imported:1,duplicates:1});const empty=seed();await assert.rejects(run(empty,[row,{...row,businessDate:'2026-10-02'}]),error=>error.statusCode===409);assert.equal(empty.writes.length,0);});
test('missing approval, foreign recipes, bulk units, demo and limited roles cannot import',async()=>{for(const args of [[ctx,[row],false],[ctx,[{...row,recipeId:'foreign'}],true],[ctx,[{...row,recipeId:'bulk'}],true],[{...ctx,user:{demoMode:true,isOwner:true}},[row],true],[{...ctx,user:{},permissions:{salesRead:true}},[row],true]]){const db=seed();await assert.rejects(run(db,args[1],args[0],args[2]));assert.equal(db.writes.length,0);}});
test('read permission and workspace context are explicit',()=>{assert.doesNotThrow(()=>assertDemandPermission({...ctx,user:{},permissions:{laborRead:true}}));assert.throws(()=>assertDemandPermission({...ctx,user:{},permissions:{team:true}}));assert.throws(()=>assertDemandPermission({...ctx,uid:''}));});
test('invalid dates, refunds, booleans, incomplete IDs and unbounded rows fail closed; actual zero remains valid',()=>{for(const change of [{businessDate:'2026-02-30'},{businessDate:'2026-10-09'},{businessDate:'2026-01-01'},{quantity:-1},{quantity:true},{quantity:''},{sourceId:''},{recipeId:'../foreign'}])assert.throws(()=>normalizeDemandRows([{...row,...change}],'2026-10-08'));assert.throws(()=>normalizeDemandRows(Array(201).fill(row),'2026-10-08'));assert.equal(normalizeDemandRows([{...row,quantity:0}],'2026-10-08')[0].quantity,0);});
test('new endpoint returns bounded errors and authentication failures without initializing production credentials',async()=>{const handler=require('./demand-history');for(const [request,status] of [[{method:'GET'},405],[{method:'POST',body:{action:'read',restaurantId:'r1'}},401],[{method:'POST',body:'broken'},400],[{method:'POST',body:{action:'read',restaurantId:'r1'},headers:{'content-encoding':'gzip'}},415],[{method:'POST',body:'x'.repeat(256001)},413]]){const response={setHeader(){},status(value){this.code=value;return this;},json(value){this.body=value;return this;}};await handler({...request,headers:request.headers || {}},response);assert.equal(response.code,status);assert.equal(response.body.ok,false);}});
test('demand history exceptions never expose SDK messages or accept arbitrary response statuses',async()=>{
  const adminPath=require.resolve('./_chaos-admin');const routePath=require.resolve('./demand-history');
  const originalAdmin=require.cache[adminPath];const originalRoute=require.cache[routePath];
  try {
    for(const statusCode of [400,403,409,500,503,777,undefined]) {
      require.cache[adminPath]={id:adminPath,filename:adminPath,loaded:true,exports:{initAdmin(){throw Object.assign(new Error('private SDK credential and workspace details'),{statusCode});}}};
      delete require.cache[routePath];const handler=require('./demand-history');
      const response={setHeader(){},status(value){this.code=value;return this;},json(value){this.body=value;return this;}};
      await handler({method:'POST',headers:{authorization:'Bearer test-token'},body:{action:'read',restaurantId:'r1'}},response);
      assert.equal(response.code,[400,403,409].includes(statusCode) ? statusCode : 500);
      assert.equal(response.body.ok,false);assert.doesNotMatch(JSON.stringify(response.body),/private|SDK|credential|details/);
      if(response.code===500)assert.equal(response.body.error,'Demand history could not be verified.');
    }
  } finally {
    if(originalAdmin)require.cache[adminPath]=originalAdmin;else delete require.cache[adminPath];
    if(originalRoute)require.cache[routePath]=originalRoute;else delete require.cache[routePath];
  }
});
