'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Shift4Client, retryAfterMs, MAX_RETRIES } = require('./_shift4-client');

const response = (status, body, headers = {}) => new Response(body == null ? '' : JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

test('client uses official OAuth, location, menu, and ticket endpoint shapes', async () => {
  const calls = [];
  const client = new Shift4Client({ fetchImpl: async (url, options) => { calls.push({ url, options }); if (url.includes('/locations')) return response(200, { results: [] }); if (url.includes('/menu')) return response(200, { categories: [], items: [] }); return response(200, { results: [], meta: { count: 0 } }); }, maxRetries: 0 });
  const auth = client.authorizationUrl({ clientId: 'client', redirectUri: 'https://example.test/callback', state: 'state-value' });
  assert.match(auth, /^https:\/\/lighthouse-api\.harbortouch\.com\/oauth2\/authorize\//);
  await client.getLocations('token'); await client.getMenu('token', '42'); await client.getTicketsPage('token', '42', { from: '2026-09-01T00:00:00Z', to: '2026-09-01T23:59:59Z' });
  assert.match(calls[0].url, /\/marketplace\/v2\/lighthouse-token\/locations$/);
  assert.match(calls[1].url, /\/pos\/v2\/42\/menu$/);
  assert.match(calls[2].url, /\/pos\/v2\/42\/tickets\?/);
  const ticketUrl = new URL(calls[2].url);
  assert.equal(ticketUrl.searchParams.get('filter[dateTimeFrom]'), '2026-09-01T00:00:00Z');
  assert.equal(ticketUrl.searchParams.get('filter[dateTimeTo]'), '2026-09-01T23:59:59Z');
  assert.equal(ticketUrl.searchParams.has('offset'), false); assert.equal(ticketUrl.searchParams.has('limit'), false);
  assert.equal(calls.every(call => call.options.headers.Authorization === 'Bearer token'), true);
});

test('OAuth code exchange and refresh send secrets only to the token endpoint body', async () => {
  const calls = []; const client = new Shift4Client({ fetchImpl: async (url, options) => { calls.push({ url, options }); return response(200, { access_token: 'a', refresh_token: 'r' }); } });
  await client.exchangeAuthorizationCode({ code: 'code', redirectUri: 'https://example.test/cb', clientId: 'id', clientSecret: 'secret' });
  await client.refreshToken({ refreshToken: 'refresh', clientId: 'id', clientSecret: 'secret' });
  assert.equal(calls.length, 2); assert.equal(calls.every(call => call.url.endsWith('/oauth2/token/')), true);
  assert.equal(calls.every(call => !call.url.includes('secret') && !call.url.includes('refresh')), true);
  assert.equal(JSON.parse(calls[0].options.body).grant_type, 'authorization_code');
  assert.equal(JSON.parse(calls[1].options.body).grant_type, 'refresh_token');
});

test('Marketplace location installation is non-retried and verified through installed locations', async () => {
  const calls = [];
  const client = new Shift4Client({ fetchImpl: async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/marketplace/v2/lighthouse-token/installations')) return new Response(null, { status: 204 });
    return response(200, { results: [{ id: 42, name: 'Fixture Dine' }] });
  } });
  await client.installLocation('token', '42');
  const installed = await client.getInstalledLocations('token');
  assert.equal(installed.results[0].id, 42); assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].options.body), { locationId: 42 }); assert.match(calls[1].url, /\/marketplace\/v2\/locations$/);
  assert.equal(calls.length, 2);
});

test('429 Retry-After is honored with bounded retries', async () => {
  let count = 0; const waits = [];
  const client = new Shift4Client({ fetchImpl: async () => ++count === 1 ? response(429, { message: 'Too Many Requests' }, { 'retry-after': '1' }) : response(200, { results: [] }), waitImpl: async ms => waits.push(ms) });
  const result = await client.getLocations('token');
  assert.deepEqual(result.results, []); assert.deepEqual(waits, [1000]); assert.equal(count, 2); assert.equal(MAX_RETRIES, 2); assert.equal(retryAfterMs('2'), 2000);
});

