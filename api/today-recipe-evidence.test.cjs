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

function runBoundaryTransition(previous, current) {
  const source=fs.readFileSync(require.resolve('../src/App.js'),'utf8');
  const effect=source.match(/const listenerCacheBoundaryRef = useRef\(''\);[\s\S]*?\}, \[firebaseConfig\?\.projectId, rId, authenticatedUid, ghostTenant\?\.id\]\);/)[0];
  const cleared=[],ref={current:previous};
  vm.runInNewContext(effect,{useRef:()=>ref,useEffect:callback=>callback(),firebaseConfig:{projectId:current.project},rId:current.restaurant,authenticatedUid:current.viewer,ghostTenant:null,clearTenantListenerCache:boundary=>cleared.push({...boundary})});
  return {cleared,next:ref.current};
}
const matches=(boundary,row)=>['projectId','restaurantId','viewerUid'].every(key=>!boundary[key] || boundary[key]===row[key]);
test('login and workspace initialization preserve newly attached current-viewer listeners',()=>{
  const current={project:'testing',restaurant:'qa-current',viewer:'owner'};
  for(const previous of ['testing|||','testing||owner|','testing|qa-current||']) {
    const {cleared,next}=runBoundaryTransition(previous,current);
    const active={projectId:'testing',restaurantId:'qa-current',viewerUid:'owner'};
    assert.equal(cleared.some(boundary=>matches(boundary,active)),false,`transition ${previous} must not close current listeners`);
    assert.equal(next,'testing|qa-current|owner|');
  }
});
test('real project, workspace and viewer transitions clear only the obsolete listener scope',()=>{
  for(const [previous,current,old] of [
    ['old|r|owner|',{project:'testing',restaurant:'r',viewer:'owner'},{projectId:'old',restaurantId:'r',viewerUid:'owner'}],
    ['testing|old|owner|',{project:'testing',restaurant:'qa-current',viewer:'owner'},{projectId:'testing',restaurantId:'old',viewerUid:'owner'}],
    ['testing|qa-current|old|',{project:'testing',restaurant:'qa-current',viewer:'owner'},{projectId:'testing',restaurantId:'qa-current',viewerUid:'old'}],
    ['testing|qa-current||',{project:'testing',restaurant:'qa-current',viewer:'owner'},{projectId:'testing',restaurantId:'qa-current',viewerUid:'anonymous'}]
  ]) {
    const {cleared}=runBoundaryTransition(previous,current);
    assert.equal(cleared.some(boundary=>matches(boundary,old)),true);
    assert.equal(cleared.some(boundary=>matches(boundary,{projectId:current.project,restaurantId:current.restaurant,viewerUid:current.viewer})),false);
  }
});
