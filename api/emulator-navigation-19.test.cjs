'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { createEmulatorNavigationLifecycle: create } = require('../src/core/emulatorNavigation.shared.js');
const { createTargetTracker } = require('../tests/fixtures/emulator-navigation.cjs');
const config = { target: 'EMULATOR', projectId: 'demo-86chaos', hostname: '127.0.0.1', failClosed: true };
test('live and native targets never acquire emulator navigation teardown', () => {
  assert.equal(create({ target: 'LIVE' }), null);
});
test('emulator teardown refuses production, foreign hosts and missing fail-closed evidence', () => {
  for (const patch of [{ projectId: 'cheers-34b8d' }, { projectId: 'chaos-test-d1601' }, { hostname: 'testing.86chaos.com' }, { failClosed: false }]) assert.throws(() => create({ ...config, ...patch }));
});
test('pending writes settle before unmount and listener removal; repeated teardown shares one result', async () => {
  const events = []; let release;
  const hook = create({ ...config, settleWrites: () => new Promise(resolve => { release = resolve; }), unmount: () => events.push('unmounted'), releaseListeners: boundary => { assert.deepEqual(boundary, { all: true }); events.push('released'); } });
  const first = hook.prepare(); assert.equal(hook.prepare(), first); assert.deepEqual(events, []);
  release(); await first; assert.deepEqual(events, ['unmounted', 'released']);
  await hook.prepare(); assert.equal(events.length, 2);
});
test('failed writes and unknown teardown errors stay fatal and are never retried', async () => {
  for (const stage of ['writes', 'unmount', 'release']) {
    let attempts = 0; const fail = () => { attempts++; throw new Error('owned failure'); };
    const hook = create({ ...config, settleWrites: stage === 'writes' ? fail : async () => {}, unmount: stage === 'unmount' ? fail : () => {}, releaseListeners: stage === 'release' ? fail : () => {} });
    await assert.rejects(hook.prepare(), /owned failure/); await assert.rejects(hook.prepare(), /owned failure/); assert.equal(attempts, 1);
  }
});
function request(message, { sid = 'owned-channel', status = 200, project = 'demo-86chaos' } = {}) {
  return { url: () => `http://127.0.0.1:8080/google.firestore.v1.Firestore/Listen/channel?database=projects%2F${project}%2Fdatabases%2F(default)&SID=${sid}`, method: () => 'POST', postData: () => new URLSearchParams({ req0___data__: JSON.stringify(message) }).toString(), response: async () => ({ status: () => status }) };
}
test('real protocol target IDs are tracked by channel; removal requires a successful forward response', async () => {
  const tracker = createTargetTracker();
  tracker.request(request({ addTarget: { targetId: 2 } })); tracker.request(request({ addTarget: { targetId: 2 } }, { sid: 'second' }));
  tracker.request(request({ removeTarget: 2 })); await Promise.all([...tracker.pending]); assert.equal(tracker.evidence().active, 1);
  tracker.request(request({ removeTarget: 2 }, { sid: 'second' })); await Promise.all([...tracker.pending]);
  assert.deepEqual(tracker.evidence(), { added: 2, removed: 2, active: 0, pending: 0, failure: false });
});
test('foreign project, malformed protocol and non-200 target removal fail closed', async () => {
  for (const req of [request({ addTarget: { targetId: 2 } }, { project: 'cheers-34b8d' }), request({ removeTarget: 'bad' }), request({ removeTarget: 2 }, { status: 503 })]) {
    const tracker = createTargetTracker(); tracker.request(req); await Promise.all([...tracker.pending]); assert.equal(tracker.evidence().failure, true);
  }
});

