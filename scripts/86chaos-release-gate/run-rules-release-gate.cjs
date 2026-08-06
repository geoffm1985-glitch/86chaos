const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');
const {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
} = require('firebase/firestore');
const {
  ref,
  uploadBytes,
  deleteObject,
} = require('firebase/storage');

const root = process.cwd();
const outDir = path.join(root, 'test-results', '86chaos-play-store-release-gate');
fs.mkdirSync(outDir, { recursive: true });
const report = { ok: true, generatedAt: new Date().toISOString(), tests: [], failures: [] };

async function check(name, fn) {
  try {
    await fn();
    report.tests.push({ name, ok: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    report.ok = false;
    const failure = { name, ok: false, error: String(error?.stack || error?.message || error).slice(0, 5000) };
    report.tests.push(failure);
    report.failures.push(failure);
    console.error(`FAIL ${name}\n${failure.error}`);
  }
}

(async () => {
  const projectId = `demo-86chaos-release-${Date.now()}`;
  const env = await initializeTestEnvironment({
    projectId,
    firestore: { rules: fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8') },
    storage: { rules: fs.readFileSync(path.join(root, 'storage.rules'), 'utf8') },
  });

  try {
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await setDoc(doc(db, 'restaurants', 'tenantA'), { ownerEmail: 'owner-a@example.com', ownerUid: 'ownerA', subscription: { planId: 'owner_pro', status: 'active', entitlementActive: true } });
      await setDoc(doc(db, 'restaurants', 'tenantB'), { ownerEmail: 'owner-b@example.com', ownerUid: 'ownerB', subscription: { planId: 'owner_pro', status: 'active', entitlementActive: true } });
      await setDoc(doc(db, 'users', 'ownerA'), {
        email: 'owner-a@example.com', restaurantId: 'tenantA', workspaceIds: ['tenantA'],
        memberships: { tenantA: { isActive: true, isOwner: true, accountRole: 'owner', permissions: { inventory: true, inventoryEdit: true, schedule: true, events: true, team: true, menuIntelligence: true, ops: true, maintenance: true } } },
      });
      await setDoc(doc(db, 'users', 'ownerB'), {
        email: 'owner-b@example.com', restaurantId: 'tenantB', workspaceIds: ['tenantB'],
        memberships: { tenantB: { isActive: true, isOwner: true, accountRole: 'owner', permissions: { inventory: true, inventoryEdit: true, schedule: true, events: true, team: true, menuIntelligence: true, ops: true, maintenance: true } } },
      });
      await setDoc(doc(db, 'users', 'staffA'), {
        email: 'staff-a@example.com', restaurantId: 'tenantA', workspaceIds: ['tenantA'],
        memberships: { tenantA: { isActive: true, accountRole: 'staff', permissions: {} } },
      });
      await setDoc(doc(db, 'users', 'managerA'), {
        email: 'manager-a@example.com', restaurantId: 'tenantA', workspaceIds: ['tenantA'],
        memberships: { tenantA: { isActive: true, accountRole: 'manager', permissions: { ops: true, team: true } } },
      });
      await setDoc(doc(db, 'inventoryItems', 'itemA'), { restaurantId: 'tenantA', name: 'QA Item', currentStock: 2 });
      await setDoc(doc(db, 'opsIntelligenceReports', 'tenantA_current'), { restaurantId: 'tenantA', generatedAt: new Date().toISOString(), summary: 'QA ops intelligence', qaOwned: true });
      await setDoc(doc(db, 'tasks', 'taskA'), { restaurantId: 'tenantA', title: 'QA Task', completed: false, createdBy: 'ownerA' });
      await setDoc(doc(db, 'menuIntelligenceScans', 'scanA'), { restaurantId: 'tenantA', status: 'review' });
      await setDoc(doc(db, 'messages', 'messageA'), { restaurantId: 'tenantA', authorId: 'staffA', userId: 'staffA', text: 'QA message', status: 'open' });
      await setDoc(doc(db, 'shiftSwaps', 'swapA'), { restaurantId: 'tenantA', requesterId: 'staffA', employeeId: 'staffA', shiftId: 'shift1', status: 'open' });
      await setDoc(doc(db, 'maintenanceLogs', 'maintenanceA'), { restaurantId: 'tenantA', reportedById: 'staffA', createdBy: 'staffA', notes: 'QA issue', status: 'open' });
    });

    const ownerA = env.authenticatedContext('ownerA', { email: 'owner-a@example.com' });
    const ownerB = env.authenticatedContext('ownerB', { email: 'owner-b@example.com' });
    const staffA = env.authenticatedContext('staffA', { email: 'staff-a@example.com' });
    const managerA = env.authenticatedContext('managerA', { email: 'manager-a@example.com' });
    const anon = env.unauthenticatedContext();

    await check('unauthenticated tenant read is denied', async () => {
      await assertFails(getDoc(doc(anon.firestore(), 'inventoryItems', 'itemA')));
    });

    await check('cross-tenant read is denied', async () => {
      await assertFails(getDoc(doc(ownerB.firestore(), 'inventoryItems', 'itemA')));
    });

    await check('authorized inventory delete succeeds', async () => {
      await assertSucceeds(deleteDoc(doc(ownerA.firestore(), 'inventoryItems', 'itemA')));
    });

    await check('task restaurantId cannot pivot across tenants', async () => {
      await assertFails(updateDoc(doc(ownerA.firestore(), 'tasks', 'taskA'), { restaurantId: 'tenantB' }));
    });

    await check('menu scan restaurantId cannot pivot across tenants', async () => {
      await assertFails(updateDoc(doc(ownerA.firestore(), 'menuIntelligenceScans', 'scanA'), { restaurantId: 'tenantB' }));
    });

    await check('message create rejects conflicting author identities', async () => {
      await assertFails(setDoc(doc(staffA.firestore(), 'messages', 'messageConflict'), {
        restaurantId: 'tenantA', authorId: 'staffA', userId: 'ownerB', createdBy: 'staffA', text: 'conflict', status: 'open'
      }));
    });

    await check('staff cannot turn own message into system alert', async () => {
      await assertFails(updateDoc(doc(staffA.firestore(), 'messages', 'messageA'), { isSystemAlert: true, messageCategory: '86 Alert' }));
    });

    await check('shift swap create cannot be authorized only through target employee', async () => {
      await assertFails(setDoc(doc(staffA.firestore(), 'shiftSwaps', 'swapConflict'), {
        restaurantId: 'tenantA', requesterId: 'ownerB', employeeId: 'ownerB', targetEmployeeId: 'staffA', acceptedBy: '', shiftId: 'shift2', status: 'open'
      }));
    });

    await check('maintenance create rejects conflicting reporter identities', async () => {
      await assertFails(setDoc(doc(staffA.firestore(), 'maintenanceLogs', 'maintenanceConflict'), {
        restaurantId: 'tenantA', reportedById: 'staffA', reportedByUid: 'ownerB', createdBy: 'staffA', notes: 'conflict', status: 'open'
      }));
    });

    await check('staff cannot delete another maintenance report', async () => {
      await assertFails(deleteDoc(doc(staffA.firestore(), 'maintenanceLogs', 'maintenanceA')));
    });


    await check('ops intelligence owner read succeeds', async () => {
      await assertSucceeds(getDoc(doc(ownerA.firestore(), 'opsIntelligenceReports', 'tenantA_current')));
    });

    await check('ops intelligence manager leadership read succeeds', async () => {
      await assertSucceeds(getDoc(doc(managerA.firestore(), 'opsIntelligenceReports', 'tenantA_current')));
    });

    await check('ops intelligence staff read is denied', async () => {
      await assertFails(getDoc(doc(staffA.firestore(), 'opsIntelligenceReports', 'tenantA_current')));
    });

    await check('ops intelligence cross tenant read is denied', async () => {
      await assertFails(getDoc(doc(ownerB.firestore(), 'opsIntelligenceReports', 'tenantA_current')));
    });

    await check('ops intelligence unauthenticated read is denied', async () => {
      await assertFails(getDoc(doc(anon.firestore(), 'opsIntelligenceReports', 'tenantA_current')));
    });

    await check('ops intelligence client writes are denied', async () => {
      await assertFails(setDoc(doc(ownerA.firestore(), 'opsIntelligenceReports', 'tenantA_client_write'), { restaurantId: 'tenantA', summary: 'client write' }));
      await assertFails(updateDoc(doc(ownerA.firestore(), 'opsIntelligenceReports', 'tenantA_current'), { summary: 'client update' }));
      await assertFails(deleteDoc(doc(ownerA.firestore(), 'opsIntelligenceReports', 'tenantA_current')));
    });

    await check('authorized profile-photo upload and delete succeed', async () => {
      const storage = ownerA.storage();
      const object = ref(storage, 'tenantA/profilePhotos/ownerA/avatar.png');
      await assertSucceeds(uploadBytes(object, new Uint8Array([137, 80, 78, 71]), { contentType: 'image/png' }));
      await assertSucceeds(deleteObject(object));
    });

    await check('cross-tenant storage deletion is denied', async () => {
      const ownerStorage = ownerA.storage();
      const otherStorage = ownerB.storage();
      const object = ref(ownerStorage, 'tenantA/profilePhotos/ownerA/cross-delete.png');
      await assertSucceeds(uploadBytes(object, new Uint8Array([137, 80, 78, 71]), { contentType: 'image/png' }));
      await assertFails(deleteObject(ref(otherStorage, 'tenantA/profilePhotos/ownerA/cross-delete.png')));
    });

    await check('invoice upload with mismatched tenant metadata is denied', async () => {
      const object = ref(ownerA.storage(), 'tenantA/invoices/mismatch.pdf');
      await assertFails(uploadBytes(object, new Uint8Array([37, 80, 68, 70]), {
        contentType: 'application/pdf',
        customMetadata: { purpose: 'invoice-scan', restaurantId: 'tenantB' },
      }));
    });
  } finally {
    await env.cleanup();
    fs.writeFileSync(path.join(outDir, 'firebase-rules-release-gate.json'), JSON.stringify(report, null, 2));
  }

  if (!report.ok) process.exitCode = 1;
})().catch(error => {
  report.ok = false;
  report.failures.push({ name: 'runner', error: String(error?.stack || error) });
  fs.writeFileSync(path.join(outDir, 'firebase-rules-release-gate.json'), JSON.stringify(report, null, 2));
  console.error(error);
  process.exitCode = 1;
});
