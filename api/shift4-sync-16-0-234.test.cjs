'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

function memoryDb() {
  const docs = new Map(); const writes = [];
  const ref = (path) => ({
    path, id: path.split('/').pop(),
    collection(name) { return collection(`${path}/${name}`); },
    async set(value, options = {}) {
      const next = options.merge ? { ...(docs.get(path) || {}), ...value } : { ...value };
      docs.set(path, next); writes.push({ path, value: next });
    },
    async get() { return { id: this.id, exists: docs.has(path), data: () => docs.get(path) }; }
  });
  const collection = (path) => ({ doc(id) { return ref(`${path}/${id}`); } });
  return {
    docs, writes, collection,
    async runTransaction(fn) { const pending = []; const result = await fn({ get: target => target.get(), set(target, value, options) { pending.push([target, value, options]); } }); for (const args of pending) await args[0].set(args[1], args[2]); return result; }
  };
}

function responseRecorder() {
  return { statusCode: 0, headers: {}, status(value) { this.statusCode = value; return this; }, setHeader(key, value) { this.headers[key] = value; }, end(value) { this.body = value; } };
}

const sensitiveTicket = (grand = 1648) => ({
  posRef: 'ticket-1', type: 'sale', orderNumber: '86', openedAt: '2026-09-13T22:00:00Z', closedAt: '2026-09-13T22:15:00Z',
  openedByEmployeeRef: 'employee-1', openedByEmployee: 'Zoë Cook', totalItems: 1500, totalGrand: grand, totalTax: 98, totalDiscounts: 50, totalTips: 300, totalGratuities: 0,
  customerName: 'Private Customer', customerRef: 'customer-secret', pan: '4111111111111111', cvv: '123', paymentToken: 'payment-secret',
  ticketPayments: [{ cardType: 'VISA', authorizationCode: 'auth-secret', futurePaymentSecret: 'hidden' }],
  ticketItems: [{ posRef: 'line-1', type: 'sale', name: 'Burger', itemRef: 'burger', quantity: 1, unitPrice: 1500, itemAmount: 1500, modifierAmount: 0, discountAmount: 50, price: 1450, tax: 98, addedAt: '2026-09-13T22:01:00Z', rawPayment: { trackData: 'hidden' } }]
});

test('manual sync is PCI-allowlisted, idempotent, update-aware, honestly partial, and operationally read-only', async () => {
  const db = memoryDb(); let grand = 1648;
  const authPath = require.resolve('./_shift4-authority');
  const clientPath = require.resolve('./_shift4-client');
  const servicePath = require.resolve('./_shift4-service');
  const routePath = require.resolve('./shift4-sync');
  const originals = [authPath, clientPath, servicePath].map(path => [path, require.cache[path]]);
  try {
    require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: { authorizeShift4: async () => ({ db, uid: 'owner-a' }) } };
    require.cache[clientPath] = { id: clientPath, filename: clientPath, loaded: true, exports: { Shift4Client: class {
      async getMenu() { return { categories: [{ posRef: 'food', name: 'Entrées', items: ['burger'] }], items: [{ posRef: 'burger', name: 'Burger', price: 1500 }] }; }
      async getAllTickets() { return { tickets: [sensitiveTicket(grand)], pagesFetched: 1, rawSourceRowsReceived: 1, uniqueTicketsRetained: 1, duplicateTicketRows: 0, conflictingTicketRows: 0, missingReferenceRows: 0, retrievalComplete: false, partial: true, partialReason: 'api_contract_unverified', reportedCount: null, contradictoryCount: false }; }
    } } };
    require.cache[servicePath] = { id: servicePath, filename: servicePath, loaded: true, exports: {
      TICKET_RETRIEVAL_CONTRACT: { paginationVerified: false },
      freshCredential: async () => ({ stored: { data: { connectionGeneration: 1, selectedLocation: { id: '17', name: 'Cheers', timeZone: 'America/Chicago', timeZoneStatus: 'valid', supportStatus: 'supported', isAvailable: true } } }, tokenBundle: { accessToken: 'server-secret-token' } }),
      publicError: error => ({ code: error.code || 'unknown_error', message: 'The Shift4 request failed safely.' }),
      localDateRangeToUtc: (from, to) => ({ from: `${from}T05:00:00.000Z`, to: `${to}T04:59:59.999Z`, requestedFrom: from, requestedTo: to })
    } };
    delete require.cache[routePath]; const route = require('./shift4-sync');
    const invoke = async () => { const res = responseRecorder(); await route({ method: 'POST', body: { restaurantId: 'restaurant-a', from: '2026-09-13', to: '2026-09-13' } }, res); return { res, payload: JSON.parse(res.body) }; };

    const first = await invoke();
    assert.equal(first.res.statusCode, 206); assert.equal(first.payload.summary.inserted, 2); assert.equal(first.payload.summary.status, 'incomplete'); assert.equal(first.payload.preview.isPreview, true); assert.equal(first.payload.preview.records.length, 2);
    const forbidden = /4111111111111111|customer-secret|private customer|payment-secret|auth-secret|trackData|ticketPayments|cardType|futurePaymentSecret|server-secret-token/i;
    assert.doesNotMatch(JSON.stringify(first.payload), forbidden); assert.doesNotMatch(JSON.stringify([...db.docs]), forbidden);
    assert.equal(db.writes.every(write => /^(posSyncScopes|shift4Credentials)\//.test(write.path)), true);

    const replay = await invoke();
    assert.equal(replay.payload.summary.inserted, 0); assert.equal(replay.payload.summary.updated, 0); assert.equal(replay.payload.summary.unchanged, 2);
    grand = 1700;
    const updated = await invoke();
    assert.equal(updated.payload.summary.updated, 1); assert.equal(updated.payload.summary.unchanged, 1);
    const incomplete = await invoke(); assert.equal(incomplete.payload.summary.status, 'incomplete'); assert.equal(incomplete.payload.summary.partial, true); assert.equal(incomplete.payload.summary.partialReason, 'api_contract_unverified');
    assert.equal([...db.docs.values()].some(value => value.lastSuccessfulImportAt), false);
  } finally {
    originals.forEach(([path, value]) => value ? require.cache[path] = value : delete require.cache[path]);
    delete require.cache[routePath];
  }
});
