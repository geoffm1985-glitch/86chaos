(function(root) {
  'use strict';
  function createEmulatorSubscriptions({ target, native = false, projectId, hostname, failClosed, subscribe } = {}) {
    if (target !== 'EMULATOR' || native) return null;
    if (projectId !== 'demo-86chaos' || !failClosed || !['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname) || typeof subscribe !== 'function') {
      throw new Error('Local subscription lifecycle requires the fail-closed loopback demo project');
    }
    const entries = new Set();
    let paused = false, failure;
    const check = () => { if (failure) throw failure; };
    const attach = entry => {
      try { entry.release = subscribe(...entry.args); }
      catch (error) { failure = error; throw error; }
      if (typeof entry.release !== 'function') {
        failure = new Error('Local SDK subscription did not return its unsubscribe function');
        throw failure;
      }
    };
    const detach = entry => {
      const release = entry.release;
      entry.release = null;
      if (release) {
        try { release(); }
        catch (error) { failure = error; throw error; }
      }
    };
    return Object.freeze({
      subscribe(...args) {
        check();
        if (args[0]?.firestore?.app?.options?.projectId !== projectId) throw new Error('Local subscription reference escaped the demo project');
        const entry = { args, release: null };
        entries.add(entry);
        try { if (!paused) attach(entry); }
        catch (error) { entries.delete(entry); throw error; }
        return () => {
          if (!entries.delete(entry)) return;
          detach(entry);
        };
      },
      pause() {
        check();
        if (paused) return;
        paused = true;
        let first;
        for (const entry of [...entries]) {
          try { detach(entry); } catch (error) { first ||= error; }
        }
        if (first) throw first;
      },
      resume() {
        check();
        if (!paused) return;
        paused = false;
        for (const entry of [...entries]) if (entries.has(entry)) attach(entry);
      },
      evidence: () => ({ registered: entries.size, attached: [...entries].filter(entry => entry.release).length, paused, failed: !!failure }),
    });
  }
  const api = { createEmulatorSubscriptions };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.__86ChaosEmulatorSubscriptionsShared = api;
})(globalThis);
