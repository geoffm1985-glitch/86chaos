const { test } = require('node:test');
const assert = require('node:assert/strict');
const { installPwaCloseWatcher } = require('../src/core/pwaCloseWatcher.js');

function fixture(options = {}) {
  const instances = [], timers = new Map(), warnings = [];
  let seq = 0;
  class Watcher extends EventTarget {
    constructor() { super(); this.active = true; instances.push(this); }
    destroy() { this.active = false; }
    back() { if (this.active) { this.active = false; this.dispatchEvent(new Event('close')); } }
  }
  const target = { CloseWatcher: Watcher, setTimeout(fn) { timers.set(++seq, fn); return seq; }, clearTimeout(id) { timers.delete(id); } };
  const state = { armed: false, timer: null, exiting: false };
  const controller = installPwaCloseWatcher({ target, state, onWarn: () => warnings.push('warn'), ...options });
  const expire = () => { for (const [id, fn] of [...timers]) { timers.delete(id); fn(); } };
  return { instances, timers, warnings, state, controller, expire };
}
test('first platform Back warns without requiring a page interaction', () => {
  const f = fixture(); f.instances[0].back();
  assert.deepEqual(f.warnings, ['warn']); assert.equal(f.state.armed, true);
});
test('second Back is not intercepted while the exit warning is armed', () => {
  const f = fixture(); f.instances[0].back(); f.instances[0].back();
  assert.equal(f.instances.filter(w => w.active).length, 0); assert.equal(f.instances.length, 1); assert.equal(f.warnings.length, 1);
});
test('expired exit window restores a single warning watcher', () => {
  const f = fixture(); f.instances[0].back(); f.expire();
  assert.equal(f.state.armed, false); assert.equal(f.instances.filter(w => w.active).length, 1);
  f.instances[1].back(); assert.equal(f.warnings.length, 2);
});
test('navigation disarms a pending exit and cancels its timer', () => {
  const f = fixture(); f.instances[0].back(); f.controller.reset();
  assert.equal(f.state.armed, false); assert.equal(f.timers.size, 0); assert.equal(f.instances.filter(w => w.active).length, 1);
});
test('reset does not stack watchers during ordinary navigation', () => {
  const f = fixture(); f.controller.reset(); f.controller.reset(); assert.equal(f.instances.length, 1);
});
test('Back closes transient UI before warning about app exit', () => {
  let open = true;
  const f = fixture({ closeTransientUi: () => { if (!open) return false; open = false; return true; } });
  f.instances[0].back(); assert.equal(open, false); assert.equal(f.warnings.length, 0); assert.equal(f.state.armed, false);
  f.instances[1].back(); assert.equal(f.warnings.length, 1);
});
test('effect cleanup destroys watcher and pending timer', () => {
  const f = fixture(); f.instances[0].back(); f.controller.destroy(); f.expire();
  assert.equal(f.timers.size, 0); assert.equal(f.instances.length, 1); f.controller.reset(); assert.equal(f.instances.length, 1);
});
test('unsupported or unavailable CloseWatcher leaves the history fallback available', () => {
  assert.equal(installPwaCloseWatcher({ target: {}, state: {} }), null);
  assert.equal(installPwaCloseWatcher({ target: { CloseWatcher: class { constructor() { throw Error('Unavailable'); } } }, state: {} }), null);
});
