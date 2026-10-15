'use strict';
// One contract for packaged clients, browsers and server preflights.
function assertDeploymentBoundary(input = {}) {
  const projectId = String(input.projectId || '').trim();
  const host = String(input.hostname || '').toLowerCase();
  const testing = !input.native && (input.branch === 'testing' || host === 'testing.86chaos.com' || /^86chaos-git-testing-.*\.vercel\.app$/.test(host));
  const expected = input.emulator ? 'demo-86chaos' : input.native ? 'cheers-34b8d' : testing ? 'chaos-test-d1601' : projectId;
  const refuse = () => { throw Object.assign(new Error('Firebase environment boundary mismatch. No operation was performed.'), { code: 'firebase_environment_mismatch', statusCode: 403 }); };
  if (!expected || projectId !== expected) refuse();
  if (!input.emulator) {
    for (const key of ['authDomain', 'storageBucket', 'databaseURL']) {
      if (input[key]) {
        const value = String(input[key]).toLowerCase();
        const allowed = key === 'authDomain'
          ? [`${expected}.firebaseapp.com`, `${expected}.web.app`]
          : key === 'storageBucket'
            ? [`${expected}.appspot.com`, `${expected}.firebasestorage.app`]
            : [`https://${expected}-default-rtdb.firebaseio.com`, `https://${expected}-default-rtdb.firebaseio.com/`];
        if (!allowed.includes(value)) refuse();
      }
    }
    if (input.native && input.apiBaseUrl && new URL(input.apiBaseUrl).origin !== 'https://app.86chaos.com') refuse();
  }
  return { projectId, environment: input.emulator ? 'emulator' : expected === 'chaos-test-d1601' ? 'testing' : 'production', native: Boolean(input.native) };
}
Object.defineProperty(globalThis, '__86ChaosDeploymentBoundary', { value: { assertDeploymentBoundary }, configurable: true });
