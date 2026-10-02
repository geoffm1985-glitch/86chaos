#!/usr/bin/env node
'use strict';

const { getFirebaseTarget } = require('./86chaos-firebase-target.cjs');

function assertEmulatorResetTarget(env = process.env) {
  const target = getFirebaseTarget(env);
  if (!target.emulator) throw new Error('Firebase emulator reset refuses LIVE mode.');
  if (!String(target.projectId || '').startsWith('demo-')) throw new Error('Firebase emulator reset requires a demo-* project.');
  if (!/^(localhost|127(?:\.\d{1,3}){3}|::1)$/i.test(String(target.host || ''))) throw new Error('Firebase emulator reset requires a loopback host.');
  return target;
}

async function request(url, init = {}) {
  const response = await fetch(url, init);
  if (!response.ok && response.status !== 404) {
    const body = await response.text().catch(() => '');
    throw new Error(`Emulator reset request failed: ${response.status} ${url} ${body.slice(0, 300)}`);
  }
  return response;
}

async function resetStorage(target) {
  const bucket = `${target.projectId}.appspot.com`;
  const root = `http://${target.host}:${target.ports.storage}/v0/b/${encodeURIComponent(bucket)}/o`;
  let pageToken = '';
  for (let guard = 0; guard < 100; guard += 1) {
    const url = new URL(root);
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await request(url.toString());
    const data = response.status === 404 ? {} : await response.json().catch(() => ({}));
    for (const item of data.items || []) {
      if (!item?.name) continue;
      await request(`${root}/${encodeURIComponent(item.name)}`, { method: 'DELETE' });
    }
    pageToken = data.nextPageToken || '';
    if (!pageToken) break;
  }
}

async function resetFirebaseEmulators(env = process.env) {
  const target = assertEmulatorResetTarget(env);
  const project = encodeURIComponent(target.projectId);
  await request(`http://${target.host}:${target.ports.firestore}/emulator/v1/projects/${project}/databases/(default)/documents`, { method: 'DELETE' });
  await request(`http://${target.host}:${target.ports.auth}/emulator/v1/projects/${project}/accounts`, { method: 'DELETE' });
  await request(`http://${target.host}:${target.ports.database}/.json?ns=${project}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: 'null' });
  await resetStorage(target);
  return { ok: true, projectId: target.projectId, host: target.host };
}

if (require.main === module) {
  resetFirebaseEmulators()
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(error => { console.error(error.message || String(error)); process.exitCode = 1; });
}

module.exports = { assertEmulatorResetTarget, resetFirebaseEmulators };
