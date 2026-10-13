'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {fakeFirestore}=require('../test-tools/fakeFirestore.cjs');
const {trainingCompetency}=require('./_training-competency.cjs');
const ctx={uid:'manager',restaurantId:'r',user:{},permissions:{hr:true}};
const body={restaurantId:'r',action:'training-competency-review',operationId:'competency_review_operation',userId:'employee',roleId:'cook',station:'Grill',note:'Observed correct thermometer use and documented corrective workflow.',confirmed:true,evidence:[{id:'task',completedAt:'2026-10-13T10:00:00Z'}]};
function db(){return fakeFirestore({'users/employee':{restaurantId:'r',name:'Employee',isActive:true},'workspaceMembers/employee_r':{restaurantId:'r',authUid:'employee',isActive:true},'roles/cook':{restaurantId:'r',name:'Cook'},'hrOnboardingTasks/task':{restaurantId:'r',userId:'employee',title:'Thermometer procedure',completed:true,completedAt:'2026-10-13T10:00:00Z'}});}
const review=(database,request=body,actor=ctx)=>trainingCompetency({db:database,ctx:actor,body:request,clock:()=>new Date('2026-10-13T12:00:00Z')});
test('competency requires manager-observed confirmation and preserves checklist completion separately',async()=>{
  const database=db(),result=await review(database);
  assert.equal(result.review.station,'Grill');assert.equal(result.review.roleName,'Cook');assert.equal(result.review.evidence[0].id,'task');
  assert.equal(database.records.get('hrOnboardingTasks/task').competent,undefined);
  const writes=database.writes.length;assert.equal((await review(database)).duplicate,true);assert.equal(database.writes.length,writes);
});
test('ordinary employees cannot certify competence and managers cannot self-certify',async()=>{
  for(const actor of [{...ctx,permissions:{}},{...ctx,uid:'employee'}]){const database=db();await assert.rejects(()=>review(database,body,actor),error=>error.statusCode===403);assert.equal(database.writes.length,0);}
});
test('competency review denies stale, incomplete, foreign and future checklist evidence',async()=>{
  for(const patch of [{completed:false},{completedAt:'changed'},{restaurantId:'other'},{userId:'another'},{completedAt:'2026-10-14T10:00:00Z'}]){
    const database=db();database.records.set('hrOnboardingTasks/task',{...database.records.get('hrOnboardingTasks/task'),...patch});
    await assert.rejects(()=>review(database));assert.equal(database.writes.length,0);
  }
});
test('revoked canonical membership or archived role prevents competency review',async()=>{
  for(const [path,patch] of [['workspaceMembers/employee_r',{status:'revoked'}],['roles/cook',{archived:true}]]){const database=db();database.records.set(path,{...database.records.get(path),...patch});await assert.rejects(()=>review(database));assert.equal(database.writes.length,0);}
});
test('competency retry cannot change employee, station or evidence under the same operation ID',async()=>{
  const database=db();await review(database);await assert.rejects(()=>review(database,{...body,station:'Cold prep'}),error=>error.statusCode===409);
});
test('competency revocation is explicit and retains the original verification and evidence',async()=>{
  const database=db(),result=await review(database),request={restaurantId:'r',action:'training-competency-revoke',reviewId:result.id,expectedReviewedAt:result.review.reviewedAt,note:'Demonstration must be repeated after workflow change.',confirmed:true};
  await review(database,request);const row=database.records.get(`trainingCompetencyReviews/${result.id}`);
  assert.equal(row.reviewedAt,result.review.reviewedAt);assert.equal(row.evidence.length,1);assert.equal(row.revokedBy,'manager');assert.equal((await review(database,request)).duplicate,true);
});
