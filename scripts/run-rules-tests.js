#!/usr/bin/env node
/*
 * Firebase emulator-only security tests for 86 Chaos rules.
 * This runner intentionally refuses to run unless Firestore and Storage emulator hosts are present.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, deleteDoc } = require('firebase/firestore');
const { ref, uploadBytes, deleteObject } = require('firebase/storage');

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT || 'chaos-rules-test-local';
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || '';
const storageHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST || process.env.STORAGE_EMULATOR_HOST || '';

function requireEmulators() {
  assert(firestoreHost && !/googleapis\.com/i.test(firestoreHost), 'Firestore rules tests require FIRESTORE_EMULATOR_HOST and refuse production hosts.');
  assert(storageHost && !/googleapis\.com/i.test(storageHost), 'Storage rules tests require FIREBASE_STORAGE_EMULATOR_HOST and refuse production hosts.');
}

async function seedUser(env, uid, data) {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users', uid), data);
  });
}

async function seedDoc(env, collectionName, id, data) {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), collectionName, id), data);
  });
}

async function runFirestoreTests(env) {
  await env.clearFirestore();
  const tenantA = 'tenant_a';
  const tenantB = 'tenant_b';
  await seedUser(env, 'staffA', { restaurantId: tenantA, workspaceIds: [tenantA], memberships: { [tenantA]: { isActive: true, permissions: {} } } });
  await seedUser(env, 'managerA', { restaurantId: tenantA, workspaceIds: [tenantA], memberships: { [tenantA]: { isActive: true, isAdmin: true, permissions: { schedule: true, events: true, maintenance: true, inventory: true } } } });
  await seedUser(env, 'staffB', { restaurantId: tenantB, workspaceIds: [tenantB], memberships: { [tenantB]: { isActive: true, permissions: {} } } });
  await seedUser(env, 'superAdmin', { isSuperAdmin: true, systemAccess: { superAdmin: true } });

  await seedDoc(env, 'tasks', 'task_a', { restaurantId: tenantA, title: 'Prep onions', createdBy: 'staffA' });
  await seedDoc(env, 'menuIntelligenceScans', 'scan_a', { restaurantId: tenantA, createdBy: 'managerA' });
  await seedDoc(env, 'menuDependencies', 'dep_a', { restaurantId: tenantA, menuItemId: 'burger' });
  await seedDoc(env, 'messages', 'msg_a', { restaurantId: tenantA, authorId: 'staffA', text: 'Need sauce' });
  await seedDoc(env, 'maintenanceLogs', 'maint_a', { restaurantId: tenantA, reporterId: 'staffA', title: 'Light out' });
  await seedDoc(env, 'shiftSwaps', 'swap_a', { restaurantId: tenantA, requesterId: 'staffA', shiftId: 'shift_a', status: 'requested' });
  for (const collectionName of ['inventoryItems', 'vendors', 'orders', 'wasteLogs', 'invoices', 'reports', 'exports']) {
    await seedDoc(env, collectionName, `${collectionName}_a`, { restaurantId: tenantA, createdBy: 'managerA', name: collectionName });
  }

  const staffA = env.authenticatedContext('staffA', { email: 'staffa@example.com' }).firestore();
  const managerA = env.authenticatedContext('managerA', { email: 'managera@example.com' }).firestore();
  const staffB = env.authenticatedContext('staffB', { email: 'staffb@example.com' }).firestore();
  const superAdmin = env.authenticatedContext('superAdmin', { email: 'super@example.com', superAdmin: true }).firestore();
  const anon = env.unauthenticatedContext().firestore();

  await assertFails(updateDoc(doc(staffA, 'tasks', 'task_a'), { restaurantId: tenantB }));
  await assertFails(updateDoc(doc(managerA, 'tasks', 'task_a'), { restaurantId: tenantB }));
  await assertFails(updateDoc(doc(managerA, 'menuIntelligenceScans', 'scan_a'), { restaurantId: tenantB }));
  await assertFails(updateDoc(doc(managerA, 'menuDependencies', 'dep_a'), { restaurantId: tenantB }));
  await assertFails(updateDoc(doc(staffA, 'messages', 'msg_a'), { authorId: 'staffB' }));
  await assertFails(setDoc(doc(staffA, 'messages', 'bad_msg'), { restaurantId: tenantA, authorId: 'staffA', senderId: 'staffB', text: 'spoof' }));
  await assertFails(setDoc(doc(staffA, 'messages', 'bad_alert'), { restaurantId: tenantA, authorId: 'staffA', text: 'alert', systemAlert: true }));
  await assertFails(deleteDoc(doc(staffB, 'maintenanceLogs', 'maint_a')));
  await assertSucceeds(updateDoc(doc(managerA, 'maintenanceLogs', 'maint_a'), { status: 'in_progress', restaurantId: tenantA }));
  await assertFails(setDoc(doc(staffA, 'shiftSwaps', 'bad_swap'), { restaurantId: tenantA, requesterId: 'staffB', targetEmployeeId: 'staffA', acceptedBy: 'staffA', shiftId: 'shift_a', status: 'requested' }));

  for (const collectionName of ['inventoryItems', 'vendors', 'orders', 'wasteLogs', 'invoices', 'reports', 'exports']) {
    await assertSucceeds(deleteDoc(doc(managerA, collectionName, `${collectionName}_a`)));
    await seedDoc(env, collectionName, `${collectionName}_a2`, { restaurantId: tenantA, createdBy: 'managerA', name: collectionName });
    await assertFails(deleteDoc(doc(staffB, collectionName, `${collectionName}_a2`)));
  }
  await assertSucceeds(deleteDoc(doc(superAdmin, 'tasks', 'task_a')));
  await assertFails(deleteDoc(doc(anon, 'messages', 'msg_a')));
}

async function runStorageTests(env) {
  await env.clearStorage();
  await env.clearFirestore();
  const tenantA = 'tenant_a';
  const tenantB = 'tenant_b';
  await seedUser(env, 'staffA', { restaurantId: tenantA, workspaceIds: [tenantA], memberships: { [tenantA]: { isActive: true, permissions: {} } } });
  await seedUser(env, 'managerA', { restaurantId: tenantA, workspaceIds: [tenantA], memberships: { [tenantA]: { isActive: true, isAdmin: true, permissions: { inventory: true, maintenance: true, branding: true, hr: true } } } });
  await seedUser(env, 'staffB', { restaurantId: tenantB, workspaceIds: [tenantB], memberships: { [tenantB]: { isActive: true, permissions: {} } } });

  const managerStorage = env.authenticatedContext('managerA').storage();
  const staffAStorage = env.authenticatedContext('staffA').storage();
  const staffBStorage = env.authenticatedContext('staffB').storage();
  const image = new Blob(['x'], { type: 'image/png' });
  const pdf = new Blob(['%PDF-1.4'], { type: 'application/pdf' });

  await assertSucceeds(uploadBytes(ref(staffAStorage, `${tenantA}/profilePhotos/staffA/photo.png`), image, { contentType: 'image/png' }));
  await assertSucceeds(deleteObject(ref(staffAStorage, `${tenantA}/profilePhotos/staffA/photo.png`)));
  await assertSucceeds(uploadBytes(ref(managerStorage, `${tenantA}/brandAssets/logo.png`), image, { contentType: 'image/png' }));
  await assertFails(deleteObject(ref(staffBStorage, `${tenantA}/brandAssets/logo.png`)));
  await assertSucceeds(deleteObject(ref(managerStorage, `${tenantA}/brandAssets/logo.png`)));
  await assertSucceeds(uploadBytes(ref(managerStorage, `${tenantA}/invoices/invoice.pdf`), pdf, { contentType: 'application/pdf', customMetadata: { restaurantId: tenantA, purpose: 'invoice-scan' } }));
  await assertSucceeds(deleteObject(ref(managerStorage, `${tenantA}/invoices/invoice.pdf`)));
  await assertFails(uploadBytes(ref(managerStorage, `${tenantA}/menuUploads/bad.png`), image, { contentType: 'image/png', customMetadata: { restaurantId: tenantB, purpose: 'menu-scan' } }));
}

(async () => {
  requireEmulators();
  const env = await initializeTestEnvironment({
    projectId,
    firestore: { rules: fs.readFileSync(path.join(process.cwd(), 'firestore.rules'), 'utf8') },
    storage: { rules: fs.readFileSync(path.join(process.cwd(), 'storage.rules'), 'utf8') }
  });
  try {
    await runFirestoreTests(env);
    await runStorageTests(env);
    console.log('Firestore and Storage emulator security tests passed.');
  } finally {
    await env.cleanup();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
