'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeShift4Tickets, recordsToCsv, recordsToJson, stableId, SCHEMA_VERSION } = require('./_shift4-normalization');

const fixture = () => ({
  restaurantId: 'restaurant-a', providerLocationId: '17', importRunId: 'run-1', timeZone: 'America/Chicago',
  menu: { categories: [{ posRef: 'food', name: 'Entrées', items: ['burger'] }], items: [{ posRef: 'burger', name: 'Chaos Burger', price: 1299 }] },
  tickets: [{
    posRef: 'ticket-1', type: 'sale', orderNumber: '86', openedAt: '2026-09-13T22:00:00Z', closedAt: '2026-09-13T22:15:00Z',
    openedByEmployeeRef: 'emp-1', openedByEmployee: 'Zoë Cook', totalItems: 1500, totalGrand: 1648, totalTax: 98, totalDiscounts: 50, totalTips: 300, totalGratuities: 0,
    customerName: 'Private Customer', customerRef: 'customer-secret', pan: '4111111111111111', cvv: '123', paymentToken: 'payment-secret',
    ticketPayments: [{ cardType: 'VISA', pan: '4111111111111111', authorizationCode: 'auth-secret', unknownFuturePaymentSecret: 'hidden' }],
    ticketItems: [{ posRef: 'line-1', type: 'sale', name: 'Burger, "Deluxe"\nSpecial', itemRef: 'burger', quantity: 1, unitPrice: 1500, itemAmount: 1500, modifierAmount: 0, discountAmount: 50, price: 1450, tax: 98, addedAt: '2026-09-13T22:01:00Z', rawPayment: { trackData: 'hidden' } }]
  }]
});

test('ticket and item normalize into provider-neutral v3 cent records with non-additive amount semantics', () => {
  const result = normalizeShift4Tickets(fixture());
  assert.equal(result.rejected.length, 0); assert.equal(result.records.length, 2);
  const [ticket, item] = result.records;
  assert.equal(ticket.schemaVersion, SCHEMA_VERSION); assert.equal(ticket.provider, 'shift4'); assert.equal(ticket.providerProduct, 'shift4-dine');
  assert.equal(ticket.businessDate, '2026-09-13'); assert.equal(ticket.grossAmountCents, 1500); assert.equal(ticket.netAmountCents, 1550); assert.equal(ticket.taxAmountCents, 98); assert.equal(ticket.tipAmountCents, 300);
  assert.equal(item.sourceParentId, 'ticket-1'); assert.equal(item.menuItemRef, 'burger'); assert.equal(item.categoryName, 'Entrées'); assert.equal(item.netAmountCents, 1450); assert.equal(item.approvalRequired, true); assert.equal(item.status, 'draft');
  assert.equal(ticket.surchargeAmountCents, null); assert.equal(item.isNonSalesRevenue, null);
});

test('sale/refund/void/overring are accepted and malformed records are rejected', () => {
  const base = fixture();
  base.tickets = ['sale','refund','void','overring'].map((type, index) => ({ ...base.tickets[0], posRef: `t-${index}`, type, ticketItems: [] })).concat([{ type: 'sale', closedAt: 'bad' }, { posRef: 'x', type: 'undocumented', closedAt: '2026-09-13T22:00:00Z' }]);
  const result = normalizeShift4Tickets(base);
  assert.equal(result.records.length, 4); assert.equal(result.rejected.length, 2);
});

test('same POS ref is stable while location and updated values remain distinct', () => {
  const first = normalizeShift4Tickets(fixture()).records;
  const second = normalizeShift4Tickets(fixture()).records;
  assert.deepEqual(first.map(row => row.idempotencyKey), second.map(row => row.idempotencyKey));
  const otherLocation = normalizeShift4Tickets({ ...fixture(), providerLocationId: '18' }).records;
  assert.notEqual(first[0].idempotencyKey, otherLocation[0].idempotencyKey);
  const updatedInput = fixture(); updatedInput.tickets[0].totalGrand = 1700;
  const updated = normalizeShift4Tickets(updatedInput).records;
  assert.equal(first[0].idempotencyKey, updated[0].idempotencyKey); assert.notEqual(first[0].netAmountCents, updated[0].netAmountCents);
});

