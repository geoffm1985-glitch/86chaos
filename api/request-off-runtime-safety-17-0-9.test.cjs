'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const safety=require('../src/core/requestOffRuntimeSafety.cjs');

test('17.0.9 Request Off runtime normalizes legacy dates and Firestore-like timestamps without throwing',()=>{
 const row=safety.normalizeRequestOffRuntimeRow({id:'legacy-1',startDate:'2026-10-17',employeeName:{unexpected:true},role:['bad'],requestedAt:{seconds:1792195200,nanoseconds:0},status:'pending',archived:false,publishedBy:{uid:'legacy-object'},approvedBy:{uid:'legacy-object'}});
 assert.equal(row.id,'legacy-1');assert.equal(row.date,'2026-10-17');assert.equal(row.employeeName,'');assert.equal(row.role,'');assert.match(row.requestedAt,/^2026-/);assert.equal(row.status,'pending');assert.equal(row.publishedBy,'');assert.equal(row.approvedBy,'');
});

test('17.0.9 Request Off runtime drops non-record rows and survives hostile scalar conversion',()=>{
 const hostile={toString(){throw new Error('boom');}};
 const rows=safety.safeRequestOffRows(null,'bad',[undefined,42,{id:'ok',date:'2026-11-01',employeeName:hostile}]);
 assert.equal(rows.length,1);assert.equal(rows[0].id,'ok');assert.equal(rows[0].employeeName,'');assert.equal(safety.requestOffDateKey(rows[0]),'2026-11-01');
});

test('17.0.9 Schedule Request Off surface uses runtime-safe rows before rendering',()=>{
 const source=fs.readFileSync(require('node:path').join(__dirname,'../src/features/schedule.jsx'),'utf8');
 assert.match(source,/safeRequestOffRows\(\.\.\.lists\)/);assert.match(source,/normalizeRequestOffRuntimeRow/);assert.match(source,/Array\.isArray\(events\)/);
});
