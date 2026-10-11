'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const cp = require('node:child_process');
const { initializeTestEnvironment, assertFails } = require('@firebase/rules-unit-testing');
const sdk = require('firebase/firestore');

// Execute the actual picker candidate loader against the real shipped rules.
function loader(source, db, overrides = {}) {
  const start = source.indexOf('  const fetchSchedulePublishCandidatesForDaySet =');
  const end = source.indexOf('  const eventsByScheduleDay =', start);
  assert(start >= 0 && end > start);
  return vm.runInNewContext(`${source.slice(start, end)}; fetchSchedulePublishCandidatesForDaySet`, {
    ...sdk, db, appUser: { restaurantId: 'tenant_a' },
    getShiftDateKey: shift => shift.date || shift.scheduleDateKey || '',
    getShiftWritableDocId: shift => shift.id,
    isDeletedScheduleShift: shift => shift.deleted === true || shift.status === 'deleted',
    shiftMatchesLocalDeleteMarkers: () => false,
    activeLocalDeleteKeySet: new Set(), activeLocalDeleteMarkerMap: new Map(),
    mergeSchedulePublishCandidates: rows => rows,
    recordScheduleOperationDiagnostic: () => {}, ...overrides,
  });
}

test('publish candidate permissions: reproduce denial, load selected weeks, retain tenant isolation and fail closed', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
  assert.match(process.env.FIRESTORE_EMULATOR_HOST || '', /^127\.0\.0\.1:\d+$/);
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  const env = await initializeTestEnvironment({
    projectId: 'demo-publish-query-hotfix',
    firestore: { host, port: Number(port), rules: fs.readFileSync('firestore.rules', 'utf8') },
  });
  try {
    await env.withSecurityRulesDisabled(async ctx => {
      const db = ctx.firestore();
      const batch = sdk.writeBatch(db);
      const put = (collection, id, data) => batch.set(sdk.doc(db, collection, id), data);
      await put('restaurants', 'tenant_a', { ownerUid: 'owner_a', planId: 'owner_pro' });
      await put('users', 'manager_a', { restaurantId: 'tenant_a', workspaceIds: ['tenant_a'], memberships: { tenant_a: { isActive: true, isAdmin: true, permissions: { schedule: true } } } });
      await put('workspaceMembers', 'manager_a_tenant_a', { restaurantId: 'tenant_a', userId: 'manager_a', authUid: 'manager_a', isActive: true, isAdmin: true, permissions: { schedule: true } });
      for (let i = 0; i < 47; i += 1) {
        const day = i < 25 ? '2026-10-19' : '2026-10-26';
        await put('shifts', `shift_${i}`, { restaurantId: 'tenant_a', workspaceId: 'tenant_a', ...(i % 2 ? { scheduleDateKey: day } : { date: day }), ...(i === 0 ? { scheduleDateKey: day } : {}), isPublished: false });
      }
      await put('shifts', 'other_restaurant', { restaurantId: 'tenant_b', workspaceId: 'tenant_a', date: '2026-10-19' });
      await put('shifts', 'outside_selection', { restaurantId: 'tenant_a', date: '2026-11-02' });
      await put('shifts', 'deleted', { restaurantId: 'tenant_a', date: '2026-10-19', deleted: true });
      await batch.commit();
    });
    const db = env.authenticatedContext('manager_a', { email: 'manager@example.invalid' }).firestore();
    const days = new Set(['2026-10-19', '2026-10-26']);
    const oldSource = cp.execFileSync('git', ['show', 'ab4a848058902672ee8f5114710a6af0db71a2c0:src/features/schedule.jsx'], { encoding: 'utf8' });
    await assert.rejects(loader(oldSource, db)(days), /Publish candidate query failed[\s\S]*(permissions|restaurantId is undefined)/i);
    const source = fs.readFileSync('src/features/schedule.jsx', 'utf8');
    const shifts = await loader(source, db)(days, [{ id: 'stale_cache_only', restaurantId: 'tenant_a', date: '2026-10-19' }]);
    assert.equal(shifts.length, 47);
    assert.equal(new Set(shifts.map(row => row.id)).size, 47);
    assert(shifts.every(row => row.restaurantId === 'tenant_a' && row.isPublished === false));
    assert(!shifts.some(row => ['stale_cache_only', 'other_restaurant', 'deleted', 'outside_selection'].includes(row.id)));
    await assertFails(sdk.getDocsFromServer(sdk.query(sdk.collection(db, 'shifts'), sdk.where('restaurantId', '==', 'tenant_b'))));
    await assert.rejects(loader(source, db, { getDocsFromServer: async () => { throw new Error('injected server outage'); } })(days), /No shifts were changed.*injected server outage/);
  } finally { await env.cleanup(); }
});