test('canonical identities resist delimiter and truncation collisions', () => {
  assert.notEqual(stableId('a:b', 'c'), stableId('a', 'b:c'));
  const first = fixture(); first.tickets[0].posRef = `${'x'.repeat(600)}A`; first.tickets[0].ticketItems = [];
  const second = fixture(); second.tickets[0].posRef = `${'x'.repeat(600)}B`; second.tickets[0].ticketItems = [];
  assert.notEqual(normalizeShift4Tickets(first).records[0].idempotencyKey, normalizeShift4Tickets(second).records[0].idempotencyKey);
});

test('booleans, arrays, objects, unsafe numbers and overflowing derived amounts are rejected visibly', () => {
  for (const [field, value] of [['totalGrand', true], ['totalTax', []], ['totalItems', {}], ['totalTips', Number.POSITIVE_INFINITY], ['totalDiscounts', Number.MAX_SAFE_INTEGER + 1]]) {
    const input = fixture(); input.tickets[0][field] = value; const result = normalizeShift4Tickets(input); assert.equal(result.records.some(row => row.recordType === 'ticket'), false, field); assert.equal(result.rejected.some(row => row.reason === 'invalid_ticket_money'), true, field);
  }
  const quantityInput = fixture(); quantityInput.tickets[0].ticketItems[0].quantity = false; assert.equal(normalizeShift4Tickets(quantityInput).rejected.some(row => row.reason === 'invalid_item_quantity'), true);
  const overflow = fixture(); overflow.tickets[0].ticketItems[0].itemAmount = Number.MAX_SAFE_INTEGER; overflow.tickets[0].ticketItems[0].modifierAmount = 1; assert.equal(normalizeShift4Tickets(overflow).rejected.some(row => row.field === 'derivedGross'), true);
  const negative = fixture(); negative.tickets[0].ticketItems[0].quantity = -0.5; negative.tickets[0].ticketItems[0].price = -125; const item = normalizeShift4Tickets(negative).records.find(row => row.recordType === 'ticketItem'); assert.equal(item.quantity, -0.5); assert.equal(item.netAmountCents, -125);
});

test('explicit allowlist strips all customer, card, token, payment, and unknown fields everywhere', () => {
  const records = normalizeShift4Tickets(fixture()).records;
  const csv = recordsToCsv(records);
  const json = JSON.stringify(recordsToJson({ restaurantId: 'restaurant-a', providerLocationId: '17', requestedFrom: '2026-09-13', requestedTo: '2026-09-13', completeness: 'complete', records }));
  const combined = `${JSON.stringify(records)}\n${csv}\n${json}`.toLowerCase();
  for (const forbidden of ['4111111111111111','cvv','trackdata','payment-secret','auth-secret','customer-secret','private customer','ticketpayments','cardtype','unknownfuturepaymentsecret','rawpayment']) assert.equal(combined.includes(forbidden), false, forbidden);
});

test('CSV and JSON exports preserve quotes, commas, newlines, Unicode, empty values, cents, scope, and completeness', () => {
  const records = normalizeShift4Tickets(fixture()).records;
  const csv = recordsToCsv(records);
  assert.match(csv, /"Burger, ""Deluxe""\nSpecial"/); assert.match(csv, /1450/); assert.match(csv, /Zoë Cook/); assert.match(csv, /^\uFEFFschemaVersion/);
  const json = recordsToJson({ restaurantId: 'restaurant-a', providerLocationId: '17', requestedFrom: '2026-09-13', requestedTo: '2026-09-13', completeness: 'partial', records });
  assert.equal(json.schemaVersion, 3); assert.equal(json.restaurantId, 'restaurant-a'); assert.equal(json.completeness, 'partial'); assert.match(json.amountSemantics, /not additive/i); assert.equal(json.records.length, 2);
  const formulaCsv = recordsToCsv([{ schemaVersion: 3, provider: 'shift4', providerProduct: 'shift4-dine', providerLocationId: '17', recordType: 'ticketItem', sourceRecordId: '=HYPERLINK("bad")', employeeName: '+cmd', netAmountCents: -125 }]);
  assert.match(formulaCsv, /"'=HYPERLINK\(""bad""\)"/); assert.match(formulaCsv, /"'\+cmd"/); assert.match(formulaCsv, /,-125,/);
});
