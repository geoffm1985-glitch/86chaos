'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createReviewedForecastDraft}=require('./_schedule-forecast-draft');
const {forecastDraftId}=require('../src/core/intelligenceConnections.cjs');
const now='2026-10-10T12:00:00.000Z';
const ctx={uid:'owner',restaurantId:'r',user:{isOwner:true},permissions:{}};
const target={restaurantId:'r',dayIndex:6,role:'Server',startTime:'00:07',endTime:'00:19',count:1};
function request(){return {restaurantId:'r',targetId:'target',date:'2026-10-10',slot:0,approved:true,data:{restaurantId:'r',workspaceId:'r',date:'2026-10-10',scheduleDateKey:'2026-10-10',role:'Server',targetRole:'Server',startTime:'00:07',endTime:'00:19',isPublished:false,publishState:'draft',source:'demand_forecast_review',employeeId:'employee',employeeName:'QA Server',forecastEvidence:{dates:['2026-09-19','2026-09-26','2026-10-03'],average:100,recent:100,expectedDemand:100,factor:1}}};}
function database(patch={}) {
  const store=new Map([['scheduleCoverageTargets/target',{...target,...patch}]]);let writes=0,queue=Promise.resolve();
  const db={collection:name=>({doc:id=>({id,path:`${name}/${id}`})}),runTransaction:async callback=>{const prior=queue;let release;queue=new Promise(resolve=>{release=resolve;});await prior;try{const pending=[];const out=await callback({get:async ref=>({exists:store.has(ref.path),data:()=>structuredClone(store.get(ref.path))}),create:(ref,data)=>pending.push({ref,data})});for(const {ref,data} of pending){assert.equal(store.has(ref.path),false,'create must not overwrite');store.set(ref.path,structuredClone(data));writes++;}return out;}finally{release();}}};
  return {db,store,get writes(){return writes;}};
}
const create=(state,body=request(),actor=ctx)=>createReviewedForecastDraft({db:state.db,ctx:actor,body,now});
const id=()=>forecastDraftId({workspaceId:'r',targetId:'target',date:'2026-10-10'},'r',0);
test('reviewed forecast creation uses the server transaction and stores canonical unpublished reviewer evidence',async()=>{
  const state=database(),body=request();Object.assign(body.data,{role:'Owner',isSuperAdmin:true,forecastReviewedBy:'forged',createdAt:'old',accountUserId:'auth-owner',assignedUserId:'employee',assignedName:'QA Server',assignedEmail:'qa@example.test'});
  assert.deepEqual(await create(state,body),{id:id(),created:true});
  const saved=state.store.get(`shifts/${id()}`);assert.equal(saved.role,'Server');assert.equal(saved.targetRole,'Server');assert.equal(saved.scheduleDateKey,'2026-10-10');assert.equal(saved.scheduleMonth,'2026-10');assert.equal(saved.workspaceId,'r');assert.equal(saved.isPublished,false);assert.equal(saved.publishState,'draft');assert.equal(saved.forecastReviewedBy,'owner');assert.equal(saved.createdAt,now);assert.equal(saved.isSuperAdmin,undefined);assert.equal(saved.accountUserId,'auth-owner');assert.equal(saved.assignedUserId,'employee');assert.equal(saved.assignedName,'QA Server');assert.equal(saved.assignedEmail,'qa@example.test');
  const fs=require('node:fs'),ui=fs.readFileSync(require.resolve('../src/features/schedule.jsx'),'utf8'),api=fs.readFileSync(require.resolve('./safe-write'),'utf8');
  assert.match(ui,/action:'schedule-forecast-draft-create'/);assert.doesNotMatch(ui,/transact:callback=>runTransaction\(db,callback\)/);assert.match(api,/if\(forecastMutation\)/);assert.match(api,/canWrite\(auth,'shifts',restaurantId\)/);
});
test('concurrent and published-shift retries create once and never overwrite existing shifts',async()=>{
  const state=database(),results=await Promise.all([create(state),create(state)]);assert.equal(results.filter(row=>row.created).length,1);assert.equal(state.writes,1);
  const saved={...state.store.get(`shifts/${id()}`),isPublished:true,publishState:'published',employeeName:'Reviewed assignment'};state.store.set(`shifts/${id()}`,saved);
  assert.equal((await create(state)).created,false);assert.deepEqual(state.store.get(`shifts/${id()}`),saved);assert.equal(state.writes,1);
});
test('an existing foreign-workspace draft cannot be read as a retry or overwritten',async()=>{const state=database();state.store.set(`shifts/${id()}`,{restaurantId:'foreign'});await assert.rejects(create(state),{statusCode:409});assert.equal(state.writes,0);});
test('missing and foreign coverage targets cannot create reviewed forecast shifts',async()=>{for(const foreign of [true,false]){const state=database({restaurantId:'foreign'});if(!foreign)state.store.delete('scheduleCoverageTargets/target');await assert.rejects(create(state),{statusCode:403});assert.equal(state.writes,0);}});
test('forecast creation requires verified workspace and schedule authority',async()=>{for(const actor of [{...ctx,restaurantId:'foreign'},{...ctx,user:{},permissions:{}},{...ctx,user:{},permissions:{schedule:'false'}},{...ctx,uid:'',email:''}]){const state=database();await assert.rejects(create(state,request(),actor),{statusCode:403});assert.equal(state.writes,0);}});
test('unapproved, malformed, published and wrong-workspace forecast payloads are rejected before writing',async()=>{
  for(const change of [b=>b.approved=false,b=>b.date='2026-02-30',b=>b.slot=50,b=>b.slot=-1,b=>b.targetId='other/path',b=>b.docId='other',b=>b.data.restaurantId='other',b=>b.data.workspaceId='other',b=>b.data.scheduleDateKey='2026-10-11',b=>b.data.isPublished=true,b=>b.data.publishState='published',b=>b.data.startTime='25:00',b=>b.data.endTime='00:07',b=>b.data.employeeId=12,b=>b.data.forecastEvidence.dates=['2026-10-03'],b=>b.data.forecastEvidence.factor=2]){const state=database(),body=request();change(body);await assert.rejects(create(state,body),{statusCode:400});assert.equal(state.writes,0);}
});
test('changed coverage time, role, weekday and invalid or insufficient count require another review',async()=>{for(const patch of [{startTime:'00:08'},{endTime:'00:20'},{role:'Cook'},{dayIndex:5},{count:0},{count:51},{count:1.5}]){const state=database(patch);await assert.rejects(create(state),{statusCode:409});assert.equal(state.writes,0);}const body=request();body.slot=1;const reduced=database({count:1});await assert.rejects(create(reduced,body),{statusCode:409});assert.equal(reduced.writes,0);assert.equal((await create(database({count:2}),body)).created,true);});
test('zero recent demand remains valid when dated comparable average and expected demand are positive',async()=>{const state=database(),body=request();body.data.forecastEvidence={...body.data.forecastEvidence,recent:0,expectedDemand:60,factor:0.8};assert.equal((await create(state,body)).created,true);assert.equal(state.writes,1);});
test('the training QA fixture retains required assignment and creation evidence',()=>{const profile=require('../tests/86chaos-full-audit/utils/fake-restaurant-profile.cjs').buildFakeRestaurantProfile({restaurantId:'r',runId:'fixture-validation',anchorDate:new Date(now)});const task=profile.collections.hrOnboardingTasks[0];assert.equal(task.restaurantId,'r');assert.equal(task.userKey,'allen');assert.equal(task.completed,false);assert.ok(task.assignedById);assert.ok(task.assignedByName);assert.ok(Number.isFinite(Date.parse(task.createdAt)));assert.ok(task.operationalEvidence.evidenceIds.length);});
