import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, getDoc, setDoc, getDocs, enableIndexedDbPersistence, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getMessaging, isSupported } from 'firebase/messaging';
import { getStorage } from 'firebase/storage';
import { getDatabase, ref as rtdbRef, onValue as onRtdbValue, onDisconnect as rtdbOnDisconnect, set as rtdbSet, serverTimestamp as rtdbServerTimestamp } from 'firebase/database';
import L from 'leaflet';


// Fix for React-Leaflet invisible pin issue
export const customMapIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});


// --- Master Theme (Mapped to Image 6187_2.png) ---
export const T = {
  bg: "bg-[#12161A] text-slate-100",
  card: "chaos-card bg-[#1A2126] border border-[#2A353D] shadow-lg rounded-xl",
  border: "border-[#2A353D]",
  copper: "text-[#D4A381]",
  grad: "bg-gradient-to-r from-[#C59373] to-[#8F6040]",
  btn: "chaos-button chaos-button-primary bg-gradient-to-r from-[#C59373] to-[#8F6040] text-slate-900 font-black uppercase tracking-wider rounded-lg shadow-md hover:opacity-90 transition-all px-3 py-2 text-xs text-center",
  btnAlt: "chaos-button chaos-button-secondary bg-[#12161A] text-slate-300 border border-[#2A353D] font-bold rounded-lg hover:text-[#D4A381] transition-all px-3 py-2 text-xs",
  input: "chaos-input w-full p-2.5 bg-[#12161A] border border-[#2A353D] text-white rounded-lg outline-none focus:border-[#D4A381] transition-colors font-medium text-sm",
  label: "chaos-label block text-[10px] uppercase tracking-widest font-bold text-slate-300 mb-1",
  muted: "text-slate-400",
  th: "chaos-table-heading bg-[#12161A] border-b border-[#2A353D] text-[10px] font-black text-[#D4A381] uppercase tracking-widest p-2.5",
  row: "chaos-table-row hover:bg-[#12161A]/50 border-b border-[#2A353D] transition-colors p-2.5",
};

// --- Firebase Initialization ---
const env = (key, fallback = '') => (process.env[key] || fallback);
const envFlag = (key) => String(process.env[key] || '').trim().toLowerCase() === 'true';
const LOCKED_TEST_FIREBASE_API_KEY = 'AIzaSyBIRGMeLnVE3w3i1WZJzurcp-LkeaNZ3hw';

// 1. TEST DATABASE CONFIG (Sandbox)
// Preview/testing must never drift onto the production browser key. The test browser
// API key is intentionally locked unless an explicit override flag is set.
export const testConfig = {
  apiKey: envFlag('REACT_APP_ALLOW_TEST_FIREBASE_API_KEY_OVERRIDE') ? env('REACT_APP_TEST_FIREBASE_API_KEY', LOCKED_TEST_FIREBASE_API_KEY) : LOCKED_TEST_FIREBASE_API_KEY,
  authDomain: env('REACT_APP_TEST_FIREBASE_AUTH_DOMAIN', 'chaos-test-d1601.firebaseapp.com'),
  projectId: env('REACT_APP_TEST_FIREBASE_PROJECT_ID', 'chaos-test-d1601'),
  storageBucket: env('REACT_APP_TEST_FIREBASE_STORAGE_BUCKET', 'chaos-test-d1601.firebasestorage.app'),
  messagingSenderId: env('REACT_APP_TEST_FIREBASE_MESSAGING_SENDER_ID', '534993379994'),
  appId: env('REACT_APP_TEST_FIREBASE_APP_ID', '1:534993379994:web:9fefb6e10309223afe7523'),
  databaseURL: env('REACT_APP_TEST_FIREBASE_DATABASE_URL', 'https://chaos-test-d1601-default-rtdb.firebaseio.com')
};

// 2. MAIN PRODUCTION DATABASE CONFIG (Live Data)
export const prodConfig = {
  apiKey: env('REACT_APP_PROD_FIREBASE_API_KEY', 'AIzaSyA0kkmRCqGNoB1LXKfuCNIl1JKDyQci9hA'),
  authDomain: env('REACT_APP_PROD_FIREBASE_AUTH_DOMAIN', 'cheers-34b8d.firebaseapp.com'),
  projectId: env('REACT_APP_PROD_FIREBASE_PROJECT_ID', 'cheers-34b8d'),
  storageBucket: env('REACT_APP_PROD_FIREBASE_STORAGE_BUCKET', 'cheers-34b8d.firebasestorage.app'),
  messagingSenderId: env('REACT_APP_PROD_FIREBASE_MESSAGING_SENDER_ID', '762225019248'),
  appId: env('REACT_APP_PROD_FIREBASE_APP_ID', '1:762225019248:web:3e142c9563e58ca762a7b5'),
  measurementId: env('REACT_APP_PROD_FIREBASE_MEASUREMENT_ID', 'G-JFZ6EZB0E3'),
  databaseURL: env('REACT_APP_PROD_FIREBASE_DATABASE_URL', 'https://cheers-34b8d-default-rtdb.firebaseio.com')
};

export const PROD_FIREBASE_HOSTS = ['app.86chaos.com', '86chaos.com', 'www.86chaos.com'];
export const isProdFirebaseHost = (hostname = '') => PROD_FIREBASE_HOSTS.includes(String(hostname || '').toLowerCase());

const normalizeDeployMode = (value = '') => String(value || '').trim().toLowerCase();
const explicitFirebaseProject = normalizeDeployMode(env('REACT_APP_FIREBASE_ACTIVE_PROJECT_ID', ''));
const explicitDeployMode = normalizeDeployMode(env('REACT_APP_FIREBASE_DEPLOYMENT_MODE', ''));
const genericFirebaseProjectId = env('REACT_APP_FIREBASE_PROJECT_ID', '').trim();
const currentHostname = typeof window !== 'undefined' ? String(window.location.hostname || '').toLowerCase() : '';
const isVercelPreviewHost = currentHostname === 'localhost' || currentHostname === '127.0.0.1' || currentHostname.endsWith('.vercel.app');
const isProductionFirebaseHost = isProdFirebaseHost(currentHostname);
const trustedBrowserProjects = ['chaos-test-d1601', 'cheers-34b8d'];
const exactGenericBrowserProject = trustedBrowserProjects.includes(genericFirebaseProjectId) ? genericFirebaseProjectId : '';
const forceTestingFirebase = ['chaos-test-d1601', 'test', 'testing', 'preview', 'staging', 'dev', 'development'].includes(explicitFirebaseProject) || ['test', 'testing', 'preview', 'staging', 'dev', 'development'].includes(explicitDeployMode);
const forceProductionFirebase = ['cheers-34b8d', 'prod', 'production', 'live'].includes(explicitFirebaseProject) || ['prod', 'production', 'live'].includes(explicitDeployMode);
const genericBrowserConfig = {
  apiKey: env('REACT_APP_FIREBASE_API_KEY', ''),
  authDomain: env('REACT_APP_FIREBASE_AUTH_DOMAIN', ''),
  projectId: genericFirebaseProjectId,
  storageBucket: env('REACT_APP_FIREBASE_STORAGE_BUCKET', ''),
  messagingSenderId: env('REACT_APP_FIREBASE_MESSAGING_SENDER_ID', ''),
  appId: env('REACT_APP_FIREBASE_APP_ID', ''),
  measurementId: env('REACT_APP_FIREBASE_MEASUREMENT_ID', '')
};
const genericConfigIsUsable = Boolean(genericBrowserConfig.apiKey && genericBrowserConfig.authDomain && exactGenericBrowserProject && genericBrowserConfig.appId);

// 3. THE SWITCHER
// Login/Auth stays eager-loaded. Vercel preview/local hosts are hard-locked to
// the test Firebase project and the locked test browser API key above. This
// prevents a generic production env var from pushing the testing app onto the
// live/main Firebase key and causing Google Cloud referrer blocks.
const activeFirebaseProjectId = (isVercelPreviewHost || forceTestingFirebase)
  ? 'chaos-test-d1601'
  : (isProductionFirebaseHost || forceProductionFirebase)
    ? 'cheers-34b8d'
    : exactGenericBrowserProject || 'chaos-test-d1601';
export const activeFirebaseMode = activeFirebaseProjectId === 'cheers-34b8d' ? 'production' : 'test';
const configForProject = (projectId) => {
  // Never use the generic browser config on localhost/Vercel preview. Those
  // environments must use the locked test config so a stale production
  // REACT_APP_FIREBASE_* value cannot sneak into the testing app.
  if (!isVercelPreviewHost && genericConfigIsUsable && genericBrowserConfig.projectId === projectId) return genericBrowserConfig;
  return projectId === 'cheers-34b8d' ? prodConfig : testConfig;
};
export const firebaseConfig = configForProject(activeFirebaseProjectId);
export const firebaseDiagnostics = {
  mode: activeFirebaseMode,
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  host: currentHostname,
  vercelPreview: isVercelPreviewHost,
  browserApiKeyTail: String(firebaseConfig.apiKey || '').slice(-6),
  genericProjectHonored: Boolean(!isVercelPreviewHost && genericConfigIsUsable && genericBrowserConfig.projectId === activeFirebaseProjectId)
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
const safeGetRealtimeDb = () => {
  try { return getDatabase(app); }
  catch (err) {
    console.warn('Realtime Database presence is unavailable:', err?.message || err);
    return null;
  }
};
export const realtimeDb = safeGetRealtimeDb();
export const isFirebaseMessagingUnsupportedError = (error = {}) => {
  const text = [
    error?.code,
    error?.name,
    error?.message,
    error?.toString?.()
  ].filter(Boolean).join(' ').toLowerCase();
  return text.includes('messaging/unsupported-browser')
    || text.includes('unsupported-browser')
    || text.includes("this browser doesn't support the api")
    || text.includes('firebase messaging is not supported');
};

export const hasFirebaseMessagingBrowserApis = () => {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  if (window.isSecureContext === false) return false;
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
};

const quietlyHandleMessagingStartupError = (err, context = 'Firebase Messaging') => {
  if (!isFirebaseMessagingUnsupportedError(err)) {
    console.warn(`${context} is unavailable on this browser:`, err?.message || err);
  }
  return null;
};

export const getSafeMessaging = () => {
  if (!hasFirebaseMessagingBrowserApis()) return null;
  try { return getMessaging(app); }
  catch (err) {
    return quietlyHandleMessagingStartupError(err, 'Firebase Messaging');
  }
};

export const messaging = getSafeMessaging();
export const messagingReady = typeof window !== "undefined" && hasFirebaseMessagingBrowserApis()
  ? isSupported()
      .then((supported) => supported ? getSafeMessaging() : null)
      .catch((err) => quietlyHandleMessagingStartupError(err, 'Firebase Messaging support check'))
  : Promise.resolve(null);

// Kitchen Wi-Fi Armor: Keep app working in walk-in coolers
enableIndexedDbPersistence(db).catch((err) => console.warn("Offline mode issue:", err.code));



// Low-cost online presence: Realtime Database handles connect/disconnect without Firestore heartbeats.
const presenceSafeKey = (value = '') => String(value || 'unknown').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120) || 'unknown';
const presenceDeviceType = () => {
  if (typeof navigator === 'undefined') return 'server';
  const ua = String(navigator.userAgent || '').toLowerCase();
  if (/android|iphone|ipad|ipod|mobile/.test(ua)) return 'mobile';
  return 'desktop';
};

