'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { bootstrapAcknowledgment } = require('../scripts/yardmaster-readiness.cjs');
const { dependencyInstall } = require('../scripts/86chaos-release-gate/yardmaster-dependency-install.cjs');
const { getFirebaseTarget } = require('../scripts/86chaos-firebase-target.cjs');

const managedEnv = { YARDMASTER_FIREBASE_TARGET: 'emulator', YARDMASTER_FIREBASE_PROJECT: 'demo-86chaos', CHAOS_BLOCK_LIVE_FIREBASE: '1' };
function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ym-bootstrap-'));
  fs.mkdirSync(path.join(root, 'scripts', '86chaos-release-gate'), { recursive: true });
  fs.writeFileSync(path.join(root, 'yardmaster.firebase.json'), JSON.stringify({ projectId: 'demo-86chaos', localApp: { url: 'http://127.0.0.1:3000', readyPath: '/api/firebase-target' } }));
  return root;
}

test('17.0.63 pending readiness exposes only the pinned local emulator bootstrap identity', () => {
  const target = getFirebaseTarget({ YARDMASTER_FIREBASE_TARGET: 'emulator' });
  assert.deepEqual(bootstrapAcknowledgment(target, true), { target: 'emulator', projectId: 'demo-86chaos', blockLiveFirebase: true });
  assert.throws(() => bootstrapAcknowledgment(getFirebaseTarget({}), true), /not pinned/);
  assert.throws(() => bootstrapAcknowledgment(target, false), /live Firebase blocked/);
});

test('17.0.63 dependency gate does not deadlock on verified 503 browser-readiness bootstrap', async (t) => {
  const root = tempRoot();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  let command = null;
  const code = await dependencyInstall({
    root, env: managedEnv,
    request: async () => ({ ok: false, status: 503, json: async () => ({ target: 'emulator', projectId: 'demo-86chaos', blockLiveFirebase: true, ready: false, error: 'Browser executable is not installed yet.' }) }),
    run: (exe, args) => { command = args; return { status: 0 }; },
  });
  assert.equal(code, 0);
  assert.ok(command[0].endsWith('dependency-preflight.cjs'));
  assert.ok(!command.includes('ci'), 'must not run npm ci against the active Yardmaster app');
});

test('17.0.63 dependency gate still fails closed for non-isolated or unrelated readiness failures', async (t) => {
  const root = tempRoot();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  await assert.rejects(() => dependencyInstall({ root, env: managedEnv, request: async () => ({ ok: false, status: 503, json: async () => ({ target: 'live', projectId: 'cheers-34b8d', blockLiveFirebase: false, ready: false }) }), run: () => assert.fail('must not execute') }), /did not acknowledge emulator isolation/);
  await assert.rejects(() => dependencyInstall({ root, env: managedEnv, request: async () => ({ ok: false, status: 500, json: async () => ({ target: 'emulator', projectId: 'demo-86chaos', blockLiveFirebase: true, ready: false }) }), run: () => assert.fail('must not execute') }), /readiness request failed/);
});
