'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const pkg=require('../package.json'),help=require('../src/core/customerHelpKnowledge.cjs');
test('17.0.44 customer Help metadata matches the active application release',()=>{
  assert.equal(pkg.version,'17.0.44');
  assert.equal(help.CUSTOMER_HELP_VERSION,pkg.version);
  const result=help.validateCustomerHelpCorpus();
  assert.equal(result.ok,true,result.errors.join('\n'));
});
