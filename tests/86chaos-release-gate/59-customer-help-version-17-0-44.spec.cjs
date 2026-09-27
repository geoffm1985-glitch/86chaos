'use strict';
const {test,expect}=require('@playwright/test');
const pkg=require('../../package.json'),help=require('../../src/core/customerHelpKnowledge.cjs');
test('customer Help release metadata matches 17.0.44',async()=>{
  expect(pkg.version).toBe('17.0.44');
  expect(help.CUSTOMER_HELP_VERSION).toBe(pkg.version);
  const result=help.validateCustomerHelpCorpus();
  expect(result.ok).toBe(true);
});
