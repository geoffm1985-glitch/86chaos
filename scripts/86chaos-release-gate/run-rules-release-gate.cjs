#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
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
const { ensureRunDir, writeJson } = require('./run-context.cjs');

const root = process.cwd();
const { runId, runDir } = ensureRunDir();
const activeEmulatorProjectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT || 'demo-no-project';
const firestoreEmulatorHost = process.env.FIRESTORE_EMULATOR_HOST || '';
const storageEmulatorHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST || process.env.STORAGE_EMULATOR_HOST || '';
const reportPath = path.join(runDir, 'firebase-rules-release-gate.json');

function nowIso() {
  return new Date().toISOString();
}

function emptyReport() {
  return {
    ok: true,
    runId,
    generatedAt: nowIso(),
    activeEmulatorProjectId,
    firestoreEmulatorHost,
    storageEmulatorHost,
    totalCases: 0,
    passed: 0,
    failed: 0,
    blocked: 0,
    notRun: 0,
    harnessErrors: [],
    assertionFailures: [],
    ruleEvaluationErrors: [],
    firstActionableFailure: '',
    tests: [],
    failures: [],
    truth: [
      'This focused smoke suite is additional evidence only. The complete canonical npm run test:rules suite remains authoritative.',
      'Firestore and Storage clients are created once per authenticated context and then reused across cases.',
      'The rules-unit-testing project ID is resolved from the emulator-provided project namespace.',
      'No passwords, tokens, service-account values, API keys, or full custom-claim payloads are written to this report.',
    ],
  };
}

const report = emptyReport();
let firstHarnessFailure = null;
const capturedConsole = [];
const originalConsoleError = console.error.bind(console);
const originalConsoleWarn = console.warn.bind(console);

function captureConsole(kind, args) {
  const text = args.map(value => {
    if (value instanceof Error) return value.stack || value.message;
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value); } catch { return String(value); }
  }).join(' ');
  if (/Firestore has already been started|settings can no longer be changed|Error evaluating|get\(\) called with|Null value|Property .* is undefined/i.test(text)) {
    capturedConsole.push({ kind, text: text.slice(0, 1200) });
  }
}

console.error = (...args) => {
  captureConsole('error', args);
  originalConsoleError(...args);
};
console.warn = (...args) => {
  captureConsole('warn', args);
  originalConsoleWarn(...args);
};

function classifyError(error) {
  const text = String(error?.stack || error?.message || error || '');
  if (/Firestore has already been started|settings can no longer be changed|already started/i.test(text)) return 'harness_lifecycle_error';
  if (/Error evaluating|rules_evaluation|Property .* is undefined|Null value|invalid argument|get\(\) called with/i.test(text)) return 'rules_evaluation_error';
  if (/Expected request to fail, but it succeeded|Expected to fail/i.test(text)) return 'unexpected_allow';
  if (/Expected request to succeed, but got|PERMISSION_DENIED|permission-denied|Expected to succeed/i.test(text)) return 'unexpected_deny';
  return 'assertion_failure';
}

function summarizeError(error) {
  return String(error?.stack || error?.message || error || '').slice(0, 5000);
}

function record(row) {
  report.tests.push(row);
  report.totalCases = report.tests.length;
  if (row.status === 'passed') report.passed += 1;
  if (row.status === 'failed') report.failed += 1;
  if (row.status === 'blocked') report.blocked += 1;
  if (row.status === 'not_run') report.notRun += 1;
  if (row.status !== 'passed') report.ok = false;
  if (row.status === 'failed') {
    report.failures.push(row);
    if (row.failureType === 'harness_lifecycle_error') report.harnessErrors.push(row);
    else if (row.failureType === 'rules_evaluation_error') report.ruleEvaluationErrors.push(row);
    else report.assertionFailures.push(row);
    if (!report.firstActionableFailure) {
      report.firstActionableFailure = `${row.failureType}: ${row.name}: ${row.error || row.actualResult || 'failed'}`.slice(0, 1200);
    }
  }
}

