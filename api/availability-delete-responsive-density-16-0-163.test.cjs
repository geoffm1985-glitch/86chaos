'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pngDimensions } = require('../scripts/86chaos-release-gate/icon-source-validator.cjs');
const authHelpers = require('./_availability-record-auth.cjs');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const json = (file) => JSON.parse(read(file));

test('availability delete authorization is manager scoped and rejects employees', () => {
  assert.equal(authHelpers.canDeleteAvailabilityRecord({
    decoded: { uid: 'manager', email: 'manager@test.local' },
    caller: {},
    membership: { restaurantId: 'cheers', isActive: true, permissions: { schedule: true } },
    restaurant: {},
    restaurantId: 'cheers'
  }), true);
  assert.equal(authHelpers.canDeleteAvailabilityRecord({
    decoded: { uid: 'employee', email: 'employee@test.local' },
    caller: {},
    membership: { restaurantId: 'cheers', isActive: true, permissions: {} },
    restaurant: {},
    restaurantId: 'cheers'
  }), false);
  assert.equal(authHelpers.canDeleteAvailabilityRecord({
    decoded: { uid: 'old', email: 'old@test.local' },
    caller: {},
    membership: { restaurantId: 'cheers', isActive: false, permissions: { schedule: true } },
    restaurant: {},
    restaurantId: 'cheers'
  }), false);
});

test('availability route is a narrow delete route with audit logging only', () => {
  const source = read('api/availability-record.js');
  assert.match(source, /action !== 'delete'/);
  assert.match(source, /db\.collection\('availabilityRecords'\)\.doc\(recordId\)/);
  assert.match(source, /AVAILABILITY_DELETED/);
  assert.doesNotMatch(source, /collectionName/);
  assert.doesNotMatch(source, /firestore\.rules/);
});

test('Availability History UI uses server delete and pending records do not allow delete', () => {
  const schedule = read('src/features/schedule.jsx');
  assert.match(schedule, /deleteAvailabilityHistory/);
  assert.match(schedule, /secureFetch\('\/api\/availability-record'/);
  assert.match(schedule, /allowDelete=\{false\}/);
  assert.match(schedule, /allowDelete=\{canManage\}/);
  assert.match(schedule, /Delete availability history for/);
});

test('Request Off employee filter is an accessible role-grouped durable select', () => {
  const schedule = read('src/features/schedule.jsx');
  assert.match(schedule, /requestOffEmployeeOptions/);
  assert.match(schedule, /<select id="request-off-employee-filter"/);
  assert.match(schedule, /<option value="">All Employees<\/option>/);
  assert.match(schedule, /<optgroup key=\{group\.role\} label=\{group\.role\}>/);
  assert.match(schedule, /requestOffSubjectMatchesPerson\(r, selectedRequestOffEmployee\.person\)/);
  assert.doesNotMatch(schedule, /placeholder="Filter by employee\.\.\."/);
});

test('Message Board and Request Off use deliberate responsive grids', () => {
  const management = read('src/features/management.jsx');
  const schedule = read('src/features/schedule.jsx');
  const styles = read('src/styles.css');
  for (const token of ['message-board-filter-grid', 'message-board-composer-grid', 'message-board-action-row']) {
    assert.match(management, new RegExp(token));
    assert.match(styles, new RegExp(`\\.${token}`));
  }
  for (const token of ['request-off-bulk-grid', 'request-off-status-grid', 'request-off-date-grid', 'request-off-employee-select']) {
    assert.match(schedule, new RegExp(token));
    assert.match(styles, new RegExp(`\\.${token}`));
  }
  assert.match(styles, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/);
});

test('shared density tokens are tightened without shrinking mobile tap minimum', () => {
  const styles = read('src/styles.css');
  assert.match(styles, /--chaos-compact-page-x: 12px/);
  assert.match(styles, /--chaos-compact-page-y: 8px/);
  assert.match(styles, /--chaos-mobile-page-y: 7px/);
  assert.match(styles, /--chaos-mobile-tap-h: 42px/);
  assert.doesNotMatch(styles, /font-size reduction/i);
});

test('PWA manifest uses v3 padded maskable icons and keeps normal v2 artwork', () => {
  const manifest = json('public/manifest.json');
  const maskables = manifest.icons.filter(icon => /maskable/i.test(icon.purpose || ''));
  assert.deepEqual(maskables.map(icon => icon.src).sort(), ['/86chaos-maskable-192-v3.png','/86chaos-maskable-512-v3.png']);
  assert.ok(manifest.icons.some(icon => icon.src === '/86chaos-icon-512-v2.png' && icon.purpose === 'any'));
  for (const [file, size] of [['public/86chaos-maskable-192-v3.png', 192], ['public/86chaos-maskable-512-v3.png', 512]]) {
    const buf = fs.readFileSync(path.join(root, file));
    const dims = pngDimensions(buf);
    assert.equal(dims.width, size);
    assert.equal(dims.height, size);
  }
});