export function startLowCostPresenceSession({ user = {}, restaurantId = '', activeTab = '', onDebug = null } = {}) {
  if (typeof window === 'undefined' || !realtimeDb || !user?.id || !restaurantId) return () => {};
  const workspaceKey = presenceSafeKey(restaurantId);
  const userKey = presenceSafeKey(user.id);
  const sessionStorageKey = `chaosRtdbPresenceSession_${workspaceKey}_${userKey}`;
  let sessionId = '';
  try { sessionId = sessionStorage.getItem(sessionStorageKey) || ''; } catch (_) {}
  if (!sessionId) {
    sessionId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    try { sessionStorage.setItem(sessionStorageKey, sessionId); } catch (_) {}
  }
  const sessionKey = presenceSafeKey(sessionId);
  const connectedRef = rtdbRef(realtimeDb, '.info/connected');
  const sessionRef = rtdbRef(realtimeDb, `status/${workspaceKey}/${userKey}/sessions/${sessionKey}`);
  const summaryRef = rtdbRef(realtimeDb, `statusSummary/${workspaceKey}/${userKey}`);
  const base = {
    userId: String(user.id || ''),
    restaurantId: String(restaurantId || ''),
    name: String(user.name || user.displayName || user.email || ''),
    email: String(user.email || ''),
    role: String(user.role || ''),
    device: presenceDeviceType(),
    host: typeof window !== 'undefined' ? String(window.location.hostname || '') : '',
    userAgent: typeof navigator !== 'undefined' ? String(navigator.userAgent || '').slice(0, 160) : '',
    source: 'rtdb-low-cost-presence'
  };
  const unsubscribe = onRtdbValue(connectedRef, (snap) => {
    if (snap.val() !== true) return;
    const onlinePayload = { ...base, state: 'online', online: true, activeTab: String(activeTab || ''), lastChanged: rtdbServerTimestamp(), connectedAt: rtdbServerTimestamp() };
    const offlinePayload = { ...base, state: 'offline', online: false, activeTab: String(activeTab || ''), lastChanged: rtdbServerTimestamp(), lastOnline: rtdbServerTimestamp(), disconnectedAt: rtdbServerTimestamp() };
    Promise.all([
      rtdbSet(sessionRef, onlinePayload),
      rtdbSet(summaryRef, { ...onlinePayload, activeSessionCount: 1 }),
      rtdbOnDisconnect(sessionRef).set(offlinePayload),
      rtdbOnDisconnect(summaryRef).set({ ...offlinePayload, activeSessionCount: 0 })
    ]).then(() => {
      onDebug?.({ ok: true, channel: 'rtdb-presence', message: 'Realtime Database presence session active. No repeating Firestore heartbeat is running.' });
    }).catch((err) => {
      onDebug?.({ ok: false, channel: 'rtdb-presence', message: err?.message || String(err) });
    });
  }, (err) => {
    onDebug?.({ ok: false, channel: 'rtdb-presence-connected', message: err?.message || String(err) });
  });
  return () => {
    try { unsubscribe?.(); } catch (_) {}
    try { rtdbSet(sessionRef, { ...base, state: 'offline', online: false, activeTab: String(activeTab || ''), lastChanged: rtdbServerTimestamp(), lastOnline: rtdbServerTimestamp(), disconnectedAt: rtdbServerTimestamp() }); } catch (_) {}
  };
}


const rtdbServerTimestampToMs = (value) => {
  if (!value) return 0;
  if (typeof value === 'number') return value > 1000000000000 ? value : value * 1000;
  if (typeof value === 'string') {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  return 0;
};

const normalizeLowCostPresenceRow = (row = {}, userId = '', restaurantId = '') => {
  const lastMs = Math.max(
    rtdbServerTimestampToMs(row?.lastChanged),
    rtdbServerTimestampToMs(row?.lastOnline),
    rtdbServerTimestampToMs(row?.presenceUpdatedAt),
    rtdbServerTimestampToMs(row?.lastActive),
    rtdbServerTimestampToMs(row?.lastSeen)
  );
  const lastIso = lastMs ? new Date(lastMs).toISOString() : '';
  const online = row?.online === true || row?.state === 'online';
  return {
    ...(row || {}),
    id: row?.userId || userId,
    userId: row?.userId || userId,
    restaurantId: row?.restaurantId || restaurantId,
    online,
    state: row?.state || (online ? 'online' : 'offline'),
    onlineState: row?.state || (online ? 'online' : 'offline'),
    lastActive: lastIso,
    lastSeen: lastIso,
    presenceUpdatedAt: lastIso,
    lastHeartbeatAt: lastIso,
    activeDevice: row?.device || row?.activeDevice || '',
    activeHost: row?.host || row?.activeHost || '',
    activeTab: row?.activeTab || '',
    activeSessionCount: Number(row?.activeSessionCount || (online ? 1 : 0)) || 0,
    presenceSource: 'rtdb-statusSummary'
  };
};

export function useLowCostPresenceSummaries(restaurantId = '', { enabled = false } = {}) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    if (!enabled || !realtimeDb || !restaurantId) {
      setRows([]);
      return undefined;
    }
    const workspaceKey = presenceSafeKey(restaurantId);
    const summaryRef = rtdbRef(realtimeDb, `statusSummary/${workspaceKey}`);
    return onRtdbValue(summaryRef, (snap) => {
      const raw = snap.val() || {};
      const next = Object.entries(raw).map(([userId, row]) => normalizeLowCostPresenceRow(row, userId, restaurantId));
      setRows(next);
    }, () => setRows([]));
  }, [enabled, restaurantId]);
  return rows;
}

export function useLowCostPresenceSummary(restaurantId = '', userId = '', { enabled = false } = {}) {
  const [row, setRow] = useState(null);
  useEffect(() => {
    if (!enabled || !realtimeDb || !restaurantId || !userId) {
      setRow(null);
      return undefined;
    }
    const workspaceKey = presenceSafeKey(restaurantId);
    const userKey = presenceSafeKey(userId);
    const summaryRef = rtdbRef(realtimeDb, `statusSummary/${workspaceKey}/${userKey}`);
    return onRtdbValue(summaryRef, (snap) => {
      const raw = snap.val();
      setRow(raw ? normalizeLowCostPresenceRow(raw, userId, restaurantId) : null);
    }, () => setRow(null));
  }, [enabled, restaurantId, userId]);
  return row;
}

export const auth = getAuth(app);

// --- OPTIONAL APP CHECK + SECURE API KEYCHAIN ---
// App Check site keys are project-specific. Preview/local must not inherit the
// production/generic App Check key, because a wrong reCAPTCHA Enterprise key can
// stall Firebase Auth and make one account look "locked out" behind a timeout.
const rawTestAppCheckSiteKey = env('REACT_APP_TEST_FIREBASE_APPCHECK_SITE_KEY', '');
const rawProdAppCheckSiteKey = env('REACT_APP_PROD_FIREBASE_APPCHECK_SITE_KEY', '');
const rawGenericAppCheckSiteKey = env('REACT_APP_FIREBASE_APPCHECK_SITE_KEY', '');
const APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY = activeFirebaseProjectId === 'chaos-test-d1601'
  ? rawTestAppCheckSiteKey
  : (rawProdAppCheckSiteKey || (!isVercelPreviewHost ? rawGenericAppCheckSiteKey : ''));
firebaseDiagnostics.appCheckEnabled = Boolean(APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY);
firebaseDiagnostics.appCheckSiteKeyTail = APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY ? String(APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY).slice(-6) : 'off';
firebaseDiagnostics.genericAppCheckIgnored = Boolean(isVercelPreviewHost && activeFirebaseProjectId === 'chaos-test-d1601' && rawGenericAppCheckSiteKey && !rawTestAppCheckSiteKey);
let appCheckInstance = null;

if (typeof window !== "undefined" && APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY && !window.__chaosAppCheckBooted) {
  window.__chaosAppCheckBooted = true;
  import('firebase/app-check')
    .then(({ initializeAppCheck, ReCaptchaEnterpriseProvider }) => {
      appCheckInstance = initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY),
        isTokenAutoRefreshEnabled: true
      });
      window.__chaosAppCheckReady = true;
    })
    .catch((err) => console.warn('App Check not initialized:', err?.message || err));
}

const getAppCheckHeader = async () => {
  if (!appCheckInstance) return {};
  try {
    const { getToken: getAppCheckToken } = await import('firebase/app-check');
    const result = await getAppCheckToken(appCheckInstance, false);
    return result?.token ? { 'X-Firebase-AppCheck': result.token } : {};
  } catch (err) {
    console.warn('App Check token unavailable:', err?.message || err);
    return {};
  }
};

// Wait for Firebase Auth to finish restoring the browser session.
// Mobile browsers can render the cached app user before auth.currentUser is ready,
// which used to make server heartbeats fail with "No active user session".
export const waitForAuthCurrentUser = async (timeoutMs = 8000) => {
  if (auth.currentUser) return auth.currentUser;
  return new Promise((resolve) => {
    let settled = false;
    let unsub = () => {};
    const done = (user) => {
      if (settled) return;
      settled = true;
      try { unsub(); } catch (_) {}
      clearTimeout(timer);
      resolve(user || auth.currentUser || null);
    };
    const timer = setTimeout(() => done(auth.currentUser || null), timeoutMs);
    try {
      unsub = onAuthStateChanged(auth, (user) => { if (user) done(user); });
    } catch (_) {
      done(auth.currentUser || null);
    }
  });
};

// This attaches the real Firebase Auth token to Vercel API requests.
// Do not trust client-sent role/email/restaurantId in API routes; verify this token server-side.
export const secureFetch = async (url, options = {}) => {
  const { forceTokenRefresh = false, authWaitMs = 8000, headers: optionHeaders = {}, ...fetchOptions } = options;
  const currentUser = await waitForAuthCurrentUser(authWaitMs);
  if (!currentUser) throw new Error("Unauthorized: Firebase login is not active on this device. Please log out and log back in.");
  const token = await currentUser.getIdToken(forceTokenRefresh);
  const appCheckHeader = await getAppCheckHeader();
  let sessionHeader = {};
  try {
    const sid = sessionStorage.getItem('chaosSessionId');
    if (sid) sessionHeader = { 'X-Chaos-Session-Id': sid };
  } catch (_) {}
  const headers = {
    ...optionHeaders,
    ...appCheckHeader,
    ...sessionHeader,
    'Authorization': `Bearer ${token}`
  };
  return fetch(url, { ...fetchOptions, headers });
};

// --- Master Configuration ---
export const MASTER_ADMIN_EMAIL = (process.env.REACT_APP_MASTER_ADMIN_EMAIL || '').toLowerCase().trim();
export const EVENT_TAGS = ['Standard Day', 'Packers Game', 'Brewers Game', 'Live Music', 'Severe Weather', 'Private Catering', 'Holiday'];

// --- VERSION TRACKING ---
export const CURRENT_VERSION = '16.0.97';

// --- Helpers ---
const usePageVisible = () => {
  const [visible, setVisible] = useState(() => (typeof document === 'undefined' ? true : document.visibilityState !== 'hidden'));
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const update = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    window.addEventListener('blur', update);
    update();
    return () => {
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('focus', update);
      window.removeEventListener('blur', update);
    };
  }, []);
  return visible;
};

const LIVE_COLLECTION_RELEASE_GRACE_MS = 6 * 60 * 1000;
const liveCollectionRegistry = new Map();
const liveDocumentRegistry = new Map();
const LIVE_QUERY_CACHE_MAX_ENTRIES = 60;
const LIVE_QUERY_CACHE_MAX_AGE_MS = 15 * 60 * 1000;
const liveCollectionSessionCache = new Map();
const liveDocumentSessionCache = new Map();
const currentViewerUid = () => String(auth?.currentUser?.uid || 'anonymous');

const canonicalizeForKey = (value) => {
  if (Array.isArray(value)) return value.map(canonicalizeForKey);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = canonicalizeForKey(value[key]);
      return acc;
    }, {});
  }
  return value;
};
const stableJson = (value) => {
  try { return JSON.stringify(canonicalizeForKey(value)); } catch (_) { return String(value || ''); }
};

