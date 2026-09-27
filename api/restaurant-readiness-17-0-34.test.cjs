'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const { buildRestaurantReadiness }=require('../src/core/restaurantReadiness.cjs');

test('17.0.34 readiness is deterministic and keeps a fixed eight-area operating model',()=>{
  const input={currentDate:'2026-09-26',inventoryItems:[{name:'Fries',parLevel:5,currentStock:5}],prepItems:[{date:'2026-09-26',text:'Sauce',isCompleted:true}],tasks:[{title:'Line temp check',status:'Completed',isCompleted:true}],users:[{id:'u1',isActive:true}],shifts:[{date:'2026-09-26',isPublished:true,employeeId:'u1'}],timePunches:[],timeOffRequests:[],maintenanceLogs:[{status:'Completed'}],sales:[{businessDate:'2026-09-26'}],events:[],restaurantAdminAlerts:[],systemDataVisible:true};
  const a=buildRestaurantReadiness(input), b=buildRestaurantReadiness(input);
  assert.deepEqual(a,b);
  assert.equal(a.categories.length,8);
  assert.deepEqual(a.categories.map(row=>row.label),['Inventory','Prep','Staffing','Maintenance','Food Safety','Financial','Operations','System']);
  assert.equal(a.reviewOnly,true);
});

test('17.0.34 critical evidence lowers readiness and keeps direct review actions',()=>{
  const r=buildRestaurantReadiness({currentDate:'2026-09-26',inventoryItems:[{name:'Fish',parLevel:4,currentStock:0}],prepItems:[{date:'2026-09-26',text:'Portion fish',isCompleted:false}],tasks:[{title:'Line temp check',status:'Open',isCompleted:false,dueDate:'2026-09-25'}],users:[{id:'u1',isActive:true}],shifts:[],timePunches:[],timeOffRequests:[{status:'pending'}],maintenanceLogs:[{equipment:'Fryer',issue:'Leak',urgency:'Critical',status:'Reported'}],sales:[],events:[],restaurantAdminAlerts:[{title:'Backup issue',severity:'high',status:'open'}],systemDataVisible:true});
  assert.equal(r.status,'critical');
  assert.equal(r.categories.find(x=>x.key==='inventory').status,'critical');
  assert.equal(r.categories.find(x=>x.key==='maintenance').status,'critical');
  assert.equal(r.categories.find(x=>x.key==='staffing').status,'critical');
  assert.equal(r.categories.find(x=>x.key==='food-safety').status,'attention');
  assert.equal(r.categories.find(x=>x.key==='inventory').action.tab,'inventory');
  assert.ok(r.overallScore >= 0 && r.overallScore <= 100);
});

test('17.0.34 missing evidence is never silently scored healthy',()=>{
  const r=buildRestaurantReadiness({currentDate:'2026-09-26',inventoryItems:[],prepItems:[],tasks:[],users:[],shifts:[],timePunches:[],timeOffRequests:[],maintenanceLogs:[],sales:[],events:[],restaurantAdminAlerts:[],systemDataVisible:false});
  for(const key of ['inventory','prep','staffing','maintenance','food-safety','financial','system']) {
    const row=r.categories.find(x=>x.key===key);
    assert.equal(row.status,'needs-data',key);
    assert.equal(row.score,null,key);
  }
  assert.ok(r.coveragePct < 100);
  assert.equal(r.status,'partial');
});

test('17.0.34 readiness output is review-only and has no mutation instructions',()=>{
  const r=buildRestaurantReadiness({currentDate:'2026-09-26'});
  for(const row of r.categories){
    assert.ok(row.action && typeof row.action.tab==='string');
    assert.equal(Object.prototype.hasOwnProperty.call(row.action,'write'),false);
    assert.equal(Object.prototype.hasOwnProperty.call(row.action,'mutation'),false);
  }
  assert.equal(r.reviewOnly,true);
});
