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
const { doc, setDoc, updateDoc, deleteDoc, writeBatch, runTransaction } = require('firebase/firestore');
const { ref, uploadBytes, getBlob, deleteObject } = require('firebase/storage');

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
  await seedUser(env, 'ownerA', { restaurantId: tenantA, workspaceIds: [tenantA], memberships: { [tenantA]: { isActive: true, isOwner: true, accountRole: 'owner', permissions: { team: true } } } });
  await seedUser(env, 'restaurantAdminA', { restaurantId: tenantA, workspaceIds: [tenantA], memberships: { [tenantA]: { isActive: true, isAdmin: true, permissions: { team: true } } } });
  await seedUser(env, 'teamLeadA', { restaurantId: tenantA, workspaceIds: [tenantA], memberships: { [tenantA]: { isActive: true, permissions: { team: true } } } });
  await seedUser(env, 'founder', { restaurantId: tenantA, email: 'geoffm1985@gmail.com', emailLower: 'geoffm1985@gmail.com', isSuperAdmin: true, systemAccess: { superAdmin: true }, memberships: { [tenantA]: { isActive: true, role: 'Kitchen' } } });
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
  const ownerA = env.authenticatedContext('ownerA', { email: 'ownera@example.com' }).firestore();
  const restaurantAdminA = env.authenticatedContext('restaurantAdminA', { email: 'restadmin@example.com' }).firestore();
  const teamLeadA = env.authenticatedContext('teamLeadA', { email: 'teamlead@example.com' }).firestore();
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



  // Platform authority must not be creatable or upgradable by tenant-level staff managers.
  const privilegedAuthorityValues = [true, 'true', 1, '1', 'yes', [], {}];
  const privilegedCreatePayloads = [
    ...privilegedAuthorityValues.map(value => ({ isSuperAdmin: value })),
    ...privilegedAuthorityValues.map(value => ({ systemAccess: { superAdmin: value } })),
    ...privilegedAuthorityValues.map(value => ({ systemAccess: { platformAdmin: value } })),
    ...privilegedAuthorityValues.map(value => ({ systemAccess: { systemAdministrator: value } })),
    ...privilegedAuthorityValues.map(value => ({ systemAccess: { rootAdmin: value } })),
    { systemAccess: { superAdmin: { nested: true } } },
    { systemAccess: { superAdmin: ['true'] } },
    { protectedRootAdmin: true },
    { foundingAdministrator: true },
    { rootAdmin: true }
  ];
  for (const [idx, privileged] of privilegedCreatePayloads.entries()) {
    await assertFails(setDoc(doc(staffA, 'users', `bad_priv_staff_${idx}`), { restaurantId: tenantA, name: 'Bad Staff', ...privileged }));
    await assertFails(setDoc(doc(managerA, 'users', `bad_priv_manager_${idx}`), { restaurantId: tenantA, name: 'Bad Manager', ...privileged }));
    await assertFails(setDoc(doc(ownerA, 'users', `bad_priv_owner_${idx}`), { restaurantId: tenantA, name: 'Bad Owner', ...privileged }));
    await assertFails(setDoc(doc(restaurantAdminA, 'users', `bad_priv_rest_admin_${idx}`), { restaurantId: tenantA, name: 'Bad Restaurant Admin', ...privileged }));
    await assertFails(setDoc(doc(teamLeadA, 'users', `bad_priv_team_${idx}`), { restaurantId: tenantA, name: 'Bad Team', ...privileged }));
  }
  await assertSucceeds(setDoc(doc(managerA, 'users', 'safe_created_employee'), {
    restaurantId: tenantA,
    workspaceIds: [tenantA],
    name: 'Safe Employee',
    role: 'Kitchen',
    isSuperAdmin: false,
    systemAccess: {},
    permissions: { schedule: false }
  }));
  await assertSucceeds(setDoc(doc(ownerA, 'users', 'safe_invited_employee'), {
    restaurantId: tenantA,
    workspaceIds: [tenantA],
    name: 'Safe Invited Employee',
    role: 'Staff',
    isSuperAdmin: false,
    systemAccess: { superAdmin: false }
  }));
  await seedUser(env, 'ordinaryTarget', { restaurantId: tenantA, workspaceIds: [tenantA], name: 'Ordinary Target', isSuperAdmin: false, systemAccess: {} });
  for (const value of privilegedAuthorityValues) {
    await assertFails(updateDoc(doc(managerA, 'users', 'ordinaryTarget'), { isSuperAdmin: value }));
    await assertFails(updateDoc(doc(managerA, 'users', 'ordinaryTarget'), { systemAccess: { superAdmin: value } }));
    await assertFails(updateDoc(doc(managerA, 'users', 'ordinaryTarget'), { 'systemAccess.superAdmin': value }));
  }
  const batch = writeBatch(managerA);
  batch.set(doc(managerA, 'users', 'bad_priv_batch'), { restaurantId: tenantA, name: 'Bad Batch', systemAccess: { superAdmin: true } });
  await assertFails(batch.commit());
  await assertFails(runTransaction(managerA, async (tx) => {
    tx.set(doc(managerA, 'users', 'bad_priv_transaction'), { restaurantId: tenantA, name: 'Bad Transaction', isSuperAdmin: true });
  }));
  await assertFails(updateDoc(doc(managerA, 'users', 'founder'), { isSuperAdmin: false, systemAccess: { superAdmin: false } }));
  await assertSucceeds(updateDoc(doc(managerA, 'users', 'safe_created_employee'), { phone: '920-555-0101', role: 'Prep Cook', restaurantId: tenantA }));
  await assertSucceeds(setDoc(doc(superAdmin, 'users', 'trusted_backend_like_admin'), { restaurantId: tenantA, name: 'Trusted Admin Write', isSuperAdmin: true, systemAccess: { superAdmin: true } }));

  const pushDevice = {
    token: 'test-token',
    platform: 'web',
    browser: 'Chrome',
    host: 'localhost',
    permission: 'granted',
    active: true,
    createdAt: '2026-07-26T00:00:00.000Z',
    lastVerifiedAt: '2026-07-26T00:00:00.000Z',
    updatedAt: '2026-07-26T00:00:00.000Z'
  };
  await assertSucceeds(updateDoc(doc(staffA, 'users', 'staffA'), {
    'pushDevices.web_test': pushDevice,
    pushTokenCanonical: true,
    pushTokenDedupeVersion: '16.0.32',
    fcmToken: 'test-token',
    notificationPermission: 'granted'
  }));
  await assertFails(updateDoc(doc(staffA, 'users', 'staffA'), {
    isSuperAdmin: true,
    'pushDevices.web_test': pushDevice
  }));

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
  await seedDoc(env, 'restaurants', tenantA, { planId: 'owner_pro', subscription: { planId: 'owner_pro', status: 'active', entitlementActive: true }, ownerUid: 'ownerA', ownerEmail: 'ownera@example.com' });
  await seedDoc(env, 'restaurants', tenantB, { planId: 'owner_pro', subscription: { planId: 'owner_pro', status: 'active', entitlementActive: true }, ownerUid: 'ownerB', ownerEmail: 'ownerb@example.com' });
  await seedUser(env, 'staffA', { restaurantId: tenantA, workspaceIds: [tenantA], memberships: { [tenantA]: { isActive: true, permissions: {} } } });
  await seedUser(env, 'managerA', { restaurantId: tenantA, workspaceIds: [tenantA], memberships: { [tenantA]: { isActive: true, isAdmin: true, permissions: { inventory: true, maintenance: true, branding: true, hr: true } } } });
  await seedUser(env, 'ownerA', { restaurantId: tenantA, workspaceIds: [tenantA], memberships: { [tenantA]: { isActive: true, isOwner: true, accountRole: 'owner', permissions: { backOffice: true, ownerTools: true } } } });
  await seedUser(env, 'vaultA', { restaurantId: tenantA, workspaceIds: [tenantA], memberships: { [tenantA]: { isActive: true, permissions: { backOffice: true } } } });
  await seedUser(env, 'staffB', { restaurantId: tenantB, workspaceIds: [tenantB], memberships: { [tenantB]: { isActive: true, permissions: {} } } });
  await seedUser(env, 'superAdmin', { isSuperAdmin: true, systemAccess: { superAdmin: true }, memberships: { [tenantA]: { isActive: true, role: 'Kitchen' } } });

  const managerStorage = env.authenticatedContext('managerA').storage();
  const staffAStorage = env.authenticatedContext('staffA').storage();
  const staffBStorage = env.authenticatedContext('staffB').storage();
  const ownerStorage = env.authenticatedContext('ownerA').storage();
  const vaultStorage = env.authenticatedContext('vaultA').storage();
  const superStorage = env.authenticatedContext('superAdmin', { superAdmin: true }).storage();
  const image = new Blob(['x'], { type: 'image/png' });
  const pdf = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
  const csv = new Blob(['date,total\n2026-08-01,42'], { type: 'text/csv' });
  const docx = new Blob(['PK\u0003\u0004docx'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const executable = new Blob(['MZ'], { type: 'application/x-msdownload' });
  const tooLarge = new Blob([new Uint8Array((12 * 1024 * 1024) + 1)], { type: 'application/pdf' });

  await assertSucceeds(uploadBytes(ref(staffAStorage, `${tenantA}/profilePhotos/staffA/photo.png`), image, { contentType: 'image/png' }));
  await assertSucceeds(deleteObject(ref(staffAStorage, `${tenantA}/profilePhotos/staffA/photo.png`)));
  await assertSucceeds(uploadBytes(ref(managerStorage, `${tenantA}/brandAssets/logo.png`), image, { contentType: 'image/png' }));
  await assertFails(deleteObject(ref(staffBStorage, `${tenantA}/brandAssets/logo.png`)));
  await assertSucceeds(deleteObject(ref(managerStorage, `${tenantA}/brandAssets/logo.png`)));
  await assertSucceeds(uploadBytes(ref(managerStorage, `${tenantA}/invoices/invoice.pdf`), pdf, { contentType: 'application/pdf', customMetadata: { restaurantId: tenantA, purpose: 'invoice-scan' } }));
  await assertSucceeds(deleteObject(ref(managerStorage, `${tenantA}/invoices/invoice.pdf`)));
  await assertFails(uploadBytes(ref(managerStorage, `${tenantA}/menuUploads/bad.png`), image, { contentType: 'image/png', customMetadata: { restaurantId: tenantB, purpose: 'menu-scan' } }));

  const vaultStoragePath = `restaurants/${tenantA}/back-office/document-vault/record1/permit.pdf`;
  const vaultMeta = { purpose: 'document-vault', restaurantId: tenantA, recordId: 'record1', uploadedBy: 'ownerA', source: '86chaos-document-vault' };
  await assertSucceeds(uploadBytes(ref(ownerStorage, vaultStoragePath), pdf, { contentType: 'application/pdf', customMetadata: vaultMeta }));
  await assertSucceeds(getBlob(ref(ownerStorage, vaultStoragePath)));
  await assertFails(getBlob(ref(staffAStorage, vaultStoragePath)));
  await assertFails(getBlob(ref(staffBStorage, vaultStoragePath)));
  await assertFails(deleteObject(ref(staffBStorage, vaultStoragePath)));
  await assertSucceeds(deleteObject(ref(ownerStorage, vaultStoragePath)));

  await assertSucceeds(uploadBytes(ref(superStorage, `restaurants/${tenantA}/back-office/document-vault/record2/inspection.csv`), csv, { contentType: 'text/csv', customMetadata: { purpose: 'document-vault', restaurantId: tenantA, recordId: 'record2', uploadedBy: 'superAdmin', source: '86chaos-document-vault' } }));
  await assertSucceeds(uploadBytes(ref(vaultStorage, `restaurants/${tenantA}/back-office/document-vault/record3/policy.docx`), docx, { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', customMetadata: { purpose: 'document-vault', restaurantId: tenantA, recordId: 'record3', uploadedBy: 'vaultA', source: '86chaos-document-vault' } }));
  await assertFails(uploadBytes(ref(staffAStorage, `restaurants/${tenantA}/back-office/document-vault/record4/secret.pdf`), pdf, { contentType: 'application/pdf', customMetadata: { purpose: 'document-vault', restaurantId: tenantA, recordId: 'record4', uploadedBy: 'staffA', source: '86chaos-document-vault' } }));
  await assertFails(uploadBytes(ref(ownerStorage, `restaurants/${tenantA}/back-office/document-vault/record5/wrong.pdf`), pdf, { contentType: 'application/pdf', customMetadata: { purpose: 'document-vault', restaurantId: tenantB, recordId: 'record5', uploadedBy: 'ownerA', source: '86chaos-document-vault' } }));
  await assertFails(uploadBytes(ref(ownerStorage, `restaurants/${tenantA}/back-office/document-vault/record6/wrong.pdf`), pdf, { contentType: 'application/pdf', customMetadata: { purpose: 'document-vault', restaurantId: tenantA, recordId: 'otherRecord', uploadedBy: 'ownerA', source: '86chaos-document-vault' } }));
  await assertFails(uploadBytes(ref(ownerStorage, `restaurants/${tenantA}/back-office/document-vault/record7/missing-purpose.pdf`), pdf, { contentType: 'application/pdf', customMetadata: { restaurantId: tenantA, recordId: 'record7', uploadedBy: 'ownerA', source: '86chaos-document-vault' } }));
  await assertFails(uploadBytes(ref(ownerStorage, `restaurants/${tenantA}/back-office/document-vault/record8/big.pdf`), tooLarge, { contentType: 'application/pdf', customMetadata: { purpose: 'document-vault', restaurantId: tenantA, recordId: 'record8', uploadedBy: 'ownerA', source: '86chaos-document-vault' } }));
  await assertFails(uploadBytes(ref(ownerStorage, `restaurants/${tenantA}/back-office/document-vault/record9/run.exe`), executable, { contentType: 'application/x-msdownload', customMetadata: { purpose: 'document-vault', restaurantId: tenantA, recordId: 'record9', uploadedBy: 'ownerA', source: '86chaos-document-vault' } }));
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
