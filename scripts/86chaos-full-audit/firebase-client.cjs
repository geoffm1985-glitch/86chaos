const fs = require('fs');
const path = require('path');
const { env, boolEnv } = require('./env-loader.cjs');

function extractObjectLiteral(text, exportName) {
  const idx = text.indexOf(`export const ${exportName}`);
  if (idx < 0) return null;
  const start = text.indexOf('{', idx);
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function readFirebaseConfig() {
  const explicit = {
    apiKey: env('REACT_APP_FIREBASE_API_KEY', 'REACT_APP_TEST_FIREBASE_API_KEY'),
    authDomain: env('REACT_APP_FIREBASE_AUTH_DOMAIN', 'REACT_APP_TEST_FIREBASE_AUTH_DOMAIN'),
    projectId: env('REACT_APP_FIREBASE_PROJECT_ID', 'REACT_APP_TEST_FIREBASE_PROJECT_ID'),
    storageBucket: env('REACT_APP_FIREBASE_STORAGE_BUCKET', 'REACT_APP_TEST_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: env('REACT_APP_FIREBASE_MESSAGING_SENDER_ID', 'REACT_APP_TEST_FIREBASE_MESSAGING_SENDER_ID'),
    appId: env('REACT_APP_FIREBASE_APP_ID', 'REACT_APP_TEST_FIREBASE_APP_ID'),
    databaseURL: env('REACT_APP_FIREBASE_DATABASE_URL', 'REACT_APP_TEST_FIREBASE_DATABASE_URL'),
  };
  if (explicit.apiKey && explicit.authDomain && explicit.projectId && explicit.appId) return explicit;
  const appCore = path.join(process.cwd(), 'src', 'core', 'appCore.js');
  if (!fs.existsSync(appCore)) throw new Error('Could not find src/core/appCore.js to read Firebase test config.');
  const text = fs.readFileSync(appCore, 'utf8');
  const literal = extractObjectLiteral(text, boolEnv('CHAOS_QA_USE_PROD_FIREBASE') ? 'prodConfig' : 'testConfig');
  if (!literal) throw new Error('Could not extract Firebase config object from src/core/appCore.js');
  const findValue = (key, fallback = '') => {
    const re = new RegExp(`${key}\\s*:\\s*(?:env\\([^,]+,\\s*)?['\"]([^'\"]*)['\"]`);
    const m = literal.match(re);
    return m ? m[1] : fallback;
  };
  return {
    apiKey: findValue('apiKey'),
    authDomain: findValue('authDomain'),
    projectId: findValue('projectId'),
    storageBucket: findValue('storageBucket'),
    messagingSenderId: findValue('messagingSenderId'),
    appId: findValue('appId'),
    databaseURL: findValue('databaseURL'),
  };
}

async function initFirebase() {
  const { initializeApp, getApps } = await import('firebase/app');
  const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth');
  const firestore = await import('firebase/firestore');
  const config = readFirebaseConfig();
  const app = getApps().length ? getApps()[0] : initializeApp(config);
  const auth = getAuth(app);
  const db = firestore.getFirestore(app);
  return { app, auth, db, config, firestore, signInWithEmailAndPassword };
}

async function signInOwner(firebase) {
  const email = env('OWNER_EMAIL', 'TEST_OWNER_EMAIL', 'ADMIN_EMAIL', 'MANAGER_EMAIL', 'TEST_EMAIL');
  const password = env('OWNER_PASSWORD', 'TEST_OWNER_PASSWORD', 'ADMIN_PASSWORD', 'MANAGER_PASSWORD', 'TEST_PASSWORD');
  if (!email || !password) throw new Error('Missing OWNER_EMAIL/OWNER_PASSWORD or equivalent credentials for QA seeding.');
  const cred = await firebase.signInWithEmailAndPassword(firebase.auth, email, password);
  return { user: cred.user, email };
}

async function findCurrentRestaurantId(firebase, email, uid) {
  const { collection, query, where, getDocs } = firebase.firestore;
  const candidates = [];
  for (const field of ['email', 'userId', 'uid']) {
    const value = field === 'email' ? String(email || '').toLowerCase() : uid;
    if (!value) continue;
    try {
      const snap = await getDocs(query(collection(firebase.db, field === 'email' ? 'users' : 'workspaceMembers'), where(field, '==', value)));
      for (const d of snap.docs) candidates.push({ id: d.id, ...d.data(), source: `${field}-lookup` });
    } catch (_) {}
  }
  const picked = candidates.find(c => c.restaurantId || c.activeRestaurantId || c.defaultRestaurantId);
  return picked ? (picked.restaurantId || picked.activeRestaurantId || picked.defaultRestaurantId) : '';
}

module.exports = { initFirebase, signInOwner, findCurrentRestaurantId, readFirebaseConfig };
