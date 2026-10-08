const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { dependencyInstall } = require('../../scripts/86chaos-release-gate/yardmaster-dependency-install.cjs');

const env = { YARDMASTER_FIREBASE_TARGET: 'emulator', YARDMASTER_FIREBASE_PROJECT: 'demo-86chaos', CHAOS_BLOCK_LIVE_FIREBASE: '1' };
function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ym-pw-bootstrap-'));
  fs.mkdirSync(path.join(root, 'scripts', '86chaos-release-gate'), { recursive: true });
  fs.writeFileSync(path.join(root, 'yardmaster.firebase.json'), JSON.stringify({ projectId: 'demo-86chaos', localApp: { url: 'http://127.0.0.1:3000', readyPath: '/api/firebase-target' } }));
  return root;
}

test.describe('17.0.63 Yardmaster dependency/readiness bootstrap', () => {
  test('verified 503 bootstrap proceeds to dependency preflight instead of blocking before Playwright', async () => {
    const root = fixtureRoot();
    try {
      let args = [];
      const code = await dependencyInstall({
        root, env,
        request: async () => ({ ok: false, status: 503, json: async () => ({ target: 'emulator', projectId: 'demo-86chaos', blockLiveFirebase: true, ready: false, error: 'browser readiness pending' }) }),
        run: (exe, value) => { args = value; return { status: 0 }; },
      });
      expect(code).toBe(0);
      expect(args[0]).toContain('dependency-preflight.cjs');
      expect(args).not.toContain('ci');
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  test('503 bootstrap without pinned emulator identity remains blocked', async () => {
    const root = fixtureRoot();
    try {
      await expect(dependencyInstall({
        root, env,
        request: async () => ({ ok: false, status: 503, json: async () => ({ target: 'emulator', projectId: 'wrong-project', blockLiveFirebase: true, ready: false }) }),
        run: () => { throw new Error('must not execute'); },
      })).rejects.toThrow(/did not acknowledge emulator isolation/);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
});