const normalizeWhereClausesForKey = (clauses = []) => (Array.isArray(clauses) ? clauses : [])
  .map(row => Array.isArray(row) ? [String(row[0] || ''), String(row[1] || ''), canonicalizeForKey(row[2])] : row)
  .filter(row => Array.isArray(row) && row[0] && row[1])
  .sort((a, b) => stableJson(a).localeCompare(stableJson(b)));

const createFirestoreDiagnosticsDefaults = () => ({
  activeListeners: 0,
  activeDocuments: 0,
  listenerReuseCount: 0,
  listenerReleaseCount: 0,
  listeners: {},
  documents: {},
  documentsReceivedByQuery: {},
  writes: {},
  writesInitiated: 0,
  writesCompleted: 0,
  skippedNoOpWrites: 0,
  auditWritesCreated: 0,
  lastResetAt: new Date().toISOString()
});

const ensureFirestoreDiagnosticsShape = (diagnostics = {}) => {
  const defaults = createFirestoreDiagnosticsDefaults();
  const target = diagnostics && typeof diagnostics === 'object' && !Array.isArray(diagnostics)
    ? diagnostics
    : {};
  Object.entries(defaults).forEach(([key, value]) => {
    if (target[key] === undefined || target[key] === null) target[key] = value;
  });
  ['listeners', 'documents', 'documentsReceivedByQuery', 'writes'].forEach((key) => {
    if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) target[key] = {};
  });
  ['activeListeners', 'activeDocuments', 'listenerReuseCount', 'listenerReleaseCount', 'writesInitiated', 'writesCompleted', 'skippedNoOpWrites', 'auditWritesCreated'].forEach((key) => {
    target[key] = Number(target[key] || 0);
  });
  if (!target.lastResetAt) target.lastResetAt = defaults.lastResetAt;
  return target;
};

const getFirestoreDiagnostics = () => {
  if (typeof window === 'undefined') return null;
  window.__chaosFirestoreDiagnostics = ensureFirestoreDiagnosticsShape(window.__chaosFirestoreDiagnostics);
  return window.__chaosFirestoreDiagnostics;
};

export const getFirebaseUsageDiagnostics = () => getFirestoreDiagnostics();
export const resetFirebaseUsageDiagnostics = () => {
  if (typeof window === 'undefined') return null;
  window.__chaosFirestoreDiagnostics = null;
  return getFirestoreDiagnostics();
};
export const downloadFirebaseUsageDiagnostics = (filename = '86chaos-firebase-usage-diagnostics.json') => {
  if (typeof window === 'undefined') return null;
  const report = getFirestoreDiagnostics() || {};
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return report;
};
export const clearTenantListenerCache = (boundary = {}) => {
  const clearAll = boundary.all === true;
  const projectId = boundary.projectId || null;
  const restaurantId = boundary.restaurantId || boundary.restId || null;
  const viewerUid = boundary.viewerUid || boundary.userId || null;
  const userSensitiveOnly = boundary.userSensitiveOnly === true;
  const matches = (row = {}) => {
    if (clearAll) return true;
    if (userSensitiveOnly && row.userSensitive !== true) return false;
    if (projectId && String(row.projectId || '') !== String(projectId)) return false;
    if (restaurantId && String(row.restaurantId || row.restId || '') !== String(restaurantId)) return false;
    if (viewerUid && String(row.viewerUid || '') !== String(viewerUid)) return false;
    return Boolean(projectId || restaurantId || viewerUid || userSensitiveOnly);
  };
  let releasedCollections = 0;
  let releasedDocuments = 0;
  for (const [key, entry] of liveCollectionRegistry.entries()) {
    if (!matches(entry)) continue;
    try { entry.unsubscribe?.(); } catch (_) {}
    if (entry.releaseTimer) clearTimeout(entry.releaseTimer);
    liveCollectionRegistry.delete(key);
    releasedCollections += 1;
  }
  for (const [key, entry] of liveDocumentRegistry.entries()) {
    if (!matches(entry)) continue;
    try { entry.unsubscribe?.(); } catch (_) {}
    if (entry.releaseTimer) clearTimeout(entry.releaseTimer);
    liveDocumentRegistry.delete(key);
    releasedDocuments += 1;
  }
  for (const [key, row] of liveCollectionSessionCache.entries()) if (matches(row)) liveCollectionSessionCache.delete(key);
  for (const [key, row] of liveDocumentSessionCache.entries()) if (matches(row)) liveDocumentSessionCache.delete(key);
  const diag = getFirestoreDiagnostics();
  if (diag) {
    diag.activeListeners = liveCollectionRegistry.size;
    diag.activeDocuments = liveDocumentRegistry.size;
    diag.listenerReleaseCount = (diag.listenerReleaseCount || 0) + releasedCollections + releasedDocuments;
    diag.lastCacheClear = { projectId, restaurantId, viewerUid, clearAll, releasedCollections, releasedDocuments, at: new Date().toISOString() };
  }
  return { releasedCollections, releasedDocuments };
};


const touchLiveCacheEntry = (map, key) => {
  const row = map.get(key);
  if (!row) return null;
  row.lastAccessedAt = Date.now();
  map.delete(key);
  map.set(key, row);
  return row;
};
const setLiveCacheEntry = (map, key, value = {}) => {
  const projectId = value.projectId || firebaseConfig?.projectId || 'default';
  const row = {
    ...value,
    projectId,
    restaurantId: value.restaurantId || value.restId || '',
    viewerUid: value.viewerUid || currentViewerUid(),
    userSensitive: value.userSensitive !== false,
    cachedAt: Date.now(),
    lastAccessedAt: Date.now()
  };
  map.delete(key);
  map.set(key, row);
  const now = Date.now();
  for (const [cacheKey, cached] of map.entries()) {
    if (now - Number(cached.cachedAt || 0) > LIVE_QUERY_CACHE_MAX_AGE_MS) map.delete(cacheKey);
  }
  while (map.size > LIVE_QUERY_CACHE_MAX_ENTRIES) {
    let oldestKey = null;
    let oldestAt = Infinity;
    for (const [cacheKey, cached] of map.entries()) {
      const at = Number(cached.lastAccessedAt || cached.cachedAt || 0);
      if (at < oldestAt) { oldestAt = at; oldestKey = cacheKey; }
    }
    if (!oldestKey) break;
    map.delete(oldestKey);
  }
};
const makeSubscriberRecord = (fn, label = '') => ({ fn, label: label || '', id: `${Date.now()}_${Math.random().toString(36).slice(2)}` });
const entryConsumerLabels = (entry) => Array.from(entry.subscribers || []).map(row => row.label).filter(Boolean);

export const makeLiveCollectionKey = ({ coll, restId, whereClauses, orderByField, orderDirection, limitCount, cursor = null, viewerUid = currentViewerUid() }) => stableJson({
  projectId: firebaseConfig?.projectId || 'default',
  viewerUid: viewerUid || 'anonymous',
  coll,
  restId,
  whereClauses: normalizeWhereClausesForKey(whereClauses || []),
  orderByField: orderByField || '',
  orderDirection: orderDirection || 'asc',
  limitCount: Number(limitCount || 0) || null,
  cursor: cursor || null
});

const annotateListenerDiagnostics = (key, patch = {}) => {
  const diagnostics = getFirestoreDiagnostics();
  if (!diagnostics) return;
  diagnostics.listeners = diagnostics.listeners && typeof diagnostics.listeners === 'object' && !Array.isArray(diagnostics.listeners) ? diagnostics.listeners : {};
  diagnostics.listeners[key] = { ...(diagnostics.listeners[key] || {}), ...patch, updatedAt: new Date().toISOString() };
};


const acquireSharedLiveCollection = ({ coll, restId, constraints, key, setData, debugLabel = '', viewerUid = currentViewerUid() }) => {
  let entry = liveCollectionRegistry.get(key);
  const diagnostics = getFirestoreDiagnostics();
  if (!entry) {
    const cached = touchLiveCacheEntry(liveCollectionSessionCache, key);
    entry = {
      key,
      coll,
      restId,
      restaurantId: restId,
      projectId: firebaseConfig?.projectId || 'default',
      viewerUid,
      userSensitive: true,
      data: Array.isArray(cached?.data) ? cached.data : [],
      lastError: null,
      stale: !!cached,
      hasCachedSnapshot: !!cached,
      initialSnapshotSeen: false,
      subscribers: new Set(),
      releaseTimer: null,
      unsubscribe: null,
      attachedAt: new Date().toISOString(),
      listenerCreationCount: 1,
      listenerReuseCount: 0,
      listenerReleaseCount: 0,
      reconnectCount: cached ? 1 : 0
    };
    annotateListenerDiagnostics(key, {
      queryKey: key,
      collection: coll,
      restaurantId: restId,
      consumerLabels: [],
      subscriberCount: 0,
      listenerCreationCount: 1,
      listenerReuseCount: 0,
      listenerReleaseCount: 0,
      reconnectCount: entry.reconnectCount,
      documentsReceivedInitial: 0,
      documentsReceivedChanges: 0,
      addedChanges: 0,
      modifiedChanges: 0,
      removedChanges: 0,
      attachedAt: entry.attachedAt,
      releasedAt: '',
      releaseReason: '',
      hadPriorCachedSnapshot: !!cached,
      cached: !!cached,
      stale: !!cached
    });
    entry.unsubscribe = onSnapshot(
      query(collection(db, coll), ...constraints),
      snap => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const isInitial = !entry.initialSnapshotSeen;
        entry.initialSnapshotSeen = true;
        entry.hasCachedSnapshot = true;
        entry.stale = false;
        entry.lastError = null;
        entry.data = docs;
        const changes = snap.docChanges ? snap.docChanges() : [];
        setLiveCacheEntry(liveCollectionSessionCache, key, { data: docs, coll, restId, restaurantId: restId, viewerUid, userSensitive: true });
        if (diagnostics) {
          diagnostics.documentsReceivedByQuery = diagnostics.documentsReceivedByQuery && typeof diagnostics.documentsReceivedByQuery === 'object' && !Array.isArray(diagnostics.documentsReceivedByQuery) ? diagnostics.documentsReceivedByQuery : {};
          diagnostics.listeners = diagnostics.listeners && typeof diagnostics.listeners === 'object' && !Array.isArray(diagnostics.listeners) ? diagnostics.listeners : {};
          diagnostics.documentsReceivedByQuery[key] = (diagnostics.documentsReceivedByQuery[key] || 0) + (isInitial ? snap.docs.length : changes.length);
          const row = diagnostics.listeners[key] || {};
          diagnostics.listeners[key] = {
            ...row,
            documentsReceivedInitial: (row.documentsReceivedInitial || 0) + (isInitial ? snap.docs.length : 0),
            documentsReceivedChanges: (row.documentsReceivedChanges || 0) + (isInitial ? 0 : changes.length),
            addedChanges: (row.addedChanges || 0) + (isInitial ? 0 : changes.filter(c => c.type === 'added').length),
            modifiedChanges: (row.modifiedChanges || 0) + (isInitial ? 0 : changes.filter(c => c.type === 'modified').length),
            removedChanges: (row.removedChanges || 0) + (isInitial ? 0 : changes.filter(c => c.type === 'removed').length),
            lastSnapshotAt: new Date().toISOString(),
            cached: false,
            stale: false,
            lastError: ''
          };
        }
        entry.subscribers.forEach(row => row.fn(entry.data, { resolved: true, stale: false, error: null, fromServer: true }));
      },
      err => {
        const message = err?.message || String(err || '');
        const isIndexProblem = err?.code === 'failed-precondition' || /index|requires an index|currently building/i.test(message);
        if (isIndexProblem) console.warn(`Firestore index pending for ${coll} / ${restId}. Waiting for the deployed index instead of showing a mismatched fallback query.`, message);
        else console.error(`Live collection error for ${coll} / ${restId}:`, err);
        entry.lastError = message;
        entry.stale = true;
        annotateListenerDiagnostics(key, { lastError: message, lastErrorAt: new Date().toISOString(), stale: true, cached: entry.hasCachedSnapshot === true });
        // Preserve last valid data. Do not push an empty array for transient errors.
        entry.subscribers.forEach(row => row.fn(entry.data || [], { resolved: true, stale: true, error: message, fromServer: false }));
      }
    );
    liveCollectionRegistry.set(key, entry);
    if (diagnostics) diagnostics.activeListeners = liveCollectionRegistry.size;
  } else {
    entry.listenerReuseCount += 1;
    if (diagnostics) {
      diagnostics.listenerReuseCount += 1;
      annotateListenerDiagnostics(key, {
        listenerReuseCount: entry.listenerReuseCount,
        consumerLabels: entryConsumerLabels(entry),
        hadPriorCachedSnapshot: entry.hasCachedSnapshot === true
      });
    }
  }

  if (entry.releaseTimer) {
    clearTimeout(entry.releaseTimer);
    entry.releaseTimer = null;
    annotateListenerDiagnostics(key, { releaseReason: 'release-cancelled-resubscribed-during-grace' });
  }
  const subscriber = makeSubscriberRecord(setData, debugLabel);
  entry.subscribers.add(subscriber);
  setData(entry.data || [], { resolved: entry.initialSnapshotSeen === true, stale: entry.stale === true, error: entry.lastError || null, cached: entry.hasCachedSnapshot === true });
  annotateListenerDiagnostics(key, { subscriberCount: entry.subscribers.size, consumerLabels: entryConsumerLabels(entry), cached: entry.hasCachedSnapshot && !entry.initialSnapshotSeen, stale: entry.stale === true });

  return () => {
    const current = liveCollectionRegistry.get(key);
    if (!current) return;
    current.subscribers.delete(subscriber);
    annotateListenerDiagnostics(key, { subscriberCount: current.subscribers.size, consumerLabels: entryConsumerLabels(current) });
    if (current.subscribers.size === 0 && !current.releaseTimer) {
      current.releaseTimer = setTimeout(() => {
        const latest = liveCollectionRegistry.get(key);
        if (!latest || latest.subscribers.size > 0) return;
        try { latest.unsubscribe?.(); } catch (err) { console.warn('Failed to release shared Firestore listener', err); }
        latest.unsubscribe = null;
        latest.listenerReleaseCount += 1;
        setLiveCacheEntry(liveCollectionSessionCache, key, { data: latest.data || [], coll, restId, restaurantId: restId, viewerUid: latest.viewerUid || viewerUid, userSensitive: true });
        liveCollectionRegistry.delete(key);
        const diag = getFirestoreDiagnostics();
        if (diag) {
          diag.activeListeners = liveCollectionRegistry.size;
          diag.listenerReleaseCount = (diag.listenerReleaseCount || 0) + 1;
        }
        annotateListenerDiagnostics(key, {
          releasedAt: new Date().toISOString(),
          releaseReason: 'no-subscribers-background-grace-expired',
          listenerReleaseCount: latest.listenerReleaseCount,
          subscriberCount: 0,
          consumerLabels: [],
          cached: true
        });
      }, LIVE_COLLECTION_RELEASE_GRACE_MS);
    }
  };
};

