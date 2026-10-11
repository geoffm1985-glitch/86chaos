'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {reviewedQaCleanupRefs}=require('./_qa-reviewed-cleanup');
function fixture({restaurant={},vendor={},product={},count=1}={}){
  const queried=[];
  const query=path=>({where(){return this;},limit(n){assert.equal(n,901);return this;},async get(){queried.push(path);return {docs:Array.from({length:count},(_,i)=>({ref:{path:`${path}/${i}`},data:()=>({restaurantId:'qa',...product})}))};}});
  const restaurantRef={collection:name=>query(`restaurants/qa/${name}`)};
  const snapshot={exists:true,id:'qa',ref:restaurantRef,data:()=>({qaOwned:true,qaRunId:'run',...restaurant})};
  const vendorRef={get:async()=>({exists:true,data:()=>({restaurantId:'qa',qaOwned:true,qaRunId:'run',...vendor})}),collection:name=>query(`vendors/qa-vendor/${name}`)};
  return {args:{db:{collection:query},restaurant:snapshot,runId:'run',vendors:[vendorRef]},queried};
}
test('reviewed QA cleanup includes catalog, demand receipts and forecast drafts',async()=>{const {args}=fixture();const refs=await reviewedQaCleanupRefs(args);assert.equal(refs.length,4);assert.ok(refs.some(ref=>ref.path.includes('demandImportLines')));});
test('reviewed QA cleanup refuses a normal customer workspace before reading children',async()=>{const {args,queried}=fixture({restaurant:{qaOwned:false}});await assert.rejects(reviewedQaCleanupRefs(args),/ownership/);assert.equal(queried.length,0);});
test('reviewed QA cleanup refuses another QA run',async()=>{const {args,queried}=fixture({restaurant:{qaRunId:'old'}});await assert.rejects(reviewedQaCleanupRefs(args),/ownership/);assert.equal(queried.length,0);});
test('reviewed QA cleanup refuses cross-workspace vendors',async()=>{const {args}=fixture({vendor:{restaurantId:'customer'}});await assert.rejects(reviewedQaCleanupRefs(args),/vendor ownership/);});
test('reviewed QA cleanup refuses inconsistent catalog tenant evidence',async()=>{const {args}=fixture({product:{restaurantId:'other'}});await assert.rejects(reviewedQaCleanupRefs(args),/conflicting/);});
test('reviewed QA cleanup refuses an unexpectedly unbounded child collection',async()=>{const {args}=fixture({count:901});await assert.rejects(reviewedQaCleanupRefs(args),/bounded/);});
