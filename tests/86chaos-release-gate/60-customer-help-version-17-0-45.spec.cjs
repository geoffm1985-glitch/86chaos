'use strict';
const fs=require('node:fs'),path=require('node:path');
const {test,expect}=require('@playwright/test');
const pkg=require('../../package.json'),help=require('../../src/core/customerHelpKnowledge.cjs');
const read=file=>fs.readFileSync(path.join(__dirname,'../..',file),'utf8');
test('customer Help release metadata and JS/CJS mirrors remain synchronized',async()=>{
  expect(help.CUSTOMER_HELP_VERSION).toBe(pkg.version);
  const escaped=pkg.version.replace(/\./g,'\\.');
  expect(read('src/core/customerHelpKnowledge.js')).toMatch(new RegExp(`const CUSTOMER_HELP_VERSION = '${escaped}';`));
  expect(read('src/core/customerHelpKnowledge.cjs')).toMatch(new RegExp(`const CUSTOMER_HELP_VERSION = '${escaped}';`));
  const result=help.validateCustomerHelpCorpus();
  expect(result.ok).toBe(true);
});