export const useLiveCollection = (coll, restId, options = {}) => {
  const {
    enabled = true,
    limitCount = null,
    whereClauses = [],
    orderByField = null,
    orderDirection = 'asc',
    fallbackLimitCount = 75,
    pauseWhenHidden = true,
    debugLabel = ''
  } = options || {};
  const [data, setData] = useState([]);
  const pageVisible = usePageVisible();
  const debugLabelRef = React.useRef(debugLabel || '');
  useEffect(() => { debugLabelRef.current = debugLabel || ''; }, [debugLabel]);
  const viewerUid = currentViewerUid();

  useEffect(() => {
    if (!enabled || !restId) {
      setData([]);
      return undefined;
    }
    if (pauseWhenHidden && !pageVisible) {
      return undefined;
    }

    const constraints = [where("restaurantId", "==", restId)];
    (whereClauses || []).forEach(([field, op, value]) => {
      if (field && op && value !== undefined && value !== null && value !== '') constraints.push(where(field, op, value));
    });
    if (orderByField) constraints.push(orderBy(orderByField, orderDirection || 'asc'));
    if (limitCount && Number(limitCount) > 0) constraints.push(firestoreLimit(Number(limitCount)));

    const key = makeLiveCollectionKey({ coll, restId, whereClauses, orderByField, orderDirection, limitCount, viewerUid });
    return acquireSharedLiveCollection({ coll, restId, constraints, key, setData, debugLabel: debugLabelRef.current, viewerUid });
  }, [coll, restId, enabled, limitCount, orderByField, orderDirection, pauseWhenHidden, pageVisible, viewerUid, stableJson(normalizeWhereClausesForKey(whereClauses || []))]);

  return data;
};


export const useLiveCollectionState = (coll, restId, options = {}) => {
  const [state, setState] = useState({ data: [], loading: Boolean(options?.enabled !== false && restId), resolved: false, error: null, stale: false, cached: false });
  const setter = React.useCallback((rows = [], meta = {}) => {
    setState({
      data: Array.isArray(rows) ? rows : [],
      loading: meta.resolved !== true && !meta.error,
      resolved: meta.resolved === true,
      error: meta.error || null,
      stale: meta.stale === true,
      cached: meta.cached === true
    });
  }, []);
  const {
    enabled = true,
    limitCount = null,
    whereClauses = [],
    orderByField = null,
    orderDirection = 'asc',
    fallbackLimitCount = 75,
    pauseWhenHidden = true,
    debugLabel = ''
  } = options || {};
  const pageVisible = usePageVisible();
  const debugLabelRef = React.useRef(debugLabel || '');
  useEffect(() => { debugLabelRef.current = debugLabel || ''; }, [debugLabel]);
  const viewerUid = currentViewerUid();
  useEffect(() => {
    if (!enabled || !restId) {
      setState({ data: [], loading: false, resolved: false, error: null, stale: false, cached: false });
      return undefined;
    }
    if (pauseWhenHidden && !pageVisible) return undefined;
    setState(prev => ({ ...prev, loading: !prev.resolved }));
    const constraints = [where("restaurantId", "==", restId)];
    (whereClauses || []).forEach(([field, op, value]) => {
      if (field && op && value !== undefined && value !== null && value !== '') constraints.push(where(field, op, value));
    });
    if (orderByField) constraints.push(orderBy(orderByField, orderDirection || 'asc'));
    if (limitCount && Number(limitCount) > 0) constraints.push(firestoreLimit(Number(limitCount)));
    const key = makeLiveCollectionKey({ coll, restId, whereClauses, orderByField, orderDirection, limitCount, viewerUid });
    return acquireSharedLiveCollection({ coll, restId, constraints, key, setData: setter, debugLabel: debugLabelRef.current, viewerUid });
  }, [coll, restId, enabled, limitCount, orderByField, orderDirection, pauseWhenHidden, pageVisible, viewerUid, stableJson(normalizeWhereClausesForKey(whereClauses || []))]);
  return state;
};

export const makeLiveDocumentKey = ({ coll, docId, viewerUid = currentViewerUid() }) => stableJson({
  projectId: firebaseConfig?.projectId || 'default',
  viewerUid: viewerUid || 'anonymous',
  coll,
  docId: docId || ''
});

const acquireSharedLiveDocument = ({ coll, docId, key, setValue, debugLabel = '', restaurantId = '', viewerUid = currentViewerUid() }) => {
  let entry = liveDocumentRegistry.get(key);
  const diagnostics = getFirestoreDiagnostics();
  if (!entry) {
    const cached = touchLiveCacheEntry(liveDocumentSessionCache, key);
    entry = {
      key,
      coll,
      docId,
      projectId: firebaseConfig?.projectId || 'default',
      restaurantId: restaurantId || '',
      viewerUid,
      userSensitive: true,
      subscribers: new Set(),
      data: cached?.data ?? null,
      hasCachedSnapshot: !!cached,
      initialSnapshotSeen: false,
      stale: !!cached,
      lastError: null,
      releaseTimer: null,
      unsubscribe: null,
      attachedAt: new Date().toISOString(),
      listenerReuseCount: 0,
      listenerReleaseCount: 0
    };
    entry.unsubscribe = onSnapshot(doc(db, coll, docId), snap => {
      entry.data = snap.exists() ? { id: snap.id, ...snap.data() } : null;
      entry.initialSnapshotSeen = true;
      entry.hasCachedSnapshot = true;
      entry.stale = false;
      entry.lastError = null;
      setLiveCacheEntry(liveDocumentSessionCache, key, { data: entry.data, coll, docId, restaurantId: entry.restaurantId, viewerUid, userSensitive: true });
      entry.subscribers.forEach(row => row.fn(entry.data, { resolved: true, stale: false, error: null, fromServer: true, cached: false }));
      if (diagnostics) diagnostics.documents[key] = {
        ...(diagnostics.documents[key] || {}),
        collection: coll,
        docId,
        restaurantId: entry.restaurantId,
        viewerUid,
        consumerLabels: entryConsumerLabels(entry),
        subscriberCount: entry.subscribers.size,
        lastSnapshotAt: new Date().toISOString(),
        exists: snap.exists(),
        stale: false,
        cached: false,
        lastError: ''
      };
    }, err => {
      const message = err?.message || String(err || '');
      console.error(`Live document error for ${coll}/${docId}:`, err);
      entry.initialSnapshotSeen = true;
      entry.lastError = message;
      entry.stale = true;
      if (diagnostics) diagnostics.documents[key] = {
        ...(diagnostics.documents[key] || {}),
        collection: coll,
        docId,
        restaurantId: entry.restaurantId,
        viewerUid,
        consumerLabels: entryConsumerLabels(entry),
        lastError: message,
        lastErrorAt: new Date().toISOString(),
        stale: true,
        cached: entry.hasCachedSnapshot === true
      };
      // Keep the last valid cached value during transient failures.
      entry.subscribers.forEach(row => row.fn(entry.data, { resolved: true, stale: true, error: message, fromServer: false, cached: entry.hasCachedSnapshot === true }));
    });
    liveDocumentRegistry.set(key, entry);
    if (diagnostics) diagnostics.activeDocuments = liveDocumentRegistry.size;
  } else {
    entry.listenerReuseCount += 1;
    if (diagnostics) diagnostics.listenerReuseCount = (diagnostics.listenerReuseCount || 0) + 1;
  }
  if (entry.releaseTimer) {
    clearTimeout(entry.releaseTimer);
    entry.releaseTimer = null;
  }
  const subscriber = makeSubscriberRecord(setValue, debugLabel);
  entry.subscribers.add(subscriber);
  setValue(entry.data, {
    resolved: entry.initialSnapshotSeen === true,
    stale: entry.stale === true,
    error: entry.lastError || null,
    cached: entry.hasCachedSnapshot === true && !entry.initialSnapshotSeen
  });
  if (diagnostics) diagnostics.documents[key] = {
    ...(diagnostics.documents[key] || {}),
    collection: coll,
    docId,
    restaurantId: entry.restaurantId,
    viewerUid,
    consumerLabels: entryConsumerLabels(entry),
    subscriberCount: entry.subscribers.size,
    cached: entry.hasCachedSnapshot === true && !entry.initialSnapshotSeen,
    stale: entry.stale === true
  };
  return () => {
    const current = liveDocumentRegistry.get(key);
    if (!current) return;
    current.subscribers.delete(subscriber);
    if (diagnostics) diagnostics.documents[key] = { ...(diagnostics.documents[key] || {}), consumerLabels: entryConsumerLabels(current), subscriberCount: current.subscribers.size };
    if (current.subscribers.size === 0 && !current.releaseTimer) {
      current.releaseTimer = setTimeout(() => {
        const latest = liveDocumentRegistry.get(key);
        if (!latest || latest.subscribers.size > 0) return;
        try { latest.unsubscribe?.(); } catch (_) {}
        latest.unsubscribe = null;
        latest.listenerReleaseCount += 1;
        setLiveCacheEntry(liveDocumentSessionCache, key, { data: latest.data, coll, docId, restaurantId: latest.restaurantId || '', viewerUid: latest.viewerUid || viewerUid, userSensitive: true });
        liveDocumentRegistry.delete(key);
        const diag = getFirestoreDiagnostics();
        if (diag) {
          diag.activeDocuments = liveDocumentRegistry.size;
          diag.listenerReleaseCount = (diag.listenerReleaseCount || 0) + 1;
        }
      }, LIVE_COLLECTION_RELEASE_GRACE_MS);
    }
  };
};

