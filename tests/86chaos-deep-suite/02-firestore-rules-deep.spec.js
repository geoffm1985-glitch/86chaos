// 86 Chaos Firestore Rules Deep Test
// Uses Firebase Web SDK directly to verify the database doors are locked correctly.
const { test, expect } = require('@playwright/test');
require('dotenv').config();

function firebaseConfigFromEnv() {
  const apiKey = process.env.REACT_APP_TEST_FIREBASE_API_KEY || process.env.REACT_APP_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;
  const authDomain = process.env.REACT_APP_TEST_FIREBASE_AUTH_DOMAIN || process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.REACT_APP_TEST_FIREBASE_PROJECT_ID || process.env.REACT_APP_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'chaos-test-d1601';
  const storageBucket = process.env.REACT_APP_TEST_FIREBASE_STORAGE_BUCKET || process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET;
  const appId = process.env.REACT_APP_TEST_FIREBASE_APP_ID || process.env.REACT_APP_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || 'playwright-test';
  if (!apiKey || !authDomain || !projectId) return null;
  return { apiKey, authDomain, projectId, storageBucket, appId };
}

async function expectAllowed(label, promise, results) {
  try {
    const value = await promise;
    results.push({ label, allowed: true });
    return value;
  } catch (error) {
    results.push({ label, allowed: false, code: error.code, message: error.message });
    throw error;
  }
}

async function expectDenied(label, promise, results) {
  try {
    await promise;
    results.push({ label, denied: false });
    throw new Error(`${label} was unexpectedly allowed`);
  } catch (error) {
    if (/unexpectedly allowed/.test(error.message)) throw error;
    results.push({ label, denied: true, code: error.code, message: error.message });
    expect(/permission-denied|PERMISSION_DENIED|Missing or insufficient permissions/i.test(`${error.code} ${error.message}`)).toBeTruthy();
  }
}

test.describe('86 Chaos Firestore Rules Deep Test', () => {
  test('browser users cannot bypass owner/back-office/server-only rules', async ({}, testInfo) => {
    test.setTimeout(180000);
    const config = firebaseConfigFromEnv();
    test.skip(!config, 'Missing Firebase web config env vars. Add REACT_APP_TEST_FIREBASE_* values to .env.');
    test.skip(!process.env.TEST_EMAIL || !process.env.TEST_PASSWORD, 'Missing TEST_EMAIL or TEST_PASSWORD.');

    const { initializeApp, deleteApp } = require('firebase/app');
    const { getAuth, signInWithEmailAndPassword, signOut } = require('firebase/auth');
    const { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } = require('firebase/firestore');

    const app = initializeApp(config, `rules-${Date.now()}`);
    const auth = getAuth(app);
    const db = getFirestore(app);
    const results = [];
    const problems = [];
    const runId = `rules-${Date.now()}`;

    try {
      const cred = await signInWithEmailAndPassword(auth, process.env.TEST_EMAIL, process.env.TEST_PASSWORD);
      const uid = cred.user.uid;
      const userSnap = await expectAllowed('read own users/{uid}', getDoc(doc(db, 'users', uid)), results);
      const user = userSnap.exists() ? userSnap.data() : {};
      const restaurantId = process.env.TEST_RESTAURANT_ID || user.restaurantId || user.activeRestaurantId || (Array.isArray(user.workspaceIds) ? user.workspaceIds[0] : null) || 'cheers-test';

      await expectDenied(
        'browser cannot create restaurantAdminAlerts directly',
        setDoc(doc(db, 'restaurantAdminAlerts', `${runId}-alert`), {
          restaurantId,
          type: 'playwright-direct-alert',
          status: 'open',
          title: 'Should be denied',
          createdAt: serverTimestamp(),
        }),
        results
      );

      await expectDenied(
        'browser cannot write QuickBooks secrets',
        setDoc(doc(db, 'quickBooksSettings', `${restaurantId}_${runId}_secret`), {
          restaurantId,
          refreshToken: 'must-not-write',
          clientSecret: 'must-not-write',
          createdAt: serverTimestamp(),
        }),
        results
      );

      await expectDenied(
        'browser cannot write server-only aiUsage',
        setDoc(doc(db, 'aiUsage', `${restaurantId}_${runId}`), {
          restaurantId,
          used: 999,
          createdAt: serverTimestamp(),
        }),
        results
      );

      // Owner Pro/admin accounts should be able to create a non-secret QuickBooks settings shell and a Back Office record.
      // If this fails, it may mean the test account is not Owner Pro/admin. The report makes that obvious.
      let qbShellPath = null;
      try {
        qbShellPath = `quickBooksSettings/${restaurantId}_${runId}_safe`;
        await setDoc(doc(db, qbShellPath), {
          restaurantId,
          status: 'disconnected',
          mapping: { foodPurchases: 'Test Food Purchases' },
          testRunId: runId,
          createdAt: serverTimestamp(),
        });
        results.push({ label: 'owner/admin can write non-secret quickBooksSettings shell', allowed: true });
      } catch (error) {
        results.push({ label: 'owner/admin can write non-secret quickBooksSettings shell', allowed: false, code: error.code, message: error.message });
        if (String(process.env.STRICT_OWNER_PRO_RULES || '').toLowerCase() === 'true') problems.push({ type: 'owner-pro-write-denied', collection: 'quickBooksSettings', code: error.code, message: error.message });
      }

      let backOfficePath = null;
      try {
        backOfficePath = `backOfficeRecords/${restaurantId}_${runId}`;
        await setDoc(doc(db, backOfficePath), {
          restaurantId,
          type: 'playwright-test',
          title: 'Playwright rules cleanup record',
          status: 'open',
          testRunId: runId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        results.push({ label: 'owner/admin can write backOfficeRecords', allowed: true });
      } catch (error) {
        results.push({ label: 'owner/admin can write backOfficeRecords', allowed: false, code: error.code, message: error.message });
        if (String(process.env.STRICT_OWNER_PRO_RULES || '').toLowerCase() === 'true') problems.push({ type: 'owner-pro-write-denied', collection: 'backOfficeRecords', code: error.code, message: error.message });
      }

      for (const path of [qbShellPath, backOfficePath].filter(Boolean)) {
        await deleteDoc(doc(db, path)).catch((error) => results.push({ label: `cleanup ${path}`, allowed: false, code: error.code, message: error.message }));
      }

      if (process.env.STAFF_EMAIL && process.env.STAFF_PASSWORD) {
        await signOut(auth);
        await signInWithEmailAndPassword(auth, process.env.STAFF_EMAIL, process.env.STAFF_PASSWORD);
        await expectDenied(
          'staff cannot write backOfficeRecords',
          setDoc(doc(db, 'backOfficeRecords', `${restaurantId}_${runId}_staff`), {
            restaurantId,
            type: 'staff-should-fail',
            title: 'Denied staff test',
            status: 'open',
            createdAt: serverTimestamp(),
          }),
          results
        );
      }
    } finally {
      await signOut(auth).catch(() => {});
      await deleteApp(app).catch(() => {});
    }

    await testInfo.attach('firestore-rules-deep-report.json', { body: JSON.stringify({ configProject: config.projectId, results, problems }, null, 2), contentType: 'application/json' });
    expect(problems, JSON.stringify(problems, null, 2)).toEqual([]);
  });
});
