const test=require('node:test'),assert=require('node:assert/strict');
const load=()=>import('../src/core/nativeBackController.mjs');
function harness(){
  const target=new EventTarget();target.document=new EventTarget();target.document.hidden=false;
  const entries=[{state:{tab:'today'},url:'https://app.86chaos.com/?tab=today'}];let index=0;
  target.location={href:entries[0].url};
  target.history={get state(){return entries[index].state;},pushState(state,_,url){entries.splice(index+1);entries.push({state,url});index++;target.location.href=url;},replaceState(state,_,url){entries[index]={state,url};},back(){queueMicrotask(()=>{if(!index)return;index--;const event=new Event('popstate');event.state=entries[index].state;target.dispatchEvent(event);});}};
  let warnings=0,exits=0,time=100,transient=false;
  const options={target,warn:()=>warnings++,exit:()=>exits++,now:()=>time,closeTransient:()=>{if(transient){transient=false;return true;}return false;}};
  return {target,options,counts:()=>({warnings,exits}),time:value=>time=value,modal:()=>transient=true};
}
test('Android Back returns to previous app screen and preserves route state before considering exit',async()=>{
  const h=harness(),{installNativeBackController}=await load(),dispose=installNativeBackController(h.options);
  h.target.history.pushState({tab:'prep'},'','?tab=prep');h.target.history.pushState({tab:'settings'},'','?tab=settings');
  h.target.__CHAOS_NATIVE_BACK_HANDLER__();await new Promise(setImmediate);
  assert.equal(h.target.history.state.tab,'prep');assert.deepEqual(h.counts(),{warnings:0,exits:0});dispose();
});
test('first root Back warns, second within two seconds exits exactly once',async()=>{
  const h=harness(),{installNativeBackController}=await load(),dispose=installNativeBackController(h.options);
  h.target.__CHAOS_NATIVE_BACK_HANDLER__();assert.deepEqual(h.counts(),{warnings:1,exits:0});
  h.time(2000);h.target.__CHAOS_NATIVE_BACK_HANDLER__();assert.deepEqual(h.counts(),{warnings:1,exits:1});dispose();
});
test('expired exit warning requires a new first press',async()=>{
  const h=harness(),{installNativeBackController}=await load(),dispose=installNativeBackController(h.options);
  h.target.__CHAOS_NATIVE_BACK_HANDLER__();h.time(2101);h.target.__CHAOS_NATIVE_BACK_HANDLER__();
  assert.deepEqual(h.counts(),{warnings:2,exits:0});dispose();
});
test('closing a transient panel consumes Back and disarms a previous exit warning',async()=>{
  const h=harness(),{installNativeBackController}=await load(),dispose=installNativeBackController(h.options);
  h.target.__CHAOS_NATIVE_BACK_HANDLER__();h.modal();h.target.__CHAOS_NATIVE_BACK_HANDLER__();h.target.__CHAOS_NATIVE_BACK_HANDLER__();
  assert.deepEqual(h.counts(),{warnings:2,exits:0});dispose();
});
test('new navigation and app backgrounding cancel an armed exit',async()=>{
  const h=harness(),{installNativeBackController}=await load(),dispose=installNativeBackController(h.options);
  h.target.__CHAOS_NATIVE_BACK_HANDLER__();h.target.document.hidden=true;h.target.document.dispatchEvent(new Event('visibilitychange'));
  h.target.__CHAOS_NATIVE_BACK_HANDLER__();assert.deepEqual(h.counts(),{warnings:2,exits:0});
  h.target.history.pushState({tab:'prep'},'','?tab=prep');h.target.__CHAOS_NATIVE_BACK_HANDLER__();h.target.__CHAOS_NATIVE_BACK_HANDLER__();await new Promise(setImmediate);
  assert.equal(h.target.history.state.tab,'today');assert.equal(h.counts().exits,0);dispose();
});
test('disposing native Back restores history methods and removes the bridge callback',async()=>{
  const h=harness(),push=h.target.history.pushState,replace=h.target.history.replaceState,{installNativeBackController}=await load();
  const dispose=installNativeBackController(h.options);dispose();
  assert.equal(h.target.history.pushState,push);assert.equal(h.target.history.replaceState,replace);assert.equal(h.target.__CHAOS_NATIVE_BACK_HANDLER__,undefined);
});