async function check(name, expectedResult, fn) {
  const startedAt = Date.now();
  if (firstHarnessFailure) {
    const row = {
      name,
      expectedResult,
      actualResult: 'blocked by earlier harness lifecycle error',
      status: 'blocked',
      failureType: 'blocked',
      durationMs: 0,
      blockedBy: firstHarnessFailure.name,
    };
    record(row);
    console.log(`BLOCKED ${name}`);
    return;
  }
  try {
    await fn();
    const row = {
      name,
      expectedResult,
      actualResult: expectedResult,
      status: 'passed',
      durationMs: Date.now() - startedAt,
    };
    record(row);
    console.log(`PASS ${name}`);
  } catch (error) {
    const failureType = classifyError(error);
    const row = {
      name,
      expectedResult,
      actualResult: 'failed',
      status: 'failed',
      failureType,
      durationMs: Date.now() - startedAt,
      error: summarizeError(error),
    };
    if (failureType === 'harness_lifecycle_error') firstHarnessFailure = row;
    record(row);
    console.error(`FAIL ${name}\n${row.error}`);
  }
}

function requireEmulatorOnly() {
  const errors = [];
  if (!firestoreEmulatorHost || /googleapis\.com/i.test(firestoreEmulatorHost)) {
    errors.push('Focused rules release gate requires FIRESTORE_EMULATOR_HOST and refuses production Firestore hosts.');
  }
  if (!storageEmulatorHost || /googleapis\.com/i.test(storageEmulatorHost)) {
    errors.push('Focused rules release gate requires FIREBASE_STORAGE_EMULATOR_HOST/STORAGE_EMULATOR_HOST and refuses production Storage hosts.');
  }
  if (/^cheers-34b8d$/i.test(activeEmulatorProjectId)) {
    errors.push('Focused rules release gate refuses the production Firebase project ID cheers-34b8d.');
  }
  if (errors.length) {
    const error = new Error(errors.join(' '));
    error.name = 'EmulatorSafetyError';
    throw error;
  }
}

async function seedBaseData(env) {
  await env.clearFirestore();
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'restaurants', 'tenantA'), { ownerEmail: 'owner-a@example.com', ownerUid: 'ownerA', subscription: { planId: 'owner_pro', status: 'active', entitlementActive: true } });
    await setDoc(doc(db, 'restaurants', 'tenantB'), { ownerEmail: 'owner-b@example.com', ownerUid: 'ownerB', subscription: { planId: 'owner_pro', status: 'active', entitlementActive: true } });
    await setDoc(doc(db, 'users', 'ownerA'), {
      email: 'owner-a@example.com', restaurantId: 'tenantA', workspaceIds: ['tenantA'],
      memberships: { tenantA: { isActive: true, isOwner: true, accountRole: 'owner', permissions: { inventory: true, inventoryEdit: true, schedule: true, events: true, team: true, menuIntelligence: true, ops: true, maintenance: true, backOffice: true, ownerTools: true } } },
    });
    await setDoc(doc(db, 'users', 'ownerB'), {
      email: 'owner-b@example.com', restaurantId: 'tenantB', workspaceIds: ['tenantB'],
      memberships: { tenantB: { isActive: true, isOwner: true, accountRole: 'owner', permissions: { inventory: true, inventoryEdit: true, schedule: true, events: true, team: true, menuIntelligence: true, ops: true, maintenance: true } } },
    });
    await setDoc(doc(db, 'users', 'staffA'), {
      email: 'staff-a@example.com', restaurantId: 'tenantA', workspaceIds: ['tenantA'],
      memberships: { tenantA: { isActive: true, accountRole: 'staff', permissions: {} } },
    });
    await setDoc(doc(db, 'users', 'staffB'), {
      email: 'staff-b@example.com', restaurantId: 'tenantB', workspaceIds: ['tenantB'],
      memberships: { tenantB: { isActive: true, accountRole: 'staff', permissions: {} } },
    });
    await setDoc(doc(db, 'users', 'managerA'), {
      email: 'manager-a@example.com', restaurantId: 'tenantA', workspaceIds: ['tenantA'],
      memberships: { tenantA: { isActive: true, accountRole: 'manager', isAdmin: true, permissions: { ops: true, team: true, inventory: true, inventoryEdit: true, menuIntelligence: true, maintenance: true } } },
    });
    await setDoc(doc(db, 'inventoryItems', 'itemA'), { restaurantId: 'tenantA', name: 'QA Item', currentStock: 2 });
    await setDoc(doc(db, 'inventoryItems', 'itemDeleteA'), { restaurantId: 'tenantA', name: 'QA Delete Item', currentStock: 2 });
    await setDoc(doc(db, 'opsIntelligenceReports', 'tenantA_current'), { restaurantId: 'tenantA', generatedAt: new Date().toISOString(), summary: 'QA ops intelligence', qaOwned: true });
    await setDoc(doc(db, 'tasks', 'taskA'), { restaurantId: 'tenantA', title: 'QA Task', completed: false, createdBy: 'ownerA' });
    await setDoc(doc(db, 'menuIntelligenceScans', 'scanA'), { restaurantId: 'tenantA', status: 'review', createdBy: 'ownerA' });
    await setDoc(doc(db, 'messages', 'messageA'), { restaurantId: 'tenantA', authorId: 'staffA', userId: 'staffA', createdBy: 'staffA', senderId: 'staffA', text: 'QA message', status: 'open' });
    await setDoc(doc(db, 'shiftSwaps', 'swapA'), { restaurantId: 'tenantA', requesterId: 'staffA', employeeId: 'staffA', shiftId: 'shift1', status: 'open' });
    await setDoc(doc(db, 'maintenanceLogs', 'maintenanceA'), { restaurantId: 'tenantA', reportedById: 'staffA', reportedByUid: 'staffA', createdBy: 'staffA', notes: 'QA issue', status: 'open' });
  });
}

