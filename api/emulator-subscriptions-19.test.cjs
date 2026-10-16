'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createEmulatorSubscriptions:create}=require('../src/core/emulatorSubscriptions.shared.js');
const {createEmulatorNavigationLifecycle:createNavigation}=require('../src/core/emulatorNavigation.shared.js');
const config={target:'EMULATOR',projectId:'demo-86chaos',hostname:'127.0.0.1',failClosed:true};
const ref=()=>({firestore:{app:{options:{projectId:'demo-86chaos'}}}});
test('live and native snapshots retain the SDK path without acquiring a registry',()=>{
 assert.equal(create({target:'LIVE'}),null);assert.equal(create({...config,native:true}),null);
});
test('subscription registry rejects foreign hosts/projects, missing boundary and foreign references',()=>{
 for(const patch of [{hostname:'app.86chaos.com'},{projectId:'cheers-34b8d'},{failClosed:false}])assert.throws(()=>create({...config,...patch,subscribe:()=>()=>{}}));
 const registry=create({...config,subscribe:()=>()=>{}});assert.throws(()=>registry.subscribe({firestore:{app:{options:{projectId:'cheers-34b8d'}}}}));assert.equal(registry.evidence().registered,0);
});
test('pause releases actual SDK handles and resumes identical references/options/callbacks',()=>{
 const calls=[],released=[];const registry=create({...config,subscribe:(...args)=>{calls.push(args);const i=calls.length;return()=>released.push(i);}});
 const a=[ref(),{includeMetadataChanges:true},()=>{}],b=[ref(),()=>{},()=>{}];const stopA=registry.subscribe(...a),stopB=registry.subscribe(...b);
 registry.pause();registry.pause();assert.deepEqual(released,[1,2]);assert.deepEqual(registry.evidence(),{registered:2,attached:0,paused:true,failed:false});
 registry.resume();registry.resume();assert.equal(calls.length,4);assert.deepEqual(calls[2],a);assert.deepEqual(calls[3],b);stopA();stopA();stopB();assert.deepEqual(released,[1,2,3,4]);assert.equal(registry.evidence().registered,0);
});
test('unsubscribed paused entries stay removed; new paused entries attach only on resume',()=>{
 let calls=0;const registry=create({...config,subscribe:()=>{calls++;return()=>{};}});
 const first=registry.subscribe(ref());registry.pause();first();const second=registry.subscribe(ref());assert.equal(calls,1);registry.resume();assert.equal(calls,2);second();assert.equal(registry.evidence().registered,0);
});
test('pause completes other owned releases but retains every unsubscribe error as fatal',()=>{
 const boom=new Error('owned release failure');let released=0;const registry=create({...config,subscribe:()=>{const i=++released;return()=>{if(i===1)throw boom;released++;};}});
 registry.subscribe(ref());registry.subscribe(ref());assert.throws(()=>registry.pause(),e=>e===boom);assert.equal(released,3);assert.throws(()=>registry.resume(),e=>e===boom);assert.throws(()=>registry.subscribe(ref()),e=>e===boom);assert.equal(registry.evidence().failed,true);
});
test('failed subscription/resumption is never retried or replaced by successful evidence',()=>{
 const boom=new Error('owned attach failure');let calls=0;const registry=create({...config,subscribe:()=>{if(++calls===2)throw boom;return()=>{};}});
 registry.subscribe(ref());registry.pause();assert.throws(()=>registry.resume(),e=>e===boom);assert.throws(()=>registry.resume(),e=>e===boom);assert.equal(calls,2);assert.equal(registry.evidence().failed,true);
});
test('navigation suspends after settled writes without unmounting; final teardown cannot resume',async()=>{
 const events=[];const hook=createNavigation({...config,settleWrites:async()=>events.push('settled'),pauseSubscriptions:()=>events.push('paused'),resumeSubscriptions:()=>events.push('resumed'),unmount:()=>events.push('unmounted'),releaseListeners:()=>events.push('released')});
 await hook.pause();hook.resume();assert.deepEqual(events,['settled','paused','resumed']);await hook.prepare();assert.deepEqual(events,['settled','paused','resumed','settled','unmounted','released']);assert.throws(()=>hook.resume());await assert.rejects(hook.pause());
});
