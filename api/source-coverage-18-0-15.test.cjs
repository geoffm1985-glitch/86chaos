'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {evaluateCoverage,buildSourceCoverage,SOURCE_REGISTRY}=require('../src/core/sourceCoverage.cjs');
const {buildFoodSafetyEvidence}=require('../src/core/operationalEvidence.cjs');
test('registered source coverage distinguishes verified empty, missing, denied, cached, failed and truncated evidence',()=>{
  assert.equal(evaluateCoverage({resolved:true,data:[],limit:10}).complete,true);
  for(const [state,status] of [[null,'not-loaded'],[{resolved:true,allowed:false},'denied'],[{resolved:true,cached:true},'stale'],[{resolved:true,error:'offline'},'error'],[{resolved:true,truncated:true},'incomplete'],[{resolved:true,data:[1,2],limit:2},'incomplete']])assert.equal(evaluateCoverage(state).status,status);
});
test('configured source registry cannot silently omit an unknown required source and contains all operating categories',()=>{
  const report=buildSourceCoverage({inventory:{resolved:true}},['inventory','safety']);
  assert.equal(report.find(row=>row.key==='safety').complete,false);assert.equal(report.find(row=>row.key==='inventory').complete,true);
  assert.equal(new Set(SOURCE_REGISTRY.map(row=>row.category)).size,8);
  assert.throws(()=>buildSourceCoverage({},['unknown-source']));
});
test('new attention safety readings require closure even after a manager records a review note',()=>{
  const log={id:'log',restaurantId:'r',status:'Attention',managerReviewRequired:true,reviewedByManager:true,safetyRevision:1};
  const input={workspaceId:'r',items:[],logs:[log],itemState:{resolved:true},logState:{resolved:true}};
  assert.equal(buildFoodSafetyEvidence(input).findings.length,1);
  assert.equal(buildFoodSafetyEvidence({...input,logs:[{...log,closureEvidence:{followUpLogId:'later'}}]}).findings.length,0);
});