async function verifySeededProfiles(env) {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    for (const uid of ['ownerA', 'ownerB', 'staffA', 'staffB', 'managerA']) {
      const snapshot = await getDoc(doc(db, 'users', uid));
      assert.equal(snapshot.exists(), true, `Seeded Storage profile users/${uid} must exist in emulator project ${activeEmulatorProjectId}`);
    }
  });
}

async function main() {
  requireEmulatorOnly();
  const env = await initializeTestEnvironment({
    projectId: activeEmulatorProjectId,
    firestore: { rules: fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8') },
    storage: { rules: fs.readFileSync(path.join(root, 'storage.rules'), 'utf8') },
  });

  try {
    await seedBaseData(env);
    await verifySeededProfiles(env);

    const ownerAContext = env.authenticatedContext('ownerA', { email: 'owner-a@example.com' });
    const ownerBContext = env.authenticatedContext('ownerB', { email: 'owner-b@example.com' });
    const staffAContext = env.authenticatedContext('staffA', { email: 'staff-a@example.com' });
    const staffBContext = env.authenticatedContext('staffB', { email: 'staff-b@example.com' });
    const managerAContext = env.authenticatedContext('managerA', { email: 'manager-a@example.com' });
    const missingProfileContext = env.authenticatedContext('missingProfile', { email: 'missing-profile@example.com' });
    const anonContext = env.unauthenticatedContext();

    const db = {
      ownerA: ownerAContext.firestore(),
      ownerB: ownerBContext.firestore(),
      staffA: staffAContext.firestore(),
      staffB: staffBContext.firestore(),
      managerA: managerAContext.firestore(),
      anon: anonContext.firestore(),
    };
    const storage = {
      ownerA: ownerAContext.storage(),
      ownerB: ownerBContext.storage(),
      staffA: staffAContext.storage(),
      staffB: staffBContext.storage(),
      managerA: managerAContext.storage(),
      missingProfile: missingProfileContext.storage(),
    };

    const image = new Blob(['image'], { type: 'image/png' });
    const pdf = new Blob(['%PDF-1.4'], { type: 'application/pdf' });

    await check('cached Firestore clients survive repeated sequential use', 'multiple operations succeed without client reinitialization', async () => {
      await assertSucceeds(getDoc(doc(db.ownerA, 'inventoryItems', 'itemA')));
      await assertSucceeds(getDoc(doc(db.ownerA, 'tasks', 'taskA')));
      await assertFails(getDoc(doc(db.ownerB, 'inventoryItems', 'itemA')));
      await assertSucceeds(getDoc(doc(db.ownerA, 'opsIntelligenceReports', 'tenantA_current')));
    });

    await check('unauthenticated tenant read is denied', 'deny', async () => {
      await assertFails(getDoc(doc(db.anon, 'inventoryItems', 'itemA')));
    });

    await check('cross-tenant read is denied', 'deny', async () => {
      await assertFails(getDoc(doc(db.ownerB, 'inventoryItems', 'itemA')));
    });

    await check('authorized inventory delete succeeds', 'allow', async () => {
      await assertSucceeds(deleteDoc(doc(db.ownerA, 'inventoryItems', 'itemDeleteA')));
    });

    await check('task restaurantId cannot pivot across tenants', 'deny', async () => {
      await assertFails(updateDoc(doc(db.ownerA, 'tasks', 'taskA'), { restaurantId: 'tenantB' }));
    });

    await check('menu scan restaurantId cannot pivot across tenants', 'deny', async () => {
      await assertFails(updateDoc(doc(db.ownerA, 'menuIntelligenceScans', 'scanA'), { restaurantId: 'tenantB' }));
    });

    await check('message create rejects conflicting author identities', 'deny', async () => {
      await assertFails(setDoc(doc(db.staffA, 'messages', 'messageConflict'), {
        restaurantId: 'tenantA', authorId: 'staffA', userId: 'ownerB', createdBy: 'staffA', senderId: 'staffA', text: 'conflict', status: 'open'
      }));
    });

    await check('staff cannot turn own message into system alert', 'deny', async () => {
      await assertFails(updateDoc(doc(db.staffA, 'messages', 'messageA'), { isSystemAlert: true, messageCategory: '86 Alert' }));
    });

    await check('shift swap create cannot be authorized only through target employee', 'deny', async () => {
      await assertFails(setDoc(doc(db.staffA, 'shiftSwaps', 'swapConflict'), {
        restaurantId: 'tenantA', requesterId: 'ownerB', employeeId: 'ownerB', targetEmployeeId: 'staffA', acceptedBy: '', shiftId: 'shift2', status: 'open'
      }));
    });

    await check('maintenance create rejects conflicting reporter identities', 'deny', async () => {
      await assertFails(setDoc(doc(db.staffA, 'maintenanceLogs', 'maintenanceConflict'), {
        restaurantId: 'tenantA', reportedById: 'staffA', reportedByUid: 'ownerB', createdBy: 'staffA', notes: 'conflict', status: 'open'
      }));
    });

    await check('staff cannot delete another maintenance report', 'deny', async () => {
      await assertFails(deleteDoc(doc(db.staffA, 'maintenanceLogs', 'maintenanceA')));
    });

    await check('ops intelligence owner read succeeds', 'allow', async () => {
      await assertSucceeds(getDoc(doc(db.ownerA, 'opsIntelligenceReports', 'tenantA_current')));
    });

    await check('ops intelligence manager leadership read succeeds', 'allow', async () => {
      await assertSucceeds(getDoc(doc(db.managerA, 'opsIntelligenceReports', 'tenantA_current')));
    });

    await check('ops intelligence staff read is denied', 'deny', async () => {
      await assertFails(getDoc(doc(db.staffA, 'opsIntelligenceReports', 'tenantA_current')));
    });

    await check('ops intelligence cross tenant read is denied', 'deny', async () => {
      await assertFails(getDoc(doc(db.ownerB, 'opsIntelligenceReports', 'tenantA_current')));
    });

    await check('ops intelligence unauthenticated read is denied', 'deny', async () => {
      await assertFails(getDoc(doc(db.anon, 'opsIntelligenceReports', 'tenantA_current')));
    });

    await check('ops intelligence client writes are denied', 'deny', async () => {
      await assertFails(setDoc(doc(db.ownerA, 'opsIntelligenceReports', 'tenantA_client_write'), { restaurantId: 'tenantA', summary: 'client write' }));
      await assertFails(updateDoc(doc(db.ownerA, 'opsIntelligenceReports', 'tenantA_current'), { summary: 'client update' }));
      await assertFails(deleteDoc(doc(db.ownerA, 'opsIntelligenceReports', 'tenantA_current')));
    });

    await check('authorized profile-photo upload and delete succeed', 'allow', async () => {
      const object = ref(storage.ownerA, 'tenantA/profilePhotos/ownerA/avatar.png');
      await assertSucceeds(uploadBytes(object, image, { contentType: 'image/png' }));
      await assertSucceeds(deleteObject(object));
    });

    await check('missing Storage user profile denies cleanly', 'deny without harness lifecycle error', async () => {
      const object = ref(storage.missingProfile, 'tenantA/profilePhotos/missingProfile/avatar.png');
      await assertFails(uploadBytes(object, image, { contentType: 'image/png' }));
    });

    await check('cross-tenant storage deletion is denied', 'deny after authorized setup succeeds', async () => {
      const object = ref(storage.ownerA, 'tenantA/profilePhotos/ownerA/cross-delete.png');
      await assertSucceeds(uploadBytes(object, image, { contentType: 'image/png' }));
      await assertFails(deleteObject(ref(storage.ownerB, 'tenantA/profilePhotos/ownerA/cross-delete.png')));
      await assertSucceeds(deleteObject(object));
    });

    await check('authorized invoice metadata upload succeeds', 'allow', async () => {
      const object = ref(storage.managerA, 'tenantA/invoices/positive-control.pdf');
      await assertSucceeds(uploadBytes(object, pdf, {
        contentType: 'application/pdf',
        customMetadata: { purpose: 'invoice-scan', restaurantId: 'tenantA' },
      }));
      await assertSucceeds(deleteObject(object));
    });

    await check('invoice upload with mismatched tenant metadata is denied', 'deny after invoice positive control succeeds', async () => {
      const object = ref(storage.managerA, 'tenantA/invoices/mismatch.pdf');
      await assertFails(uploadBytes(object, pdf, {
        contentType: 'application/pdf',
        customMetadata: { purpose: 'invoice-scan', restaurantId: 'tenantB' },
      }));
    });

    await check('no Firestore started-settings lifecycle errors were captured', 'no lifecycle error text', async () => {
      assert.equal(capturedConsole.some(row => /Firestore has already been started|settings can no longer be changed/i.test(row.text)), false);
    });
  } finally {
    report.consoleRuleDiagnostics = capturedConsole;
    await env.cleanup();
  }
}

main().catch(error => {
  report.ok = false;
  const failureType = classifyError(error);
  const row = {
    name: 'focused rules harness runner',
    expectedResult: 'runner completes safely against local emulators',
    actualResult: 'failed',
    status: 'failed',
    failureType,
    durationMs: 0,
    error: summarizeError(error),
  };
  record(row);
  console.error(error.stack || error.message || String(error));
}).finally(() => {
  report.finishedAt = nowIso();
  if (!report.firstActionableFailure && report.failures.length) {
    const row = report.failures[0];
    report.firstActionableFailure = `${row.failureType || 'failure'}: ${row.name}: ${row.error || row.actualResult || 'failed'}`.slice(0, 1200);
  }
  writeJson(reportPath, report);
  console.log(JSON.stringify({ ok: report.ok, runId, activeEmulatorProjectId, output: reportPath, passed: report.passed, failed: report.failed, blocked: report.blocked, firstActionableFailure: report.firstActionableFailure }, null, 2));
  if (!report.ok) process.exitCode = 1;
});
