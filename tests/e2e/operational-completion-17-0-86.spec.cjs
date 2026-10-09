'use strict';
const {test,expect}=require('@playwright/test');
const {historySourceAllowed,projectHistoryRow}=require('../../api/_operational-history');
const {reviewedServingConversion,evidenceQuality}=require('../../src/core/operationalEvidence.cjs');

test('operational history source permissions preserve private records and diagnostics',()=>{
  const manager={uid:'manager',restaurantId:'r1',user:{isManager:true},permissions:{prep:true}};
  expect(historySourceAllowed(manager,'prep')).toBe(true);
  for(const source of ['waste','alerts','invoices','backup'])expect(historySourceAllowed(manager,source)).toBe(false);
  const row=projectHistoryRow('record',{restaurantId:'r1',title:'Reviewed record',approval:{privateToken:'secret'},snapshots:[{key:'prep',status:'ready',secret:'hidden'}],requestBody:'private'});
  expect(JSON.stringify(row)).not.toMatch(/secret|hidden|privateToken|requestBody/);
});

test('bulk conversion and source completeness cannot be inferred from partial evidence',()=>{
  const recipe={batchYieldQuantity:10,batchYieldUnit:'lb',batchYieldPercent:80,costingApprovedAt:'yield-v1'};
  const conversion={servingsPerBatch:16,yieldQuantity:10,yieldUnit:'lb',yieldPercent:80,costingApprovedAt:'yield-v1',reviewed:true};
  expect(reviewedServingConversion(recipe,conversion).ready).toBe(true);
  expect(reviewedServingConversion({...recipe,costingApprovedAt:'yield-v2'},conversion).ready).toBe(false);
  expect(evidenceQuality({resolved:true,data:[{}],limit:1}).complete).toBe(false);
  expect(evidenceQuality({resolved:true,data:[],allowed:false}).complete).toBe(false);
});
