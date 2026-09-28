'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} = require('@firebase/rules-unit-testing');
const {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where
} = require('firebase/firestore');

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT || 'demo-schedule-publish-permission';
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || '';

if (!firestoreHost || /googleapis\.com/i.test(firestoreHost)) {
  throw new Error('This targeted permission test requires the local Firestore emulator and refuses production hosts.');
}

async function seed(env, collectionName, id, data) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), collectionName, id), data);
  });
}

(async () => {
  const env = await initializeTestEnvironment({
    projectId,
    firestore: { rules: fs.readFileSync(path.join(process.cwd(), 'firestore.rules'), 'utf8') }
  });
  try {
    const tenantA = 'tenant_a';
    const tenantB = 'tenant_b';
    const day = '2026-09-28';

    await seed(env, 'users', 'managerA', {
      restaurantId: tenantA,
      workspaceIds: [tenantA],
      memberships: {
        [tenantA]: { isActive: true, isAdmin: true, permissions: { schedule: true } }
      }
    });
    await seed(env, 'shifts', 'authorized_shift', {
      restaurantId: tenantA,
      workspaceId: tenantA,
      date: day,
      scheduleDateKey: day,
      employeeId: 'employee_a'
    });
    await seed(env, 'shifts', 'other_tenant_shift', {
      restaurantId: tenantB,
      workspaceId: tenantB,
      date: day,
      scheduleDateKey: day,
      employeeId: 'employee_b'
    });
    await seed(env, 'shifts', 'legacy_workspace_only_shift', {
      workspaceId: tenantA,
      date: day,
      scheduleDateKey: day,
      employeeId: 'employee_legacy'
    });

    const manager = env.authenticatedContext('managerA', { email: 'manager@example.com' }).firestore();

    const canonicalByDate = query(
      collection(manager, 'shifts'),
      where('restaurantId', '==', tenantA),
      where('date', '==', day)
    );
    const canonicalByScheduleDateKey = query(
      collection(manager, 'shifts'),
      where('restaurantId', '==', tenantA),
      where('scheduleDateKey', '==', day)
    );
    const legacyWorkspaceOnly = query(
      collection(manager, 'shifts'),
      where('workspaceId', '==', tenantA),
      where('date', '==', day)
    );
    const crossTenant = query(
      collection(manager, 'shifts'),
      where('restaurantId', '==', tenantB),
      where('date', '==', day)
    );

    const dateSnap = await assertSucceeds(getDocs(canonicalByDate));
    assert.equal(dateSnap.size, 1, 'restaurantId + date query is allowed and tenant-limited');

    const keySnap = await assertSucceeds(getDocs(canonicalByScheduleDateKey));
    assert.equal(keySnap.size, 1, 'restaurantId + scheduleDateKey query is allowed and tenant-limited');

    await assertFails(getDocs(legacyWorkspaceOnly));
    await assertFails(getDocs(crossTenant));

    console.log('Targeted schedule publish Firestore permission test passed.');
  } finally {
    await env.cleanup();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
