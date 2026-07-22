import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, getDoc, setDoc, getDocs, enableIndexedDbPersistence, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getMessaging, isSupported } from 'firebase/messaging';
import { getStorage } from 'firebase/storage';
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
  appId: env('REACT_APP_TEST_FIREBASE_APP_ID', '1:534993379994:web:9fefb6e10309223afe7523')
};

// 2. MAIN PRODUCTION DATABASE CONFIG (Live Data)
export const prodConfig = {
  apiKey: env('REACT_APP_PROD_FIREBASE_API_KEY', 'AIzaSyA0kkmRCqGNoB1LXKfuCNIl1JKDyQci9hA'),
  authDomain: env('REACT_APP_PROD_FIREBASE_AUTH_DOMAIN', 'cheers-34b8d.firebaseapp.com'),
  projectId: env('REACT_APP_PROD_FIREBASE_PROJECT_ID', 'cheers-34b8d'),
  storageBucket: env('REACT_APP_PROD_FIREBASE_STORAGE_BUCKET', 'cheers-34b8d.firebasestorage.app'),
  messagingSenderId: env('REACT_APP_PROD_FIREBASE_MESSAGING_SENDER_ID', '762225019248'),
  appId: env('REACT_APP_PROD_FIREBASE_APP_ID', '1:762225019248:web:3e142c9563e58ca762a7b5'),
  measurementId: env('REACT_APP_PROD_FIREBASE_MEASUREMENT_ID', 'G-JFZ6EZB0E3')
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
const browserLooksMessagingCapable = () => {
  try {
    return typeof window !== "undefined"
      && typeof navigator !== "undefined"
      && 'serviceWorker' in navigator
      && typeof window.PushManager !== "undefined"
      && typeof window.Notification !== "undefined";
  } catch (_) {
    return false;
  }
};

const safeGetMessaging = () => {
  if (!browserLooksMessagingCapable()) return null;
  try { return getMessaging(app); }
  catch (err) {
    console.warn('Firebase Messaging is unavailable on this browser:', err?.message || err);
    return null;
  }
};

export const messaging = safeGetMessaging();
export const messagingReady = browserLooksMessagingCapable()
  ? isSupported().then((supported) => supported ? messaging : null).catch((err) => {
      console.warn('Firebase Messaging support check failed:', err?.message || err);
      return null;
    })
  : Promise.resolve(null);

// Kitchen Wi-Fi Armor: Keep app working in walk-in coolers
enableIndexedDbPersistence(db).catch((err) => console.warn("Offline mode issue:", err.code));

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
export const CURRENT_VERSION = '15.1.10';

// --- Helpers ---
export const useLiveCollection = (coll, restId, options = {}) => {
  const {
    enabled = true,
    limitCount = null,
    whereClauses = [],
    orderByField = null,
    orderDirection = 'asc',
    fallbackLimitCount = 75,
    global = false
  } = options || {};
  const [data, setData] = useState([]);

  useEffect(() => {
    if (!enabled || (!restId && !global)) {
      setData([]);
      return;
    }

    let fallbackUnsubscribe = null;
    const serializedWhere = JSON.stringify(whereClauses || []);
    const buildConstraints = (useWindow = true) => {
      const constraints = global ? [] : [where("restaurantId", "==", restId)];
      if (useWindow) {
        (whereClauses || []).forEach(([field, op, value]) => {
          if (field && op && value !== undefined && value !== null && value !== '') constraints.push(where(field, op, value));
        });
        if (orderByField) constraints.push(orderBy(orderByField, orderDirection || 'asc'));
      }
      if (limitCount && Number(limitCount) > 0) constraints.push(firestoreLimit(Number(limitCount)));
      return constraints;
    };

    const subscribe = (constraints, label) => onSnapshot(
      query(collection(db, coll), ...constraints),
      snap => setData(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => {
        const message = err?.message || String(err || '');
        const isIndexProblem = err?.code === 'failed-precondition' || /index|requires an index|currently building/i.test(message);
        if (isIndexProblem) {
          console.warn(`Firestore index pending for ${coll} / ${global ? 'global' : restId} (${label}). Waiting for the deployed index instead of showing a mismatched fallback query.`, message);
        } else {
          console.error(`Live collection error for ${coll} / ${global ? 'global' : restId} (${label}):`, err);
        }
        setData([]);
      }
    );

    const unsubscribe = subscribe(buildConstraints(true), 'primary');
    return () => {
      if (unsubscribe) unsubscribe();
      if (fallbackUnsubscribe) fallbackUnsubscribe();
    };
  }, [coll, restId, enabled, limitCount, orderByField, orderDirection, fallbackLimitCount, global, JSON.stringify(whereClauses || [])]);

  return data;
};
export const formatDate = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split('T')[0];
export const getToday = () => formatDate(new Date());
export const getMonthStr = (d) => (d || getToday()).substring(0, 7);
export const formatDisplayDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
export const formatDisplayFullDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
export const formatDisplayMonth = (m) => new Date(m + '-01T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
export const getDaysInMonth = (m) => new Date(m.split('-')[0], m.split('-')[1], 0).getDate();
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

export const getAvatar = (name, url) => url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name||'Staff')}&background=random&color=fff&bold=true`;
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

  window.onerror = (msg, url, lineNo, columnNo, error) => {
    try {
      if (auth.currentUser) {
        secureFetch('/api/report-bug', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: 'Crash / Error',
            message: String(msg || 'Browser error').slice(0, 2000),
            rawStack: String(error?.stack || '').slice(0, 2500),
            breadcrumbs: window.breadcrumbs || [],
            userAgent: navigator.userAgent,
            screenSize: `${window.innerWidth}x${window.innerHeight}`,
            url: window.location.href,
            source: 'window_onerror'
          })
        }).catch(()=>{});
      }
    } catch (_) {}
    return false;
  }; 
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
const V14_TENANT_COLLECTIONS = ['events','messages','shiftSwaps','tasks','timePunches','tempLogs','wasteLogs','maintenanceLogs','prepItems','prepCategories','lineCheckItems','recipes','inventoryItems','vendors','orders','invoices','shifts','timeOffRequests','roles','pmSchedules','sales','menuDependencies','kitchenSpecials','trainingManuals','hrOnboardingTasks','hrCertifications','hrPerformanceNotes','financialExpenses','financialTargets','offlineWriteReceipts','scheduleTemplates','scheduleCoverageTargets','opsInsights','managerBrief','inventoryHealth','laborHealth','menuImpact'];
const V14_WRITE_PERMISSIONS = {
  shifts: ['schedule', 'team'], timeOffRequests: ['schedule', 'team'], scheduleTemplates: ['schedule', 'team'], scheduleCoverageTargets: ['schedule', 'team'],
  inventoryItems: ['inventory', 'inventoryEdit'], vendors: ['inventory', 'inventoryEdit'], orders: ['inventory', 'inventoryEdit'], invoices: ['inventory', 'invoiceScan', 'scans'],
  prepItems: ['prep', 'team'], prepCategories: ['prep', 'team'], lineCheckItems: ['prep', 'team'], recipes: ['prep', 'team'], menuDependencies: ['prep', 'inventory', 'menuIntelligence'], kitchenSpecials: ['prep', 'ops', 'team'],
  sales: ['sales', 'salesEdit', 'financialEdit'], timePunches: ['labor', 'laborEdit'], financialExpenses: ['sales', 'salesEdit', 'financialEdit'], financialTargets: ['sales', 'salesEdit', 'financialEdit'],
  pmSchedules: ['team'], maintenanceLogs: ['team'], tasks: ['prep', 'team'],
  trainingManuals: ['hr'], hrOnboardingTasks: ['hr'], hrCertifications: ['hr'], hrPerformanceNotes: ['hr'],
  events: ['events', 'schedule', 'team'], messages: ['messages', 'team'], shiftSwaps: ['schedule', 'team'], tempLogs: ['prep', 'team'], wasteLogs: ['inventory', 'prep'],
  opsInsights: ['ops', 'team'], managerBrief: ['ops', 'team'], inventoryHealth: ['inventory', 'inventoryEdit'], laborHealth: ['labor', 'laborEdit'], menuImpact: ['prep', 'inventory', 'menuIntelligence']
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

export const safeWrite = async ({ user, action = 'set', collectionName, docId = '', data = {}, merge = true, label = '', before = null, addToast = null }) => {
  if (!user?.restaurantId && !isSuperAdminUser(user)) throw new Error('Safe Write blocked: missing restaurant workspace.');
  if (user?.demoMode || user?.isDemo) throw new Error('Safe Write blocked: demo mode cannot change live data.');
  if (!canUserWriteCollection(user, collectionName)) throw new Error(`Safe Write blocked: missing permission for ${collectionName}.`);
  if (V14_TENANT_COLLECTIONS.includes(collectionName) && !isSuperAdminUser(user)) {
    const incomingRest = data?.restaurantId || before?.restaurantId || user.restaurantId;
    if (incomingRest && incomingRest !== user.restaurantId) throw new Error('Safe Write blocked: restaurant mismatch.');
  }
  const now = new Date().toISOString();
  const payload = V14_TENANT_COLLECTIONS.includes(collectionName)
    ? { ...data, restaurantId: data?.restaurantId || user.restaurantId, updatedAt: now, updatedBy: user?.name || user?.email || '86 Chaos' }
    : { ...data, updatedAt: now, updatedBy: user?.name || user?.email || '86 Chaos' };
  let refObj;
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
  await logAudit(user, `SAFE_WRITE_${String(action).toUpperCase()}`, `${collectionName}/${docId || refObj?.id || ''}`, JSON.stringify({ label, after: scrubForAudit(payload), before: scrubForAudit(before) }).slice(0, 2500));
  if (addToast) addToast('Saved', label || `${collectionName} updated safely.`);
  return { id: refObj?.id || docId, path: `${collectionName}/${refObj?.id || docId}`, payload };
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
