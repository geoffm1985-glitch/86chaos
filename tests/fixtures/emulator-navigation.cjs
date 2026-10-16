'use strict';
const { expect } = require('@playwright/test');
const trackers = new WeakMap();
function handshakeSession(text) {
  // WebChannel's initial POST returns length-prefixed JSON frames. Its first
  // target predates SID assignment; only the real acknowledged connect frame
  // can associate that provisional target with subsequent forward requests.
  const sessions=[];let cursor=0;
  while(text.slice(cursor).trim()) {
    const newline=text.indexOf('\n',cursor),length=text.slice(cursor,newline).trim();
    if(newline<0 || !/^\d+$/.test(length))throw new Error('Invalid local listen handshake framing');
    const begin=newline+1,end=begin+Number(length);
    if(end>text.length || end<=begin)throw new Error('Incomplete local listen handshake frame');
    const messages=JSON.parse(text.slice(begin,end));
    if(!Array.isArray(messages))throw new Error('Invalid local listen handshake messages');
    for(const entry of messages)if(Array.isArray(entry?.[1]) && entry[1][0]==='c')sessions.push(entry[1][1]);
    cursor=end;
  }
  if(sessions.length!==1 || typeof sessions[0]!=='string' || !sessions[0])throw new Error('Unverified local listen session');
  return sessions[0];
}
function createTargetTracker({ project = 'demo-86chaos', port = 8080 } = {}) {
  const active = new Set(), pending = new Set();
  const intentionalAborts = new WeakMap();
  const acknowledged = new Map();
  const latest=new Map();let sequence=0,initial=0;
  let failure = false, added = 0, removed = 0, intentionallyAbortedAdds = 0;
  function abortReadRequest(request, abort) {
    const url = new URL(request.url());
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.port !== String(port) || url.pathname !== '/google.firestore.v1.Firestore/Listen/channel') {
      failure = true; throw new Error('Intentional local read fault escaped its loopback endpoint');
    }
    if (request.method() === 'POST') {
      if (url.searchParams.get('database') !== `projects/${project}/databases/(default)`) {
        failure = true; throw new Error('Intentional local read fault escaped its demo project');
      }
      for (const [key, value] of new URLSearchParams(request.postData() || '')) {
        if (!/^req\d+___data__$/.test(key)) continue;
        let message;
        try { message = JSON.parse(value); } catch (_) { failure = true; throw new Error('Malformed intentional local read fault'); }
        if (!message.addTarget || !Number.isInteger(message.addTarget.targetId) || message.removeTarget !== undefined) {
          failure = true; throw new Error('Intentional fault cannot waive a target-removal acknowledgment');
        }
        const sid = url.searchParams.get('SID');
        if (sid && acknowledged.get(JSON.stringify([sid, message.addTarget.targetId]))?.active) {
          failure = true; throw new Error('Intentional fault cannot erase an accepted server target');
        }
      }
      const completion = Promise.resolve().then(abort);
      intentionalAborts.set(request, completion);
      return completion;
    }
    if (request.method() !== 'GET') { failure = true; throw new Error('Unexpected local read-fault method'); }
    return abort();
  }
  function request(request) {
    const url = new URL(request.url());
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.port !== String(port) ||
        url.pathname !== '/google.firestore.v1.Firestore/Listen/channel' || request.method() !== 'POST') return;
    if (url.searchParams.get('database') !== `projects/${project}/databases/(default)`) {
      failure = true; return;
    }
    let changed = false;
    const sid=url.searchParams.get('SID'),channel=sid || {initial:++initial},provisional=new Map(),effects=[];
    for (const [key, value] of new URLSearchParams(request.postData() || '')) {
      if (!/^req\d+___data__$/.test(key)) continue;
      try {
        const message = JSON.parse(value), id = message.addTarget?.targetId ?? message.removeTarget;
        if (id === undefined) continue;
        if (!Number.isInteger(id)) throw new Error('Invalid target');
        const target = JSON.stringify([channel,id]);
        if (message.addTarget) { active.add(target); added++; }
        else { active.delete(target); removed++; }
        latest.set(target,{sequence:++sequence,active:!!message.addTarget});
        effects.push({ target, id, sequence, add: !!message.addTarget });
        if(!sid)provisional.set(id,target);
        changed = true;
      } catch (_) { failure = true; }
    }
    if (changed) {
      const ack = request.response().then(async response => {
        if (!response && intentionalAborts.has(request)) {
          await intentionalAborts.get(request);
          if (effects.some(effect => !effect.add)) { failure = true; return; }
          // The fixture itself aborted these read-only adds before forwarding.
          // No server target was accepted. Later successful commands remain.
          for (const effect of effects) {
            if (latest.get(effect.target)?.sequence === effect.sequence) {
              active.delete(effect.target); latest.delete(effect.target);
            }
            intentionallyAbortedAdds++;
          }
          return;
        }
        if (intentionalAborts.has(request)) { failure = true; return; }
        if (!response || response.status() !== 200) { failure = true; return; }
        const assigned = sid || handshakeSession(await response.text());
        for (const effect of effects) {
          const target = JSON.stringify([assigned, effect.id]), prior = acknowledged.get(target);
          if (!prior || prior.sequence < effect.sequence) acknowledged.set(target, { sequence: effect.sequence, active: effect.add });
        }
        if(!sid) {
          for(const [id,source] of provisional) {
            const target=JSON.stringify([assigned,id]),state=latest.get(source),newer=latest.get(target);
            active.delete(source);latest.delete(source);
            // A remove can arrive before response.text() settles. Preserve the
            // later real command instead of resurrecting its initial target.
            if(!newer || newer.sequence<state.sequence) {
              latest.set(target,state);
              if(state.active)active.add(target);else active.delete(target);
            }
          }
        }
      }).catch(() => { failure = true; });
      pending.add(ack); ack.then(() => pending.delete(ack));
    }
  }
  return { request, active, pending, abortReadRequest, evidence: () => ({ added, removed, active: active.size, pending: pending.size, failure, ...(intentionallyAbortedAdds ? { intentionallyAbortedAdds } : {}) }) };
}
async function transitionEmulatorSubscriptions(page, action) {
  const tracker = trackers.get(page);
  if (!tracker || page.isClosed()) return { applicable: false };
  const lifecycle = await page.evaluate(async action => {
    const hook = window.__CHAOS_EMULATOR_NAVIGATION__, d = window.__CHAOS_FIREBASE_DIAGNOSTICS__;
    if (!hook) {
      if (d?.target === 'EMULATOR') throw new Error('Local subscription lifecycle is missing');
      return null;
    }
    if (d?.target !== 'EMULATOR' || d.projectId !== 'demo-86chaos' || !d.failClosed) throw new Error('Local subscription boundary mismatch');
    return hook[action]();
  }, action);
  if (!lifecycle) return { applicable: false };
  if (action === 'pause') await expect.poll(() => tracker.evidence(), { timeout: 12000 }).toMatchObject({ active: 0, pending: 0, failure: false });
  return { applicable: true, ...tracker.evidence() };
}
async function withEmulatorListenFault(page, installFault) {
  await transitionEmulatorSubscriptions(page, 'pause');
  await installFault();
  await transitionEmulatorSubscriptions(page, 'resume');
}
function abortIntentionalListen(page, route) {
  const tracker = trackers.get(page);
  return tracker ? tracker.abortReadRequest(route.request(), () => route.abort('failed')) : route.abort('failed');
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
module.exports = { createTargetTracker, installEmulatorPage, drainEmulatorPage, transitionEmulatorSubscriptions, withEmulatorListenFault, abortIntentionalListen };
