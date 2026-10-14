export function installNativeBackController({ target, warn, exit, closeTransient = () => false, now = Date.now, windowMs = 2000 }) {
  const history = target.history;
  const originalPush = history.pushState;
  const originalReplace = history.replaceState;
  let depth = Number.isInteger(history.state?.chaosNativeDepth) ? history.state.chaosNativeDepth : 0;
  let armedUntil = 0;
  let navigating = false;
  const reset = () => { armedUntil = 0; };
  const stateWithDepth = (state, value) => ({ ...(state && typeof state === 'object' ? state : {}), chaosNativeDepth: value });
  originalReplace.call(history, stateWithDepth(history.state, depth), '', target.location.href);
  const push = function (state, ...args) {
    originalPush.call(history, stateWithDepth(state, depth + 1), ...args);
    depth += 1; reset();
  };
  const replace = function (state, ...args) { originalReplace.call(history, stateWithDepth(state, depth), ...args); };
  history.pushState = push;
  history.replaceState = replace;
  const popped = event => { depth = Number.isInteger(event.state?.chaosNativeDepth) ? event.state.chaosNativeDepth : 0; navigating = false; reset(); };
  const visibility = () => { if (target.document.hidden) reset(); };
  const back = () => {
    if (navigating) return;
    if (closeTransient()) { reset(); return; }
    if (depth > 0) { reset(); navigating = true; history.back(); return; }
    const time = now();
    if (armedUntil > 0 && time <= armedUntil) { reset(); exit(); return; }
    armedUntil = time + windowMs;
    warn();
  };
  const priorHandler = target.__CHAOS_NATIVE_BACK_HANDLER__;
  target.__CHAOS_NATIVE_BACK_HANDLER__ = back;
  target.addEventListener('popstate', popped);
  target.document.addEventListener('visibilitychange', visibility);
  return () => {
    if (history.pushState === push) history.pushState = originalPush;
    if (history.replaceState === replace) history.replaceState = originalReplace;
    if (target.__CHAOS_NATIVE_BACK_HANDLER__ === back) {
      if (priorHandler) target.__CHAOS_NATIVE_BACK_HANDLER__ = priorHandler;
      else delete target.__CHAOS_NATIVE_BACK_HANDLER__;
    }
    target.removeEventListener('popstate', popped);
    target.document.removeEventListener('visibilitychange', visibility);
    reset();
  };
}
