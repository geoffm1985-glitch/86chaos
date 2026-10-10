'use strict';

// Android can skip history entries created before any user gesture. A platform
// close request handles the first Back even immediately after launch/reload.
function installPwaCloseWatcher({ target, state, windowMs = 2000, onWarn, closeTransientUi = () => false }) {
  if (typeof target?.CloseWatcher !== 'function') return null;
  let watcher = null;
  let disposed = false;
  const clearTimer = () => {
    if (state.timer !== null) target.clearTimeout(state.timer);
    state.timer = null;
  };
  const arm = () => {
    if (disposed || watcher || state.exiting) return;
    watcher = new target.CloseWatcher();
    watcher.addEventListener('close', () => {
      watcher = null; // A close request consumes the watcher; do not cancel it.
      if (disposed) return;
      clearTimer();
      if (closeTransientUi()) {
        state.armed = false;
        arm();
        return;
      }
      state.armed = true;
      onWarn();
      // Leave the next Back to Android. Only restore the warning after expiry.
      state.timer = target.setTimeout(() => {
        state.timer = null;
        state.armed = false;
        arm();
      }, windowMs);
    });
  };
  try { arm(); } catch (_) { return null; }
  return {
    reset() {
      clearTimer();
      state.armed = false;
      state.exiting = false;
      arm();
    },
    destroy() {
      disposed = true;
      clearTimer();
      watcher?.destroy();
      watcher = null;
    }
  };
}

module.exports = { installPwaCloseWatcher };
