'use strict';

// Firestore emulator 1.22 does not cancel upstream watch targets when a
// WebChannel closes. Explicit local navigation must unsubscribe before closing
// the document. Live web and native Firebase never install this lifecycle.
function createEmulatorNavigationLifecycle({ target, projectId, hostname, failClosed, settleWrites, unmount, releaseListeners, pauseSubscriptions, resumeSubscriptions }) {
  if (target !== 'EMULATOR') return null;
  if (projectId !== 'demo-86chaos' || !failClosed || !['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname)) {
    throw new Error('Emulator navigation requires the fail-closed local demo project');
  }
  let pending;
  return Object.freeze({
    projectId,
    async pause() {
      if (pending) throw new Error('Cannot suspend subscriptions after document teardown');
      if (typeof pauseSubscriptions !== 'function') throw new Error('Local subscription suspension is missing');
      await settleWrites();
      pauseSubscriptions();
      return { projectId, paused: true };
    },
    resume() {
      if (pending) throw new Error('Cannot resume subscriptions after document teardown');
      if (typeof resumeSubscriptions !== 'function') throw new Error('Local subscription resumption is missing');
      resumeSubscriptions();
      return { projectId, resumed: true };
    },
    prepare() {
      // Keep both rejection and completion: teardown must never be retried or
      // proceed past failed writes. A new document creates a new lifecycle.
      if (!pending) pending = (async () => {
        await settleWrites();
        unmount();
        releaseListeners({ all: true });
        return { projectId, unmounted: true };
      })();
      return pending;
    },
  });
}
module.exports = { createEmulatorNavigationLifecycle };
