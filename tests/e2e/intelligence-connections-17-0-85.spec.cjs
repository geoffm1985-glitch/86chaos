'use strict';
const {test,expect}=require('@playwright/test');
const {assertDemandPermission}=require('../../api/_item-demand-history');
const {buildScheduleForecast,buildTrainingDraft,buildClockAwareness}=require('../../src/core/intelligenceConnections.cjs');
test('intelligence permissions preserve sales, HR and employee privacy boundaries',()=>{
  const actor={restaurantId:'r1',permissions:{schedule:true}};
  expect(()=>assertDemandPermission({uid:'staff',restaurantId:'r1',user:{},permissions:{schedule:true}},true)).toThrow();
  expect(buildScheduleForecast({actor,workspaceId:'r1'}).allowed).toBe(false);
  expect(()=>buildTrainingDraft({actor,workspaceId:'r1',opportunity:{restaurantId:'r1'}})).toThrow();
  expect(buildClockAwareness({actor,workspaceId:'r1',timePunches:[{restaurantId:'r1',employeeName:'Private'}]})).toMatchObject({allowed:false,findings:[]});
});
