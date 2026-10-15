'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { request } = require('@playwright/test');
const { postScheduleQa } = require('../tests/fixtures/schedule-qa-request.cjs');

async function fixture(t, handler) {
  const received = [];
  const server = http.createServer((req, res) => {
    let text = '';
    req.on('data', chunk => { text += chunk; });
    req.on('end', () => {
      received.push({ method: req.method, url: req.url, body: JSON.parse(text) });
      handler(req, res, received.length);
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const client = await request.newContext({ baseURL: `http://127.0.0.1:${server.address().port}` });
  t.after(async () => { await client.dispose(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  return { client, received };
}

const options = data => ({ headers: { authorization: 'Bearer synthetic-secret-never-log', 'x-firebase-appcheck': 'synthetic-appcheck-secret' }, data });

test('independent QA reads recover reset sockets and still verify the actual response', async t => {
  const row = { id: 'owned-shift', restaurantId: 'qa_transport_fixture', revision: 7, endTime: '22:00' };
  const f = await fixture(t, (req, res, count) => {
    if (count < 3) return req.socket.destroy();
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ authoritative: true, shifts: [row] }));
  });
  const data = { action: 'read', restaurantId: row.restaurantId, ids: [row.id] };
  const response = await postScheduleQa(f.client, '/api/schedule-workspace', options(data));
  assert.equal(response.status(), 200);
  assert.deepEqual(await response.json(), { authoritative: true, shifts: [row] });
  assert.equal(f.received.length, 3);
  for (const call of f.received) assert.deepEqual(call, { method: 'POST', url: '/api/schedule-workspace', body: data });
});

test('persistent read resets fail after three attempts without exposing request credentials', async t => {
  const f = await fixture(t, req => req.socket.destroy());
  await assert.rejects(postScheduleQa(f.client, '/api/schedule-workspace', options({ action: 'read-week', restaurantId: 'qa_transport_fixture', weekStart: '2031-02-10' })), error => {
    assert.match(error.message, /ECONNRESET.*bounded read recovery exhausted/);
    assert.doesNotMatch(error.stack, /synthetic-secret|synthetic-appcheck|authorization|Bearer|Call log/);
    assert.equal(error.cause, undefined);
    return true;
  });
  assert.equal(f.received.length, 3);
});

test('HTTP permission failures are returned unchanged and never retried', async t => {
  const f = await fixture(t, (_req, res) => { res.writeHead(403, { 'content-type': 'application/json' }); res.end('{"ok":false,"error":"permission_denied"}'); });
  const response = await postScheduleQa(f.client, '/api/schedule-workspace', options({ action: 'read', restaurantId: 'qa_transport_fixture', ids: ['owned-shift'] }));
  assert.equal(response.status(), 403);
  assert.deepEqual(await response.json(), { ok: false, error: 'permission_denied' });
  assert.equal(f.received.length, 1);
});

test('ambiguous mutation transport failures are not automatically replayed', async t => {
  const f = await fixture(t, req => req.socket.destroy());
  const data = { restaurantId: 'qa_transport_fixture', operationId: 'exact_owned_operation', changes: [{ kind: 'delete', id: 'owned-shift', expected: { revision: 7 } }] };
  await assert.rejects(postScheduleQa(f.client, '/api/schedule-workspace', options(data)), error => {
    assert.match(error.message, /mutation transport failed \(ECONNRESET\).*not automatically retried/);
    assert.doesNotMatch(error.stack, /synthetic-secret|synthetic-appcheck|authorization|Bearer/);
    return true;
  });
  assert.equal(f.received.length, 1);
  assert.deepEqual(f.received[0].body, data);
});

test('unknown transport failures stay failed and omit arbitrary sensitive diagnostics', async () => {
  let calls = 0;
  const fake = { async post(_url, received) { calls++; assert.equal(received.maxRetries, 0); throw new Error('authorization: Bearer synthetic-secret-never-log\nCookie: session=synthetic-secret'); } };
  await assert.rejects(postScheduleQa(fake, '/api/schedule-shift-delete', options({ action: 'review-month' })), error => {
    assert.match(error.message, /transport_error/);
    assert.doesNotMatch(error.stack, /synthetic-secret|authorization|Cookie|Bearer/);
    return true;
  });
  assert.equal(calls, 1);
});
