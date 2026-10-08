const fs = require('fs');
const path = require('path');
const { env, boolEnv } = require('./env-loader.cjs');
const { getFirebaseTarget, applyFirebaseEmulatorEnv } = require('../86chaos-firebase-target.cjs');

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

function extractTopLevelConstants(text) {
  const values = {};
  const re = /const\s+([A-Z0-9_]+)\s*=\s*['"]([^'"]*)['"]/g;
  let m;
  while ((m = re.exec(text))) values[m[1]] = m[2];
  return values;
}

function extractPropertyExpression(objectLiteral, key) {
  const re = new RegExp(`${key}\\s*:\\s*([\\s\\S]*?)(?:,\\s*\\n|\\n\\s*})`);
  const m = objectLiteral.match(re);
  return m ? m[1].trim() : '';
}

function splitEnvArgs(args) {
  const out = [];
  let cur = '';
  let quote = '';
  let depth = 0;
  for (let i = 0; i < args.length; i += 1) {
    const ch = args[i];
    if (quote) {
      cur += ch;
      if (ch === quote && args[i - 1] !== '\\') quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function unquoteOrConst(token, constants) {
  const trimmed = String(token || '').trim();
  const stringMatch = trimmed.match(/^['"]([^'"]*)['"]$/);
  if (stringMatch) return stringMatch[1];
  if (constants[trimmed] !== undefined) return constants[trimmed];
  return '';
}

function resolveEnvCall(expr, constants) {
  const m = String(expr || '').match(/env\s*\(([\s\S]*)\)/);
  if (!m) return '';
  const args = splitEnvArgs(m[1]);
  const envName = unquoteOrConst(args[0], constants);
  const fallback = args.length > 1 ? unquoteOrConst(args[1], constants) : '';
  return env(envName) || fallback;
}

function resolveExpression(expr, constants) {
  const raw = String(expr || '').trim();

  // Handles lines like:
  // apiKey: envFlag('ALLOW') ? env('KEY', LOCKED_KEY) : LOCKED_KEY
  const ternary = raw.match(/envFlag\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\?\s*([\s\S]*?)\s*:\s*([\s\S]*)$/);
  if (ternary) {
    const flagName = ternary[1];
    const chosen = boolEnv(flagName) ? ternary[2] : ternary[3];
    return resolveExpression(chosen, constants);
  }

  if (/env\s*\(/.test(raw)) return resolveEnvCall(raw, constants);
  return unquoteOrConst(raw, constants);
}

function readFirebaseConfig() {
  const target = getFirebaseTarget(process.env);
  if (target.emulator) return {
    apiKey: 'demo-api-key',
    authDomain: `${target.projectId}.firebaseapp.com`,
    projectId: target.projectId,
    storageBucket: `${target.projectId}.appspot.com`,
    messagingSenderId: '000000000000',
    appId: '1:000000000000:web:86chaosemulator',
    databaseURL: `https://${target.projectId}-default-rtdb.firebaseio.com`,
  };
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
  if (!fs.existsSync(appCore)) throw new Error('Could not find src/core/appCore.js to read Firebase config.');
  const text = fs.readFileSync(appCore, 'utf8');
  const constants = extractTopLevelConstants(text);
  const literal = extractObjectLiteral(text, boolEnv('CHAOS_QA_USE_PROD_FIREBASE') ? 'prodConfig' : 'testConfig');
  if (!literal) throw new Error('Could not extract Firebase config object from src/core/appCore.js');

  const config = {};
  for (const key of ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId', 'databaseURL']) {
    config[key] = resolveExpression(extractPropertyExpression(literal, key), constants);
  }

  const missing = ['apiKey', 'authDomain', 'projectId', 'appId'].filter(k => !config[k]);
  if (missing.length) {
    throw new Error(`Could not resolve Firebase config values from appCore.js: ${missing.join(', ')}. Check appCore config expressions or provide REACT_APP_TEST_FIREBASE_* env values.`);
  }
  return config;
}

async function initFirebase() {
  const target = applyFirebaseEmulatorEnv(process.env);
  const { initializeApp, getApps } = await import('firebase/app');
  const authSdk = await import('firebase/auth');
  const firestore = await import('firebase/firestore');
  const storageSdk = await import('firebase/storage');
  const databaseSdk = await import('firebase/database');
  const functionsSdk = await import('firebase/functions');
  const config = readFirebaseConfig();
  const existing = getApps()[0] || null;
  if (existing && existing.options?.projectId !== config.projectId) throw new Error(`Firebase app already targets ${existing.options?.projectId}; refusing target switch to ${config.projectId}.`);
  const app = existing || initializeApp(config);
  const auth = authSdk.getAuth(app);
  const db = firestore.getFirestore(app);
  const storage = storageSdk.getStorage(app);
  const database = databaseSdk.getDatabase(app);
  const functions = functionsSdk.getFunctions(app, process.env.REACT_APP_FIREBASE_FUNCTIONS_REGION || 'us-central1');
  if (target.emulator) {
    firestore.connectFirestoreEmulator(db, target.host, target.ports.firestore);
    authSdk.connectAuthEmulator(auth, `http://${target.host}:${target.ports.auth}`, { disableWarnings: true });
    functionsSdk.connectFunctionsEmulator(functions, target.host, target.ports.functions);
    databaseSdk.connectDatabaseEmulator(database, target.host, target.ports.database);
    storageSdk.connectStorageEmulator(storage, target.host, target.ports.storage);
  }
  return { app, auth, db, storage, database, functions, config, target, firestore, signInWithEmailAndPassword: authSdk.signInWithEmailAndPassword };
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
  const picked = candidates.find(c => c.restaurantId || c.workspaceId || c.defaultRestaurantId || c.restaurants);
  if (!picked) return '';
  if (picked.restaurantId) return picked.restaurantId;
  if (picked.workspaceId) return picked.workspaceId;
  if (picked.defaultRestaurantId) return picked.defaultRestaurantId;
  if (Array.isArray(picked.restaurants) && picked.restaurants[0]) return picked.restaurants[0].id || picked.restaurants[0];
  return '';
}

module.exports = { initFirebase, signInOwner, findCurrentRestaurantId, readFirebaseConfig };
