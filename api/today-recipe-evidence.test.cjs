'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
test('Today loads recipe evidence for authorized sales review and menu projections while unrelated routes stay quiet',()=>{
  const source=fs.readFileSync(require.resolve('../src/App.js'),'utf8');
  const expression=source.match(/const wantsRecipesData = ([^;\n]+);/)[1];
  const evaluate=patch=>vm.runInNewContext(expression,{activeTabState:'today',wantsToday:true,canReadMenuCollections:false,globalSearchHasMeaningfulQuery:false,appUser:{permissions:{sales:true}},hasAnyPermission:(user,keys)=>user.isOwner===true || keys.some(key=>user.permissions?.[key]===true),...patch});
  assert.equal(evaluate({}),true,'sales import must have recipes to match');
  for(const key of ['salesEdit','financialEdit'])assert.equal(evaluate({appUser:{permissions:{[key]:true}}}),true);
  assert.equal(evaluate({appUser:{isOwner:true}}),true);
  assert.equal(evaluate({appUser:{permissions:{hr:true}}}),false);
  assert.equal(evaluate({appUser:{demoMode:true,permissions:{sales:true}}}),false);
  assert.equal(evaluate({appUser:{permissions:{}},canReadMenuCollections:true}),true);
  assert.equal(evaluate({activeTabState:'inventory',wantsToday:false}),false);
  assert.equal(evaluate({activeTabState:'menu-intelligence',wantsToday:false}),true);
  assert.equal(evaluate({activeTabState:'help',wantsToday:false,globalSearchHasMeaningfulQuery:true}),true);
});
