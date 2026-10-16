'use strict';
const { expect } = require('@playwright/test');
const trackers = new WeakMap();
function createTargetTracker({ project = 'demo-86chaos', port = 8080 } = {}) {
  const active = new Set(), pending = new Set();
  let failure = false, added = 0, removed = 0;
  function request(request) {
    const url = new URL(request.url());
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.port !== String(port) ||
        url.pathname !== '/google.firestore.v1.Firestore/Listen/channel' || request.method() !== 'POST') return;
    if (url.searchParams.get('database') !== `projects/${project}/databases/(default)`) {
      failure = true; return;
    }
    let changed = false;
    for (const [key, value] of new URLSearchParams(request.postData() || '')) {
      if (!/^req\d+___data__$/.test(key)) continue;
      try {
        const message = JSON.parse(value), id = message.addTarget?.targetId ?? message.removeTarget;
        if (id === undefined) continue;
        if (!Number.isInteger(id)) throw new Error('Invalid target');
        const target = `${url.searchParams.get('SID') || ''}:${id}`;
        if (message.addTarget) { active.add(target); added++; }
        else { active.delete(target); removed++; }
        changed = true;
      } catch (_) { failure = true; }
    }
    if (changed) {
      const ack = request.response().then(response => {
        if (!response || response.status() !== 200) failure = true;
      }, () => { failure = true; });
      pending.add(ack); ack.then(() => pending.delete(ack));
    }
  }
  return { request, active, pending, evidence: () => ({ added, removed, active: active.size, pending: pending.size, failure }) };
}
async function drainEmulatorPage(page) {
  const tracker = trackers.get(page);
  if (!tracker || page.isClosed()) return { applicable: false };
  const lifecycle = await page.evaluate(async () => {
    const hook = window.__CHAOS_EMULATOR_NAVIGATION__;
    if (!hook) {
      if (window.__CHAOS_FIREBASE_DIAGNOSTICS__?.target === 'EMULATOR') throw new Error('Local emulator navigation lifecycle is missing');
      return null;
    }
    const d = window.__CHAOS_FIREBASE_DIAGNOSTICS__;
    if (d?.target !== 'EMULATOR' || d.projectId !== 'demo-86chaos' || !d.failClosed) throw new Error('Local emulator navigation boundary mismatch');
    return hook.prepare();
  });
  if (!lifecycle) return { applicable: false };
  // A transport failure stays fatal. These are original expectation limits;
  // teardown adds no sleep, retry, network disabling or runtime exception.
  await expect.poll(() => tracker.evidence(), { timeout: 12000 }).toMatchObject({ active: 0, pending: 0, failure: false });
  return { applicable: true, ...tracker.evidence() };
}
function installEmulatorPage(page) {
  if (trackers.has(page)) return;
  const tracker = createTargetTracker(); trackers.set(page, tracker);
  page.on('request', tracker.request);
  for (const method of ['reload', 'goto', 'close']) {
    const original = page[method].bind(page);
    page[method] = async (...args) => { await drainEmulatorPage(page); return original(...args); };
  }
}
module.exports = { createTargetTracker, installEmulatorPage, drainEmulatorPage };
