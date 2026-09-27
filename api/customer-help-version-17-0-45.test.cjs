'use strict';
const fs=require('node:fs'),path=require('node:path');
const test=require('node:test'),assert=require('node:assert/strict');
const pkg=require('../package.json'),help=require('../src/core/customerHelpKnowledge.cjs');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
test('17.0.45 customer Help metadata and JS/CJS mirrors match the active release',()=>{
  assert.equal(pkg.version,'17.0.45');
  assert.equal(help.CUSTOMER_HELP_VERSION,pkg.version);
  assert.match(read('src/core/customerHelpKnowledge.js'),/const CUSTOMER_HELP_VERSION = '17\.0\.45';/);
  assert.match(read('src/core/customerHelpKnowledge.cjs'),/const CUSTOMER_HELP_VERSION = '17\.0\.45';/);
  const result=help.validateCustomerHelpCorpus();
  assert.equal(result.ok,true,result.errors.join('\n'));
});