test('large Retry-After fails safely without sleeping or looping', async () => {
  let count = 0; const client = new Shift4Client({ fetchImpl: async () => { count += 1; return response(429, {}, { 'retry-after': '60' }); }, waitImpl: async () => assert.fail('must not wait 60 seconds') });
  await assert.rejects(() => client.getLocations('token'), error => error.code === 'rate_limited' && error.retryAfterMs === 60000);
  assert.equal(count, 1);
  let failures = 0; const server = new Shift4Client({ fetchImpl: async () => { failures += 1; return response(503, {}, { 'retry-after': '60' }); }, waitImpl: async () => assert.fail('must not retry long 5xx wait') });
  await assert.rejects(() => server.getLocations('token'), error => error.code === 'shift4_unavailable' && error.retryAfterMs === 60000); assert.equal(failures, 1);
});

test('timeouts, network failures, 5xx, and malformed JSON are sanitized', async () => {
  const timeoutClient = new Shift4Client({ timeoutMs: 1000, maxRetries: 0, fetchImpl: (url, options) => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))) });
  await assert.rejects(() => timeoutClient.getLocations('token'), error => error.code === 'timeout' && !error.message.includes('token'));
  const network = new Shift4Client({ maxRetries: 0, fetchImpl: async () => { throw new Error('socket secret details'); } });
  await assert.rejects(() => network.getLocations('token'), error => error.code === 'network_error' && !error.message.includes('socket'));
  const unavailable = new Shift4Client({ maxRetries: 0, fetchImpl: async () => response(500, { internal: 'stack' }) });
  await assert.rejects(() => unavailable.getLocations('token'), error => error.code === 'shift4_unavailable' && !error.message.includes('stack'));
  const malformed = new Shift4Client({ maxRetries: 0, fetchImpl: async () => new Response('{broken', { status: 200 }) });
  await assert.rejects(() => malformed.getLocations('token'), error => error.code === 'malformed_response');
});

test('ticket retrieval never infers completeness from short pages or undocumented meta.count', async () => {
  const client = new Shift4Client({ fetchImpl: async () => response(200, {}) }); let calls = 0;
  client.getTicketsPage = async () => { calls += 1; return { results: [{ posRef: 'a' }, { posRef: 'b' }], meta: { count: 2 } }; };
  const result = await client.getAllTickets('token', '1', { from: 'a', to: 'b' }, { pageSize: 2, maxPages: 5 });
  assert.deepEqual(result.tickets.map(row => row.posRef), ['a','b']); assert.equal(result.retrievalComplete, false); assert.equal(result.partialReason, 'api_contract_unverified'); assert.equal(calls, 1);
});

test('missing durable references and contradictory completion signals are counted and rejected', async () => {
  const client = new Shift4Client({ fetchImpl: async () => response(200, { results: [{ type: 'sale', openedAt: '2026-09-13T10:00:00Z' }, { posRef: 'valid' }], meta: { count: 1 } }), maxRetries: 0 });
  const result = await client.getAllTickets('access', '42', { from: '2026-09-13T00:00:00Z', to: '2026-09-13T23:59:59Z' });
  assert.equal(result.tickets.length, 1); assert.equal(result.missingReferenceRows, 1); assert.equal(result.contradictoryCount, true); assert.equal(result.retrievalComplete, false);
});

test('reordered/identical duplicates are deduplicated and conflicting same-ID content is not first-or-last-wins', async () => {
  const { analyzeTicketRows } = require('./_shift4-client');
  const identicalA = { posRef: 'same', type: 'sale', ticketItems: [{ posRef: 'i2', price: 2 }, { posRef: 'i1', price: 1 }], ticketPayments: [{ pan: '4111' }] };
  const identicalB = { ...identicalA, ticketPayments: [{ pan: '5555' }] };
  const same = analyzeTicketRows([identicalA, identicalB], '1'); assert.equal(same.tickets.length, 1); assert.equal(same.duplicates, 1);
  const conflict = analyzeTicketRows([identicalA, { ...identicalA, totalGrand: 999 }], '1'); assert.equal(conflict.tickets.length, 0); assert.equal(conflict.conflicts.length, 1);
});
