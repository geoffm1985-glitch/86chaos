'use strict';
const fs=require('node:fs'),path=require('node:path');
const {test,expect}=require('@playwright/test');
const pkg=require('../../package.json'),help=require('../../src/core/customerHelpKnowledge.cjs');
const read=file=>fs.readFileSync(path.join(__dirname,'../..',file),'utf8');
test('customer Help release metadata and JS/CJS mirrors match 17.0.45',async()=>{
  expect(pkg.version).toBe('17.0.45');
  expect(help.CUSTOMER_HELP_VERSION).toBe(pkg.version);
  expect(read('src/core/customerHelpKnowledge.js')).toMatch(/const CUSTOMER_HELP_VERSION = '17\.0\.45';/);
  expect(read('src/core/customerHelpKnowledge.cjs')).toMatch(/const CUSTOMER_HELP_VERSION = '17\.0\.45';/);
  const result=help.validateCustomerHelpCorpus();
  expect(result.ok).toBe(true);
});