export const useLiveDocumentState = (coll, docId, options = {}) => {
  const { enabled = true, debugLabel = '', restaurantId = '' } = options || {};
  const [state, setState] = useState({ data: null, loading: Boolean(enabled && coll && docId), resolved: false, error: null, stale: false, cached: false });
  const labelRef = React.useRef(debugLabel || '');
  useEffect(() => { labelRef.current = debugLabel || ''; }, [debugLabel]);
  const viewerUid = currentViewerUid();
  const setter = React.useCallback((value, meta = {}) => {
    setState({
      data: value ?? null,
      loading: meta.resolved !== true && !meta.error,
      resolved: meta.resolved === true,
      error: meta.error || null,
      stale: meta.stale === true,
      cached: meta.cached === true
    });
  }, []);
  useEffect(() => {
    if (!enabled || !coll || !docId) {
      setState({ data: null, loading: false, resolved: false, error: null, stale: false, cached: false });
      return undefined;
    }
    setState(prev => ({ ...prev, loading: !prev.resolved }));
    const key = makeLiveDocumentKey({ coll, docId, viewerUid });
    return acquireSharedLiveDocument({ coll, docId, key, setValue: setter, debugLabel: labelRef.current, restaurantId, viewerUid });
  }, [coll, docId, enabled, restaurantId, setter, viewerUid]);
  return state;
};

export const useLiveDocument = (coll, docId, options = {}) => useLiveDocumentState(coll, docId, options).data;