function capturedRequest(record, responseText) {
  const sid=record.session ? `owned-session-${record.session}` : '';
  const text=new URLSearchParams(record.messages.map((m,i)=>[`req${i}___data__`,JSON.stringify(m.add!==undefined?{addTarget:{targetId:m.add}}:{removeTarget:m.remove})])).toString();
  const connected=`owned-session-${record.responseSession}`;
  const frame=JSON.stringify([[0,['c',connected,'',8]]]);
  return {url:()=>`http://127.0.0.1:8080/google.firestore.v1.Firestore/Listen/channel?database=projects%2Fdemo-86chaos%2Fdatabases%2F(default)${sid?'&SID='+sid:''}`,method:()=> 'POST',postData:()=>text,response:async()=>({status:()=>record.status,text:async()=>responseText===undefined?frame.length+'\n'+frame:await responseText})};
}
const captured=require('../test-tools/fixtures/firestore-initial-listen-protocol-19.json');
for(const [index,trace] of captured.entries())test(`captured failed-run protocol ${index+1} maps the initial target to its assigned session without losing acknowledgments`,async()=>{
  const tracker=createTargetTracker();
  for(const record of trace.requests){tracker.request(capturedRequest(record));await Promise.all([...tracker.pending]);}
  const proof=tracker.evidence();assert(proof.added>0);assert(proof.removed>0);assert.equal(proof.active,0);assert.equal(proof.pending,0);assert.equal(proof.failure,false);
});
test('a target removed before the initial handshake body resolves must not be resurrected',async()=>{
  let release;const body=new Promise(resolve=>release=resolve),tracker=createTargetTracker();
  tracker.request(capturedRequest({session:0,responseSession:1,messages:[{add:2}],status:200},body));
  tracker.request(capturedRequest({session:1,messages:[{remove:2}],status:200}));
  const frame=JSON.stringify([[0,['c','owned-session-1','',8]]]);release(frame.length+'\n'+frame);
  await Promise.all([...tracker.pending]);assert.equal(tracker.evidence().active,0);assert.equal(tracker.evidence().failure,false);
});
test('overlapping handshakes with the same target ID remain isolated by their actual sessions',async()=>{
  const tracker=createTargetTracker();
  for(const session of [1,2])tracker.request(capturedRequest({session:0,responseSession:session,messages:[{add:2}],status:200}));
  await Promise.all([...tracker.pending]);assert.equal(tracker.evidence().active,2);
  tracker.request(capturedRequest({session:1,messages:[{remove:2}],status:200}));await Promise.all([...tracker.pending]);assert.equal(tracker.evidence().active,1);
  tracker.request(capturedRequest({session:2,messages:[{remove:2}],status:200}));await Promise.all([...tracker.pending]);assert.equal(tracker.evidence().active,0);
});
test('missing, ambiguous or malformed successful handshake bodies remain fatal',async()=>{
  const ambiguous=JSON.stringify([[0,['c','one']],[1,['c','two']]]);
  for(const text of ['{}','5\n[]',ambiguous.length+'\n'+ambiguous]){
    const tracker=createTargetTracker();tracker.request(capturedRequest({session:0,responseSession:1,messages:[{add:2}],status:200},text));await Promise.all([...tracker.pending]);assert.equal(tracker.evidence().failure,true);
  }
});

test('only a completed explicit fixture abort can retire an initial read add never accepted by the server',async()=>{
 const tracker=createTargetTracker(),req=request({addTarget:{targetId:2}},{sid:''});req.response=async()=>null;
 tracker.request(req);await tracker.abortReadRequest(req,async()=>{});await Promise.all([...tracker.pending]);
 assert.deepEqual(tracker.evidence(),{added:1,removed:0,active:0,pending:0,failure:false,intentionallyAbortedAdds:1});
});
test('unknown aborts and actual non-200 responses remain fatal even when an abort was declared',async()=>{
 for(const marked of [false,true]){
  const tracker=createTargetTracker(),req=request({addTarget:{targetId:2}},{status:503});if(!marked)req.response=async()=>null;
  tracker.request(req);if(marked)await tracker.abortReadRequest(req,async()=>{});await Promise.all([...tracker.pending]);assert.equal(tracker.evidence().failure,true);
 }
});
test('explicit read fault never waives any target-removal acknowledgment',async()=>{
 const tracker=createTargetTracker(),req=request({removeTarget:2});assert.throws(()=>tracker.abortReadRequest(req,async()=>{}));assert.equal(tracker.evidence().failure,true);
});
test('explicit fault cannot discard an already acknowledged server target',async()=>{
 const tracker=createTargetTracker();tracker.request(request({addTarget:{targetId:2}}));await Promise.all([...tracker.pending]);
 assert.throws(()=>tracker.abortReadRequest(request({addTarget:{targetId:2}}),async()=>{}));assert.equal(tracker.evidence().failure,true);assert.equal(tracker.evidence().active,1);
});
test('failed fault injection remains fatal rather than manufacturing successful cancellation evidence',async()=>{
 const tracker=createTargetTracker(),req=request({addTarget:{targetId:2}});req.response=async()=>null;tracker.request(req);
 await assert.rejects(tracker.abortReadRequest(req,async()=>{throw new Error('owned abort failure');}));await Promise.all([...tracker.pending]);assert.equal(tracker.evidence().failure,true);
});
test('late completion of an intentional aborted add cannot erase a later accepted command',async()=>{
 let release;const tracker=createTargetTracker(),req=request({addTarget:{targetId:2}});req.response=()=>new Promise(resolve=>release=resolve);
 tracker.request(req);await tracker.abortReadRequest(req,async()=>{});tracker.request(request({addTarget:{targetId:2}}));
 await new Promise(resolve=>setImmediate(resolve));release(null);await Promise.all([...tracker.pending]);assert.equal(tracker.evidence().active,1);assert.equal(tracker.evidence().failure,false);
 tracker.request(request({removeTarget:2}));await Promise.all([...tracker.pending]);assert.equal(tracker.evidence().active,0);
});
test('foreign, malformed or mutation-like fault descriptions cannot acquire an intentional read classification',()=>{
 for(const req of [request({addTarget:{targetId:2}},{project:'cheers-34b8d'}),request({removeTarget:2}),{...request({addTarget:{targetId:2}}),postData:()=> 'req0___data__=invalid'}]){
  const tracker=createTargetTracker();assert.throws(()=>tracker.abortReadRequest(req,async()=>{}));assert.equal(tracker.evidence().failure,true);
 }
});
