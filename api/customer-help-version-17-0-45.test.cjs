'use strict';
const fs=require('node:fs'),path=require('node:path');
const test=require('node:test'),assert=require('node:assert/strict');
const pkg=require('../package.json'),help=require('../src/core/customerHelpKnowledge.cjs');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
test('17.0.45 customer Help parity remains synchronized with the active release',()=>{
  assert.equal(help.CUSTOMER_HELP_VERSION,pkg.version);
  const escaped=pkg.version.replace(/\./g,'\\.');
  assert.match(read('src/core/customerHelpKnowledge.js'),new RegExp(`const CUSTOMER_HELP_VERSION = '${escaped}';`));
  assert.match(read('src/core/customerHelpKnowledge.cjs'),new RegExp(`const CUSTOMER_HELP_VERSION = '${escaped}';`));
  const result=help.validateCustomerHelpCorpus();
  assert.equal(result.ok,true,result.errors.join('\n'));
});