export const formatDate = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split('T')[0];
export const getToday = () => formatDate(new Date());
export const getMonthStr = (d) => {
  if (d instanceof Date) return formatDate(d).substring(0, 7);
  const value = String(d || getToday());
  return /^\d{4}-\d{2}/.test(value) ? value.substring(0, 7) : getToday().substring(0, 7);
};
export const formatDisplayDate = (d) => {
  const key = String(d || '').substring(0, 10);
  const date = new Date(`${key}T12:00:00`);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Unknown Date';
};
export const formatDisplayFullDate = (d) => {
  const key = String(d || '').substring(0, 10);
  const date = new Date(`${key}T12:00:00`);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'Unknown Date';
};
export const formatDisplayMonth = (m) => {
  const monthKey = getMonthStr(m);
  const date = new Date(`${monthKey}-01T12:00:00`);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Unknown Month';
};
export const getDaysInMonth = (m) => {
  const monthKey = getMonthStr(m);
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month, 0);
  return Number.isFinite(date.getTime()) ? date.getDate() : 31;
};
let ACTIVE_TIME_FORMAT = '12h';
export const setActiveTimeFormat = (format) => { ACTIVE_TIME_FORMAT = format || '12h'; };
export const getPreferredTimeFormat = (userOrFormat) => {
  if (userOrFormat === '12h' || userOrFormat === '24h') return userOrFormat;
  return userOrFormat?.preferences?.timeFormat || ACTIVE_TIME_FORMAT || '12h';
};
export const formatShortTime = (t, userOrFormat) => {
  if (!t) return '';
  if (t === 'CLOSE') return 'CL';
  try {
    let [h, m = '00'] = String(t).split(':');
    h = parseInt(h, 10);
    if (Number.isNaN(h)) return t;
    const format = getPreferredTimeFormat(userOrFormat);
    if (format === '24h') return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    return `${h % 12 || 12}${m === '00' ? '' : ':' + m}${h >= 12 ? 'p' : 'a'}`;
  } catch(e){ return t; }
};
export const formatClockTime = (value, userOrFormat) => {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const format = getPreferredTimeFormat(userOrFormat);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: format !== '24h' });
};
export const formatClockDateTime = (value, userOrFormat) => {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${formatClockTime(d, userOrFormat)}`;
};

export const safeFilenamePart = (value, fallback = '86chaos') => {
  const raw = String(value || fallback || '86chaos').trim();
  const cleaned = raw
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\-_\.\s]/gi, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  return cleaned || fallback || '86chaos';
};

export const getRestaurantExportPrefix = (appUser, fallback = '86chaos') => {
  const name = appUser?.restaurantName || appUser?.restaurant || appUser?.businessName || appUser?.systemSettings?.restaurantName || appUser?.systemSettings?.businessName || fallback;
  return safeFilenamePart(name, fallback);
};

export const csvFromRows = (rows) => (rows || [])
  .map(row => (row || []).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
  .join('\n');

export const downloadTextFile = (filename, content, mime = 'text/plain;charset=utf-8;') => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const downloadCsvRows = (filename, rows) => {
  downloadTextFile(filename, '\uFEFF' + csvFromRows(rows), 'text/csv;charset=utf-8;');
};

export const openPrintableReport = ({ title, subtitle = '', rows = [], filename = '86chaos-report' }) => {
  const safeTitle = String(title || filename || '86 Chaos Report');
  const safeSubtitle = String(subtitle || '');
  const headers = rows[0] || [];
  const bodyRows = rows.slice(1);
  const esc = (v) => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const html = `<!doctype html><html><head><title>${esc(filename)}</title><meta charset="utf-8" />
    <style>
      body{font-family:Arial,sans-serif;color:#111;margin:28px;}
      .brand{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:#7a4f31;margin-bottom:4px;}
      h1{font-size:22px;margin:0 0 4px;}
      .sub{font-size:12px;color:#555;margin-bottom:18px;}
      table{width:100%;border-collapse:collapse;font-size:10px;}
      th{background:#222;color:white;text-align:left;padding:7px;border:1px solid #444;}
      td{padding:6px;border:1px solid #ccc;vertical-align:top;}
      tr:nth-child(even) td{background:#f7f7f7;}
      .foot{margin-top:14px;font-size:10px;color:#777;}
      @media print{button{display:none} body{margin:18px}}
    </style></head><body>
    <button onclick="window.print()" style="float:right;padding:8px 12px;border-radius:8px;border:1px solid #999;background:#111;color:white;font-weight:bold;">Print / Save PDF</button>
    <div class="brand">86 Chaos</div><h1>${esc(safeTitle)}</h1><div class="sub">${esc(safeSubtitle)}</div>
    <table><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${bodyRows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>
    <div class="foot">Generated ${esc(new Date().toLocaleString())}</div>
    <script>setTimeout(() => window.print(), 350);</script>
    </body></html>`;
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
};

export const getAvatar = (name, url) => {
  if (url) return url;
  const safeName = String(name || 'Staff').replace(/[^A-Za-z0-9\s._-]/g, ' ').trim().slice(0, 80) || 'Staff';
  const initials = safeName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('') || '86';
  const seed = safeName.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 86);
  const ring = seed % 2 === 0 ? '#D4A381' : '#8F6040';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="24" fill="#12161A"/><circle cx="48" cy="48" r="39" fill="#1A2126" stroke="${ring}" stroke-width="4"/><text x="48" y="57" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" font-weight="800" fill="#F4D0B5">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};
export const generateTempPass = () => Math.random().toString(36).slice(-6).toUpperCase();

export const sanitizeCachedUser = () => {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem('86chaosUser');
    if (!raw) return;
    const cached = JSON.parse(raw);
    if (cached && Object.prototype.hasOwnProperty.call(cached, 'password')) {
      delete cached.password;
      localStorage.setItem('86chaosUser', JSON.stringify(cached));
    }
  } catch (err) {
    localStorage.removeItem('86chaosUser');
  }
};
sanitizeCachedUser();
export const getExpDate = (d) => { const dt = new Date(d + 'T12:00:00'); dt.setDate(dt.getDate() + 6); return `${dt.getMonth()+1}/${dt.getDate()}/${dt.getFullYear().toString().slice(-2)}`; };

// --- Global Crash Reporter & Telemetry Engine ---
if (typeof window !== 'undefined' && !window.crashCatcherAttached) { 
  window.crashCatcherAttached = true; 
  window.breadcrumbs = [];

// Silently record the last 15 buttons clicked
  window.addEventListener('click', (e) => {
    let target = e.target;
    // Find the closest button if they clicked an icon inside a button
    let btn = target.closest('button');
    if (btn) {
      // Improved logic: Check title, aria-label, text, or the SVG class name
      let text = btn.title || btn.getAttribute('aria-label') || btn.innerText || '';
      if (!text.trim()) {
        const svg = btn.querySelector('svg');
        if (svg && svg.classList && svg.classList.length > 0) {
           // Extracts 'Trash2' or 'Edit' from the Lucide SVG class
           text = svg.classList[0].replace('lucide-', '').replace('lucide', 'Icon');
        } else {
           text = 'Icon Button';
        }
      }
      if (text.length > 40) text = text.substring(0, 40) + '...';
      window.breadcrumbs.push({ time: formatClockTime(new Date()) + ':' + String(new Date().getSeconds()).padStart(2, '0'), action: 'Clicked', target: text.trim().replace(/\n/g, ' ') });
      if (window.breadcrumbs.length > 15) window.breadcrumbs.shift();
    }
  }, true);

  const chunkFailurePattern = /(ChunkLoadError|Loading chunk|failed to fetch dynamically imported module|Failed to load module script|\.chunk\.(js|css)|\/static\/(js|css)\/)/i;
  const extractFailedAssetUrl = (value = '') => {
    const text = String(value || '');
    const match = text.match(/https?:\/\/[^\s)'"]+\.(?:js|css)|\/static\/(?:js|css)\/[^\s)'"]+\.(?:js|css)/i);
    return match ? match[0] : '';
  };
  const isClipboardPermissionRuntimeNoise = (message = '', stack = '') => {
    const text = `${message} ${stack}`.toLowerCase();
    return (text.includes('clipboard') || text.includes('writetext'))
      && (text.includes('permission denied') || text.includes('not allowed') || text.includes('denied') || text.includes('not granted'));
  };

  const isKnownNonFatalRuntimeError = (message = '', stack = '', payload = {}) => {
    const reason = payload.reason || payload.error || {};
    return isFirebaseMessagingUnsupportedError(reason)
      || isFirebaseMessagingUnsupportedError({ message: `${message} ${stack}` })
      || isClipboardPermissionRuntimeNoise(message, stack);
  };
  const reportGlobalRuntimeError = (payload = {}) => {
    try {
      const message = String(payload.message || payload.reason?.message || payload.reason || 'Browser error').slice(0, 2000);
      const stack = String(payload.rawStack || payload.reason?.stack || payload.error?.stack || '').slice(0, 5000);
      const chunkUrl = payload.chunkUrl || extractFailedAssetUrl(`${message} ${stack}`);
      if (isKnownNonFatalRuntimeError(message, stack, payload)) {
        try {
          const clipboardNoise = isClipboardPermissionRuntimeNoise(message, stack);
          window.__chaosLastNonFatalRuntimeError = {
            source: payload.source || 'runtime_error',
            code: payload.reason?.code || payload.error?.code || (clipboardNoise ? 'clipboard/permission-denied' : 'messaging/unsupported-browser'),
            message: message.slice(0, 500),
            at: new Date().toISOString(),
            category: clipboardNoise ? 'non_fatal_clipboard_permission' : 'non_fatal_firebase_messaging'
          };
        } catch (_) {}
        return;
      }
      const messageFingerprint = `${String(payload.error?.name || payload.reason?.name || '')}:${message}`.slice(0, 500);
      const fingerprint = [chunkFailurePattern.test(`${message} ${stack}`) ? 'chunk' : 'error', chunkUrl, messageFingerprint, CURRENT_VERSION, window.location.pathname, window.location.search].join('|');
      const now = Date.now();
      window.__chaosCrashFingerprints = window.__chaosCrashFingerprints instanceof Map ? window.__chaosCrashFingerprints : new Map();
      for (const [key, seenAt] of window.__chaosCrashFingerprints.entries()) {
        if (now - Number(seenAt || 0) > 30000) window.__chaosCrashFingerprints.delete(key);
      }
      if (window.__chaosCrashFingerprints.has(fingerprint)) return;
      window.__chaosCrashFingerprints.set(fingerprint, now);
      if (window.__chaosCrashFingerprints.size > 60) {
        const oldest = window.__chaosCrashFingerprints.keys().next().value;
        if (oldest) window.__chaosCrashFingerprints.delete(oldest);
      }
      secureFetch('/api/report-bug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'Crash / Error',
          message,
          errorName: String(payload.error?.name || payload.reason?.name || (chunkUrl ? 'ChunkLoadError' : 'RuntimeError')),
          rawStack: stack,
          breadcrumbs: window.breadcrumbs || [],
          userAgent: navigator.userAgent,
          screenSize: `${window.innerWidth}x${window.innerHeight}`,
          url: window.location.href,
          route: window.location.pathname + window.location.search,
          chunkUrl,
          appVersion: CURRENT_VERSION,
          online: navigator.onLine,
          serviceWorkerState: navigator.serviceWorker?.controller?.state || '',
          source: payload.source || 'runtime_error'
        })
      }).catch(()=>{});
    } catch (_) {}
  };

  window.onerror = (msg, url, lineNo, columnNo, error) => {
    reportGlobalRuntimeError({ source: 'window_onerror', message: msg, url, lineNo, columnNo, error });
    return false;
  };

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    const message = String(reason?.message || reason || 'Unhandled promise rejection');
    const rawStack = reason?.stack || '';
    if (isKnownNonFatalRuntimeError(message, rawStack, { source: 'unhandledrejection', reason })) {
      try { event.preventDefault?.(); } catch (_) {}
      reportGlobalRuntimeError({ source: 'unhandledrejection', message, reason, rawStack });
      return;
    }
    reportGlobalRuntimeError({ source: 'unhandledrejection', message, reason, rawStack });
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      const receipt = event?.data;
      if (receipt?.type !== '86CHAOS_NOTIFICATION_RECEIPT' || !receipt?.reportId) return;
      secureFetch('/api/notification-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(receipt)
      }).catch(() => {});
    });

    try {
      const receiptUrl = new URL(window.location.href);
      const reportId = receiptUrl.searchParams.get('notificationReceiptReportId') || '';
      const action = receiptUrl.searchParams.get('notificationReceipt') || '';
      if (reportId && action === 'opened') {
        secureFetch('/api/notification-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: '86CHAOS_NOTIFICATION_RECEIPT',
            action: 'opened',
            reportId,
            openedAt: new Date().toISOString()
          })
        }).finally(() => {
          receiptUrl.searchParams.delete('notificationReceipt');
          receiptUrl.searchParams.delete('notificationReceiptReportId');
          window.history.replaceState({}, '', `${receiptUrl.pathname}${receiptUrl.search}${receiptUrl.hash}`);
        }).catch(() => {});
      }
    } catch (_) {}
  }
}

// --- HOLIDAY & TIME ENGINE ---
export const HOLIDAYS = {
  // Fixed Date Holidays (Work every year)
  "01-01": "New Year's Day", "02-14": "Valentine's Day", "03-17": "St. Patrick's Day", 
  "05-05": "Cinco de Mayo", "07-04": "Independence Day", "10-31": "Halloween", 
  "11-11": "Veterans Day", "12-24": "Christmas Eve", "12-25": "Christmas Day", "12-31": "NYE",
  
  // 2026 Floating Holidays
  "2026-02-08": "Super Bowl", "2026-03-31": "Opening Day", "2026-04-05": "Easter", "2026-05-10": "Mother's Day", 
  "2026-05-25": "Memorial Day", "2026-06-21": "Father's Day", "2026-09-07": "Labor Day", "2026-11-26": "Thanksgiving",

  // 2027 Floating Holidays
  "2027-02-14": "Super Bowl", "2027-03-25": "Opening Day", "2027-03-28": "Easter", "2027-05-09": "Mother's Day", 
  "2027-05-31": "Memorial Day", "2027-06-20": "Father's Day", "2027-09-06": "Labor Day", "2027-11-25": "Thanksgiving",

  // 2028 Floating Holidays
  "2028-02-13": "Super Bowl", "2028-03-30": "Opening Day", "2028-04-16": "Easter", "2028-05-14": "Mother's Day", 
  "2028-05-29": "Memorial Day", "2028-06-18": "Father's Day", "2028-09-04": "Labor Day", "2028-11-23": "Thanksgiving"
};
export const getHoliday = (dateStr) => {
  if (!dateStr) return null;
  const mmdd = dateStr.substring(5);
  return HOLIDAYS[dateStr] || HOLIDAYS[mmdd] || null;
};


// --- SYSTEM AUDIT LOGGER ---
export const logAudit = async (user, action, target, details) => {
  if (!user || !user.restaurantId) return;
  try {
    const isGhost = !!user.isGhost;
    await secureFetch('/api/audit-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantId: user.restaurantId,
        action: String(action || '').slice(0, 160),
        target: String(target || '').slice(0, 320),
        details: typeof details === 'string' ? details.slice(0, 2500) : JSON.stringify(scrubForAudit(details)).slice(0, 2500),
        sessionId: (() => { try { return sessionStorage.getItem('chaosSessionId') || ''; } catch (_) { return ''; } })(),
        isGhost,
        ghostRealUserId: user.ghostRealUserId || user.id || '',
        ghostRealUserName: user.ghostRealUserName || user.name || '',
        ghostTargetUserId: user.ghostTargetUserId || null,
        ghostTargetUserName: user.ghostTargetUserName || null,
        ghostWorkspaceId: isGhost ? user.restaurantId : null
      })
    });
  } catch (err) { console.error("Audit log failed:", err); }
};


// ============================================================================
// 86 CHAOS 14.x ROBUSTNESS ENGINE
// Central helpers for safer writes, permission previews, offline queueing, import
// templates, schema guardrails, and kitchen dependency analysis.
// ============================================================================
const V14_SENSITIVE_KEYS = ['password', 'temporaryPassword', 'ssn', 'address', 'phone', 'email', 'wage', 'hourlyRate', 'payRate', 'fcmToken', 'notesPrivate', 'confidentialSummary', 'nextSteps'];
const V14_TENANT_COLLECTIONS = ['events','messages','shiftSwaps','tasks','timePunches','tempLogs','wasteLogs','maintenanceLogs','prepItems','prepCategories','lineCheckItems','recipes','inventoryItems','vendors','orders','invoices','shifts','timeOffRequests','roles','pmSchedules','sales','menuDependencies','kitchenSpecials','trainingManuals','hrOnboardingTasks','hrCertifications','hrPerformanceNotes','financialExpenses','financialTargets','offlineWriteReceipts','scheduleTemplates','scheduleCoverageTargets'];
const V14_WRITE_PERMISSIONS = {
  shifts: ['schedule', 'team'], timeOffRequests: ['schedule', 'team'], scheduleTemplates: ['schedule', 'team'], scheduleCoverageTargets: ['schedule', 'team'],
  inventoryItems: ['inventory', 'inventoryEdit'], vendors: ['inventory', 'inventoryEdit'], orders: ['inventory', 'inventoryEdit'], invoices: ['inventory', 'invoiceScan', 'scans'],
  prepItems: ['prep', 'team'], prepCategories: ['prep', 'team'], lineCheckItems: ['prep', 'team'], recipes: ['prep', 'team'], menuDependencies: ['prep', 'inventory', 'menuIntelligence'], kitchenSpecials: ['prep', 'ops', 'team'],
  sales: ['sales', 'salesEdit', 'financialEdit'], timePunches: ['labor', 'laborEdit'], financialExpenses: ['sales', 'salesEdit', 'financialEdit'], financialTargets: ['sales', 'salesEdit', 'financialEdit'],
  pmSchedules: ['team'], maintenanceLogs: ['team'], tasks: ['prep', 'team'],
  trainingManuals: ['hr'], hrOnboardingTasks: ['hr'], hrCertifications: ['hr'], hrPerformanceNotes: ['hr'],
  events: ['events', 'schedule', 'team'], messages: ['messages', 'team'], shiftSwaps: ['schedule', 'team'], tempLogs: ['prep', 'team'], wasteLogs: ['inventory', 'prep']
};

export const isSuperAdminUser = (user = {}) => Boolean(user?.isSuperAdmin === true || user?.systemAccess?.superAdmin === true || (MASTER_ADMIN_EMAIL && String(user?.email || '').toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase()));
export const isWorkspaceManager = (user = {}) => Boolean(isSuperAdminUser(user) || user?.isAdmin === true || user?.isOwner === true || user?.accountOwner === true || user?.owner === true || user?.workspaceOwner === true || String(user?.accountRole || '').toLowerCase() === 'owner');
export const hasAnyPermission = (user = {}, perms = []) => Boolean(isWorkspaceManager(user) || (perms || []).some(p => user?.permissions?.[p] === true));

export const scrubForAudit = (value, depth = 0) => {
  if (depth > 5) return '[depth-limit]';
  if (Array.isArray(value)) return value.slice(0, 25).map(v => scrubForAudit(v, depth + 1));
  if (value && typeof value === 'object') {
    const out = {};
    Object.entries(value).slice(0, 80).forEach(([key, val]) => {
      out[key] = V14_SENSITIVE_KEYS.some(s => key.toLowerCase().includes(s.toLowerCase())) ? '[redacted]' : scrubForAudit(val, depth + 1);
    });
    return out;
  }
  return value;
};

export const canUserWriteCollection = (user = {}, collectionName = '') => {
  if (!collectionName) return false;
  if (isSuperAdminUser(user)) return true;
  if (user?.demoMode || user?.isDemo) return false;
  if (collectionName === 'kitchenSpecials' && ['General Manager', 'Manager', 'Kitchen Manager', 'Operations Manager', 'Store Manager', 'Owner', 'Shift Lead', 'Lead', 'Supervisor'].includes(String(user?.role || ''))) return true;
  const needed = V14_WRITE_PERMISSIONS[collectionName] || [];
  if (needed.length === 0) return isWorkspaceManager(user);
  return hasAnyPermission(user, needed);
};


const CHAOS_NOOP_META_FIELDS = new Set(['updatedAt', 'updatedBy', 'lastUpdatedAt', 'lastUpdatedBy']);
const normalizeForNoOpCompare = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(normalizeForNoOpCompare);
  if (value && typeof value === 'object') {
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    const out = {};
    Object.keys(value).sort().forEach(key => {
      if (!CHAOS_NOOP_META_FIELDS.has(key)) out[key] = normalizeForNoOpCompare(value[key]);
    });
    return out;
  }
  return value;
};
export const meaningfulPayloadChanged = (before = null, incoming = {}) => {
  if (!before || typeof before !== 'object') return true;
  return Object.entries(incoming || {}).some(([key, value]) => {
    if (CHAOS_NOOP_META_FIELDS.has(key)) return false;
    return JSON.stringify(normalizeForNoOpCompare(before[key])) !== JSON.stringify(normalizeForNoOpCompare(value));
  });
};
export const recordFirestoreWriteDiagnostic = ({ collectionName = '', action = '', label = '', attempted = false, completed = false, skipped = false, audit = false, sourceScreen = '' } = {}) => {
  const diag = getFirestoreDiagnostics();
  if (!diag) return;
  const key = `${collectionName || 'unknown'}:${action || 'write'}:${label || sourceScreen || 'general'}`;
  diag.writes[key] = diag.writes[key] || { collection: collectionName, action, debugLabel: label, sourceScreen, attempted: 0, completed: 0, skippedNoOp: 0, auditWrites: 0 };
  if (attempted) { diag.writesInitiated = (diag.writesInitiated || 0) + 1; diag.writes[key].attempted += 1; }
  if (completed) { diag.writesCompleted = (diag.writesCompleted || 0) + 1; diag.writes[key].completed += 1; }
  if (skipped) { diag.skippedNoOpWrites = (diag.skippedNoOpWrites || 0) + 1; diag.writes[key].skippedNoOp += 1; }
  if (audit) { diag.auditWritesCreated = (diag.auditWritesCreated || 0) + 1; diag.writes[key].auditWrites += 1; }
  diag.writes[key].lastAt = new Date().toISOString();
};


const looksLikeFirestoreSentinel = (value) => {
  if (!value || typeof value !== 'object') return false;
  const text = Object.prototype.toString.call(value) + ' ' + String(value?._methodName || value?.constructor?.name || '');
  return /FieldValue|serverTimestamp|arrayUnion|arrayRemove|increment|deleteField/i.test(text);
};
export const payloadContainsFirestoreSentinel = (value) => {
  if (looksLikeFirestoreSentinel(value)) return true;
  if (Array.isArray(value)) return value.some(payloadContainsFirestoreSentinel);
  if (value && typeof value === 'object') return Object.values(value).some(payloadContainsFirestoreSentinel);
  return false;
};

export const shouldSkipSafeWrite = ({ action = 'set', merge = true, before = null, data = {} } = {}) => Boolean(
  (action === 'update' || (action === 'set' && merge !== false)) &&
  before &&
  !payloadContainsFirestoreSentinel(data) &&
  !meaningfulPayloadChanged(before, data)
);

export const safeWrite = async ({ user, action = 'set', collectionName, docId = '', data = {}, merge = true, label = '', before = null, addToast = null, sourceScreen = '' }) => {
  if (!user?.restaurantId && !isSuperAdminUser(user)) throw new Error('Safe Write blocked: missing restaurant workspace.');
  if (user?.demoMode || user?.isDemo) throw new Error('Safe Write blocked: demo mode cannot change live data.');
  if (!canUserWriteCollection(user, collectionName)) throw new Error(`Safe Write blocked: missing permission for ${collectionName}.`);
  if (V14_TENANT_COLLECTIONS.includes(collectionName) && !isSuperAdminUser(user)) {
    const incomingRest = data?.restaurantId || before?.restaurantId || user.restaurantId;
    if (incomingRest && incomingRest !== user.restaurantId) throw new Error('Safe Write blocked: restaurant mismatch.');
  }

  if (shouldSkipSafeWrite({ action, merge, before, data })) {
    recordFirestoreWriteDiagnostic({ collectionName, action, label, skipped: true, sourceScreen });
    if (addToast) addToast('No Changes', label || `${collectionName} is already up to date.`);
    return { id: docId, path: `${collectionName}/${docId}`, skipped: true, noChange: true };
  }

  const now = new Date().toISOString();
  const payload = V14_TENANT_COLLECTIONS.includes(collectionName)
    ? { ...data, restaurantId: data?.restaurantId || user.restaurantId, updatedAt: now, updatedBy: user?.name || user?.email || '86 Chaos' }
    : { ...data, updatedAt: now, updatedBy: user?.name || user?.email || '86 Chaos' };
  let refObj;
  recordFirestoreWriteDiagnostic({ collectionName, action, label, attempted: true, sourceScreen });
  if (action === 'add') {
    refObj = await addDoc(collection(db, collectionName), payload);
  } else if (action === 'update') {
    if (!docId) throw new Error('Safe Write blocked: update requires a document id.');
    refObj = doc(db, collectionName, docId);
    await updateDoc(refObj, payload);
  } else if (action === 'delete') {
    if (!docId) throw new Error('Safe Write blocked: delete requires a document id.');
    refObj = doc(db, collectionName, docId);
    await deleteDoc(refObj);
  } else {
    if (!docId) throw new Error('Safe Write blocked: set requires a document id.');
    refObj = doc(db, collectionName, docId);
    await setDoc(refObj, payload, { merge });
  }
  recordFirestoreWriteDiagnostic({ collectionName, action, label, completed: true, sourceScreen });
  let auditWarning = '';
  try {
    await logAudit(user, `SAFE_WRITE_${String(action).toUpperCase()}`, `${collectionName}/${docId || refObj?.id || ''}`, JSON.stringify({ label, after: scrubForAudit(payload), before: scrubForAudit(before) }).slice(0, 2500));
    recordFirestoreWriteDiagnostic({ collectionName, action: 'audit', label, audit: true, sourceScreen });
  } catch (auditErr) {
    auditWarning = auditErr?.message || 'Audit write failed after the business write succeeded.';
    console.warn('Safe write audit warning:', auditWarning);
  }
  if (addToast) addToast('Saved', label || `${collectionName} updated safely.`);
  return { id: refObj?.id || docId, path: `${collectionName}/${refObj?.id || docId}`, payload, auditWarning };
};

export const getOfflineQueueKey = (restaurantId, userId) => `chaosOfflineWriteQueue_${restaurantId || 'unknown'}_${userId || 'unknown'}`;
export const getOfflineQueue = (restaurantId, userId) => {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(getOfflineQueueKey(restaurantId, userId)) || '[]'); } catch (_) { return []; }
};
export const queueOfflineWrite = ({ user, collectionName, docId = '', action = 'add', data = {}, label = '' }) => {
  if (typeof window === 'undefined') return [];
  const key = getOfflineQueueKey(user?.restaurantId, user?.id);
  const queue = getOfflineQueue(user?.restaurantId, user?.id);
  const item = { id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, queuedAt: new Date().toISOString(), collectionName, docId, action, data: scrubForAudit(data), label };
  queue.push(item);
  localStorage.setItem(key, JSON.stringify(queue.slice(-75)));
  return queue;
};
export const replayOfflineQueue = async (user, addToast) => {
  const queue = getOfflineQueue(user?.restaurantId, user?.id);
  if (!queue.length) return { attempted: 0, saved: 0, failed: 0 };
  let saved = 0;
  const failed = [];
  for (const item of queue) {
    try {
      await safeWrite({ user, collectionName: item.collectionName, docId: item.docId, action: item.action, data: item.data || {}, label: item.label });
      saved += 1;
    } catch (err) {
      failed.push({ ...item, lastError: err.message, lastTriedAt: new Date().toISOString() });
    }
  }
  if (typeof window !== 'undefined') localStorage.setItem(getOfflineQueueKey(user?.restaurantId, user?.id), JSON.stringify(failed));
  if (addToast && saved) addToast('Offline Queue Synced', `${saved} queued kitchen action(s) saved.`);
  return { attempted: queue.length, saved, failed: failed.length };
};

export const safeWriteWithQueue = async ({ user, addToast = null, label = '', ...writeArgs }) => {
  try {
    return await safeWrite({ user, addToast, label, ...writeArgs });
  } catch (err) {
    const message = err?.message || String(err);
    const looksOffline = typeof navigator !== 'undefined' && (navigator.onLine === false || /offline|network|unavailable|failed to fetch/i.test(message));
    if (looksOffline && user?.restaurantId && user?.id && ['add','set','update'].includes(writeArgs.action || 'set')) {
      queueOfflineWrite({ user, collectionName: writeArgs.collectionName, docId: writeArgs.docId || '', action: writeArgs.action || 'set', data: writeArgs.data || {}, label });
      if (addToast) addToast('Queued Offline', `${label || writeArgs.collectionName || 'Kitchen action'} will sync when the connection comes back.`);
      return { queued: true, error: message };
    }
    if (addToast) addToast('Save Blocked', message);
    throw err;
  }
};

export const buildPermissionPreview = (user = {}, features = {}) => {
  const superAdmin = isSuperAdminUser(user);
  const admin = isWorkspaceManager(user);
  const allowed = [];
  const blocked = [];
  const push = (key, label, ok, reason = '') => (ok ? allowed : blocked).push({ key, label, reason });
  push('today', 'Manager Brief', true, 'Base manager landing screen');
  push('published', 'My Schedule', true, 'Everyone can see their published schedule');
  push('messages', 'Messages', features.messages !== false, 'Workspace messages module');
  push('prep', 'Prep + Line Check', features.prep !== false, 'Prep module');
  push('recipes', 'Recipes', features.recipes !== false, 'Recipes module');
  push('inventory', 'Inventory', features.inventory !== false, 'Inventory module');
  push('events', 'Events', features.events !== false && (admin || user?.permissions?.events || user?.permissions?.schedule || user?.permissions?.team), 'Events/schedule permission');
  push('schedule', 'Schedule Builder', admin || user?.permissions?.schedule || user?.permissions?.team, 'Schedule permission');
  push('ops', 'Ops Center', features.ops !== false && (superAdmin || admin || user?.permissions?.ops), 'Ops permission');
  push('financials', 'Financials', superAdmin || admin || user?.permissions?.labor || user?.permissions?.sales, 'Labor/sales permission');
  push('team', 'Team', features.team !== false && (admin || user?.permissions?.team), 'Team permission');
  push('hr-training', 'HR & Training', !user?.demoMode, 'Published training is available to employees; administration requires HR or team permission');
  push('maintenance', 'Maintenance', features.maintenance !== false && (admin || user?.permissions?.team), 'Manager/team permission');
  push('settings', 'Settings', !user?.demoMode && (admin || user?.permissions?.settings || user?.permissions?.branding || user?.permissions?.integrations), 'Settings/owner permission');
  push('godmode', 'System Administrator', superAdmin, 'Super Admin only');
  const sensitive = {
    wagesVisible: Boolean(superAdmin || admin || user?.permissions?.wageView || user?.permissions?.wageEdit),
    wagesEditable: Boolean(superAdmin || user?.permissions?.wageEdit),
    backupCenter: Boolean(superAdmin),
    forensics: Boolean(superAdmin),
    demoPrivateDataBlocked: Boolean(user?.demoMode || user?.isDemo)
  };
  return { userId: user.id || '', name: user.name || user.email || 'Selected user', role: user.role || '', allowed, blocked, sensitive };
};

export const buildImportBridgeTemplates = () => ({
  toast_sales: [['date','grossSales','netSales','tax','tips','paymentType','notes'], [getToday(),'0.00','0.00','0.00','0.00','Card','Toast daily sales export']],
  square_sales: [['date','grossSales','discounts','refunds','tax','tips','fees','netSales'], [getToday(),'0.00','0.00','0.00','0.00','0.00','0.00','0.00']],
  clover_sales: [['date','grossSales','netSales','orders','cash','credit','tips','tax'], [getToday(),'0.00','0.00','0','0.00','0.00','0.00','0.00']],
  payroll_time: [['employeeName','employeeEmail','date','clockIn','clockOut','breakMinutes','role','hourlyRate'], ['Demo Employee','demo@example.com',getToday(),'09:00','17:00','30','Cook','0.00']],
  vendor_invoice: [['vendor','invoiceNumber','invoiceDate','itemName','sku','qty','unit','unitCost','category'], ['Vendor Name','INV-1001',getToday(),'Chicken Breast','','1','case','0.00','Food']],
  inventory_count: [['itemName','category','currentStock','parLevel','unit','price','vendor'], ['Lettuce','Produce','0','1','case','0.00','Vendor Name']]
});

export const buildMenuDependencyReport = ({ recipes = [], inventoryItems = [], prepItems = [], menuDependencies = [], events = [] }) => {
  const normalize = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  const words = (v) => normalize(v).split(' ').filter(Boolean);
  const noise = new Set([
    'and','with','the','for','from','item','items','case','cs','bag','bags','box','boxes','pack','packs','pkg','pk','lb','lbs','oz','ounce','ounces','gal','gallon','ct','count','slice','slices','sliced','sli','whole','fresh','frozen','iqf','bulk','portion','portions','brand','food','foods','bbrlcls','demo','test','120','100','80','20'
  ]);
  const genericIngredient = new Set(['cheese','sauce','dip','dressing','bread','bun','buns','roll','rolls','mix','seasoning','beer','wine','liquor','oil','salt','pepper','flour','egg','eggs','milk','cream','lettuce','tomato','onion']);
  const aliasGroups = {
    fries: ['fries','fry','french fry','potato fry'],
    wing: ['wing','wings','chicken wing'],
    burger: ['burger','patty','patties','hamburger','ground beef'],
    chicken: ['chicken','chix','chkn','ckn','breast','tender','tenders'],
    tortilla: ['tortilla','wrap','shell'],
    mozzarella: ['mozzarella','moz'],
    american: ['american','amer'],
    swiss: ['swiss'],
    cheddar: ['cheddar'],
    ranch: ['ranch'],
    bacon: ['bacon'],
    cod: ['cod','fish'],
    haddock: ['haddock','fish']
  };
  const significantTokens = (value) => Array.from(new Set(words(value).filter(w => w.length > 2 && !noise.has(w))));
  const recipeTextFor = (recipe = {}) => normalize([
    recipe.name,
    recipe.title,
    recipe.description,
    recipe.ingredients,
    recipe.instructions,
    recipe.category,
    ...(Array.isArray(recipe.items) ? recipe.items.map(x => [x.name, x.item, x.text, x.ingredientName].filter(Boolean).join(' ')) : [])
  ].filter(Boolean).join(' '));
  const itemTextFor = (item = {}) => normalize([item.name, item.title, item.category, item.supplierName, item.vendorName].filter(Boolean).join(' '));
  const containsPhrase = (hay, needle) => Boolean(hay && needle && (` ${hay} `).includes(` ${needle} `));
  const aliasHitsFor = (tokens, hay) => {
    const hits = [];
    for (const token of tokens) {
      for (const [canonical, aliases] of Object.entries(aliasGroups)) {
        if (token === canonical || aliases.includes(token)) {
          aliases.forEach(alias => { if (containsPhrase(hay, normalize(alias))) hits.push(alias); });
        }
      }
    }
    return Array.from(new Set(hits));
  };
  const scoreRecipeAgainstItem = (recipeText, item = {}) => {
    const itemText = itemTextFor(item);
    const nameKey = normalize(item.name || item.title || '');
    const tokens = significantTokens(itemText);
    const nonGenericTokens = tokens.filter(t => !genericIngredient.has(t));
    let score = 0;
    const reasons = [];

    if (nameKey.length >= 7 && containsPhrase(recipeText, nameKey)) {
      score += 95;
      reasons.push('exact inventory phrase');
    }

    const phrasePieces = [];
    for (let i = 0; i < nonGenericTokens.length - 1; i += 1) phrasePieces.push(`${nonGenericTokens[i]} ${nonGenericTokens[i + 1]}`);
    phrasePieces.forEach(phrase => {
      if (containsPhrase(recipeText, phrase)) {
        score += 42;
        reasons.push(`ingredient phrase: ${phrase}`);
      }
    });

    const directTokenHits = nonGenericTokens.filter(token => containsPhrase(recipeText, token));
    if (directTokenHits.length >= 2) {
      score += directTokenHits.length * 22;
      reasons.push(`matched ${directTokenHits.slice(0, 3).join(', ')}`);
    } else if (directTokenHits.length === 1 && tokens.length <= 2 && !genericIngredient.has(directTokenHits[0])) {
      score += 34;
      reasons.push(`matched ${directTokenHits[0]}`);
    } else if (directTokenHits.length === 1 && tokens.length > 2) {
      score += 12;
    }

    const aliasHits = aliasHitsFor(tokens, recipeText);
    if (aliasHits.length && (directTokenHits.length || tokens.some(t => ['fries','wing','burger','chicken','tortilla','ranch','bacon','cod','haddock'].includes(t)))) {
      score += Math.min(42, aliasHits.length * 12);
      reasons.push(`alias ${aliasHits.slice(0, 2).join(', ')}`);
    }

    // Generic-only hits are noisy. A cheese slice should not automatically mark
    // every recipe with the word cheese unless a manual graph link or a modifier
    // such as swiss/american/cheddar also appears.
    const genericOnly = directTokenHits.length === 0 && tokens.some(t => genericIngredient.has(t) && containsPhrase(recipeText, t));
    if (genericOnly && nonGenericTokens.length === 0) score = Math.min(score, 18);
    if (genericOnly && nonGenericTokens.length > 0 && !directTokenHits.length) score = Math.min(score, 20);

    return { score, reasons: Array.from(new Set(reasons)) };
  };

  const low = inventoryItems.filter(i => Number(i.parLevel || 0) > 0 && Number(i.currentStock || 0) < Number(i.parLevel || 0));
  const lowById = new Map(low.map(item => [item.id, item]));
  const inventoryById = new Map(inventoryItems.map(item => [item.id, item]));
  const recipeById = new Map(recipes.map(recipe => [recipe.id, recipe]));
  const recipeHits = new Map();
  const ensure = (recipe) => {
    const id = recipe?.id || normalize(recipe?.name || recipe?.title || 'recipe');
    if (!recipeHits.has(id)) recipeHits.set(id, { recipe, lowStockMatches: [], prepMatches: [], explicitDependencies: [], eightySixAlerts: [], confidence: 0, matchReasons: [] });
    return recipeHits.get(id);
  };
  const pushReason = (hit, reason) => { if (reason && !hit.matchReasons.includes(reason)) hit.matchReasons.push(reason); };

  (menuDependencies || []).forEach(dep => {
    const recipe = recipeById.get(dep.recipeId) || { id: dep.recipeId || dep.id, name: dep.recipeName || dep.menuItemName || 'Menu item' };
    const lowItem = lowById.get(dep.inventoryItemId) || low.find(item => normalize(item.name) && normalize(item.name) === normalize(dep.inventoryItemName || dep.ingredientName || dep.itemName || ''));
    if (lowItem) {
      const hit = ensure(recipe);
      if (!hit.lowStockMatches.some(i => i.id === lowItem.id)) hit.lowStockMatches.push(lowItem);
      hit.explicitDependencies.push({ ...dep, inventoryItem: lowItem });
      hit.confidence = Math.max(hit.confidence, Number(dep.confidence || dep.matchConfidence || 95));
      pushReason(hit, 'manual dependency graph');
    }
  });

  recipes.forEach(recipe => {
    const recipeText = recipeTextFor(recipe);
    low.forEach(item => {
      const scored = scoreRecipeAgainstItem(recipeText, item);
      if (scored.score >= 55) {
        const hit = ensure(recipe);
        if (!hit.lowStockMatches.some(i => i.id === item.id)) hit.lowStockMatches.push(item);
        hit.confidence = Math.max(hit.confidence, Math.min(92, scored.score));
        scored.reasons.forEach(reason => pushReason(hit, reason));
      }
    });
  });

  const activePrep = prepItems.filter(p => p.isMaster || p.date === getToday() || p.frequency);
  const activePrepKeys = activePrep.map(p => normalize(p.text || p.title || p.name)).filter(k => k.length >= 5);
  recipes.forEach(recipe => {
    const recipeText = recipeTextFor(recipe);
    const prepHits = activePrepKeys.filter(key => containsPhrase(recipeText, key)).slice(0, 5);
    if (prepHits.length) {
      const hit = ensure(recipe);
      hit.prepMatches = Array.from(new Set([...(hit.prepMatches || []), ...prepHits]));
      hit.confidence = Math.max(hit.confidence, 45);
      pushReason(hit, 'prep signal');
    }
  });

  const active86Alerts = (events || []).filter(e => {
    const hay = normalize(`${e.messageCategory || ''} ${e.title || ''} ${e.notes || ''}`);
    return containsPhrase(hay, '86') || containsPhrase(hay, 'eighty six') || hay.includes('out of');
  });
  active86Alerts.forEach(alert => {
    const alertText = normalize(`${alert.title || ''} ${alert.notes || ''} ${alert.inventoryItemName || ''}`);
    const alertTokens = significantTokens(alertText).filter(t => !genericIngredient.has(t));
    recipes.forEach(recipe => {
      const recipeText = recipeTextFor(recipe);
      const nameKey = normalize(recipe.name || recipe.title || '');
      const itemHits = alertTokens.filter(token => containsPhrase(recipeText, token));
      if ((nameKey && containsPhrase(alertText, nameKey)) || itemHits.length >= 1) {
        const hit = ensure(recipe);
        hit.eightySixAlerts.push(alert);
        hit.confidence = Math.max(hit.confidence, nameKey && containsPhrase(alertText, nameKey) ? 90 : 65);
        pushReason(hit, 'active 86 alert');
      }
    });
  });

  const affectedRecipes = Array.from(recipeHits.values())
    .filter(r => r.lowStockMatches.length || r.prepMatches.length || r.eightySixAlerts.length)
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  const mappedDependencyCount = (menuDependencies || []).filter(dep => recipeById.has(dep.recipeId) && inventoryById.has(dep.inventoryItemId)).length;
  return {
    lowStockItems: low,
    affectedRecipes,
    active86Alerts,
    mappedDependencyCount,
    explicitDependencyCount: (menuDependencies || []).length,
    recoveryCount: low.filter(i => Number(i.pendingQty || 0) > 0).length,
    engineVersion: '15.0.83-precision-radar'
  };
};

export const buildV14ClientGuardrailReport = ({ currentVersion = CURRENT_VERSION, features = {}, hasBrandLock = true, hasHelpSearch = true, hasRules = true } = {}) => {
  const checks = [
    { id: 'version', label: `App version is ${CURRENT_VERSION}`, ok: currentVersion === CURRENT_VERSION, detail: `Running ${currentVersion}` },
    { id: 'brand-lock', label: '86 Chaos brand lock', ok: hasBrandLock === true, detail: '86 Chaos must stay visible while restaurant logos remain optional.' },
    { id: 'demo-scrub', label: 'Demo privacy rule', ok: true, detail: 'Demo mode should not display real email, phone, address, wage, or sensitive admin data.' },
    { id: 'help-public', label: 'Help Center public boundary', ok: hasHelpSearch === true, detail: 'Help content must remain public-facing and avoid forensics/backups internals.' },
    { id: 'rules', label: 'Rules included', ok: hasRules === true, detail: 'Firestore and Storage rules are bundled for separate publish.' },
    { id: 'modules', label: 'Feature map readable', ok: typeof features === 'object', detail: `${Object.keys(features || {}).length} module flags loaded.` }
  ];
  return { generatedAt: new Date().toISOString(), checks, ok: checks.every(c => c.ok) };
};


// --- UI Components ---
// ============================================================================
// BRANDING & LOGOS
// ============================================================================

export const __listenerRegistryTestHooks = { makeLiveCollectionKey, clearTenantListenerCache, resetFirebaseUsageDiagnostics };
