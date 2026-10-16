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
