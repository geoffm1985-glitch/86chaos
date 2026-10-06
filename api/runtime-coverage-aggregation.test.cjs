'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {summarizeScriptCoverage}=require('../tests/86chaos-release-gate/utils/runtime-coverage-summary.cjs');
const captured=require('../test-tools/fixtures/runtime-coverage-reload-17-0-84.json');
const sample=(url,source,ranges,name='work')=>({url,source,functions:[{functionName:name,ranges}]});
const range=(startOffset,endOffset,count=1)=>({startOffset,endOffset,count});

test('captured 68.8 percent failure counts a reload of the same main bundle twice',()=>{
  const raw=captured.samples.reduce((sum,row)=>({totalBytes:sum.totalBytes+row.totalBytes,coveredBytes:sum.coveredBytes+row.coveredBytes}),{totalBytes:0,coveredBytes:0});
  assert.equal(Number((raw.coveredBytes/raw.totalBytes*100).toFixed(2)),captured.reportedBytePercent);
  const result=summarizeScriptCoverage(captured.samples.map(row=>sample(row.url,'x'.repeat(row.totalBytes),[range(0,row.coveredBytes)])));
  assert.deepEqual(result.aggregation,{rawScriptSamples:7,uniqueScriptVersions:6,duplicateScriptSamplesMerged:1});
  assert.equal(result.totals.totalBytes,3441133);
  assert.equal(result.totals.coveredBytes,3441133);
  assert.equal(result.totals.bytePercent,100);
});

test('disjoint execution from multiple documents is combined without repeating the denominator',()=>{
  const result=summarizeScriptCoverage([sample('app.js','0123456789',[range(0,4)]),sample('app.js','0123456789',[range(6,10)])]);
  assert.equal(result.totals.totalBytes,10);
  assert.equal(result.totals.coveredBytes,8);
  assert.equal(result.totals.bytePercent,80);
});

test('overlapping and duplicate executed ranges never inflate covered bytes',()=>{
  const result=summarizeScriptCoverage([sample('app.js','0123456789',[range(0,4),range(0,4)]),sample('app.js','0123456789',[range(3,7)])]);
  assert.equal(result.totals.coveredBytes,7);
  assert.equal(result.totals.bytePercent,70);
});

test('different script source served at the same URL remains separate',()=>{
  const result=summarizeScriptCoverage([sample('app.js','abc',[range(0,3)]),sample('app.js','xyz',[range(0,3,0)])]);
  assert.equal(result.aggregation.uniqueScriptVersions,2);
  assert.equal(result.totals.totalBytes,6);
  assert.equal(result.totals.bytePercent,50);
});

test('Unicode sources convert V8 offsets to UTF-8 bytes on both sides of the ratio',()=>{
  const result=summarizeScriptCoverage([sample('app.js','Aé😀B',[range(1,4)])]);
  assert.equal(result.totals.totalBytes,8);
  assert.equal(result.totals.coveredBytes,6);
  assert.equal(result.totals.bytePercent,75);
});

test('named functions are counted once and retain execution observed before reload',()=>{
  const result=summarizeScriptCoverage([sample('app.js','0123456789',[range(0,10,1)]),sample('app.js','0123456789',[range(0,10,0)])]);
  assert.equal(result.totals.totalFunctions,1);
  assert.equal(result.totals.coveredFunctions,1);
});

test('zero-count ranges and empty captures cannot claim coverage',()=>{
  assert.equal(summarizeScriptCoverage([sample('app.js','abc',[range(0,3,0)])]).totals.bytePercent,0);
  assert.equal(summarizeScriptCoverage([]).totals.bytePercent,0);
  assert.throws(()=>summarizeScriptCoverage([{url:'app.js',functions:[]}]),/captured script URL and source/);
});

test('malformed ranges fail instead of producing a percentage above 100',()=>{
  assert.throws(()=>summarizeScriptCoverage([sample('app.js','abc',[range(0,4)])]),/Invalid runtime coverage range/);
});
