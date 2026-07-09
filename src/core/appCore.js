import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, getDoc, setDoc, getDocs, enableIndexedDbPersistence, limit as firestoreLimit } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getMessaging } from 'firebase/messaging';
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


// --- Master Theme (86 Chaos 16.0.2 command-center system) ---
export const T = {
  bg: "bg-[#070A0D] text-slate-100",
  card: "bg-[#111821]/95 border border-[#33414B] shadow-[0_18px_60px_rgba(0,0,0,0.32)] rounded-2xl backdrop-blur-xl",
  border: "border-[#33414B]",
  copper: "text-[#F97316]",
  grad: "bg-gradient-to-r from-[#FF8A1C] via-[#F59E0B] to-[#C76712]",
  btn: "bg-gradient-to-r from-[#FF8A1C] via-[#F59E0B] to-[#C76712] text-slate-950 font-black uppercase tracking-wider rounded-xl shadow-[0_12px_30px_rgba(249,115,22,0.28)] hover:brightness-110 active:scale-[0.99] transition-all px-4 py-2.5 text-xs text-center",
  btnAlt: "bg-[#0D1318]/95 text-slate-200 border border-[#33414B] font-black rounded-xl hover:text-[#FFB34D] hover:border-[#F97316]/60 hover:bg-[#151D24] transition-all px-4 py-2.5 text-xs",
  input: "w-full p-3 bg-[#070A0D]/85 border border-[#33414B] text-white rounded-xl outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 transition-all font-medium text-sm placeholder:text-slate-600",
  label: "block text-[10px] uppercase tracking-widest font-black text-slate-400 mb-1.5",
  muted: "text-slate-400",
  th: "bg-[#0D1318] border-b border-[#33414B] text-[10px] font-black text-[#FFB34D] uppercase tracking-widest p-3",
  row: "hover:bg-[#151D24]/70 border-b border-[#33414B] transition-colors p-3",
};

// --- Firebase Initialization ---
// 1. TEST DATABASE CONFIG (Sandbox)
export const testConfig = {
  apiKey: "AIzaSyBIRGMeLnVE3w3i1WZJzurcp-LkeaNZ3hw",
  authDomain: "chaos-test-d1601.firebaseapp.com",
  projectId: "chaos-test-d1601",
  storageBucket: "chaos-test-d1601.firebasestorage.app",
  messagingSenderId: "534993379994",
  appId: "1:534993379994:web:9fefb6e10309223afe7523"
};

// 2. MAIN PRODUCTION DATABASE CONFIG (Live Data)
export const prodConfig = {
  apiKey: "AIzaSyA0kkmRCqGNoB1LXKfuCNIl1JKDyQci9hA",
  authDomain: "cheers-34b8d.firebaseapp.com",
  projectId: "cheers-34b8d",
  storageBucket: "cheers-34b8d.firebasestorage.app",
  messagingSenderId: "762225019248",
  appId: "1:762225019248:web:3e142c9563e58ca762a7b5",
  measurementId: "G-JFZ6EZB0E3"
};

// 3. THE SWITCHER (Automatically routes the database based on the URL)
export const firebaseConfig = window.location.hostname === 'app.86chaos.com' ? prodConfig : testConfig;

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const messaging = typeof window !== "undefined" ? getMessaging(app) : null;

// Kitchen Wi-Fi Armor: Keep app working in walk-in coolers
enableIndexedDbPersistence(db).catch((err) => console.warn("Offline mode issue:", err.code));

export const auth = getAuth(app);

// --- OPTIONAL APP CHECK + SECURE API KEYCHAIN ---
// Put your Firebase App Check reCAPTCHA Enterprise site key here after enabling App Check in Firebase.
// Example: const APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY = '6Lc...';
const APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY = '';
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

// This attaches the real Firebase Auth token to Vercel API requests.
// Do not trust client-sent role/email/restaurantId in API routes; verify this token server-side.
export const secureFetch = async (url, options = {}) => {
  if (!auth.currentUser) throw new Error("Unauthorized: No active user session.");
  const { forceTokenRefresh = false, headers: optionHeaders = {}, ...fetchOptions } = options;
  const token = await auth.currentUser.getIdToken(forceTokenRefresh);
  const appCheckHeader = await getAppCheckHeader();
  const headers = {
    ...optionHeaders,
    ...appCheckHeader,
    'Authorization': `Bearer ${token}`
  };
  return fetch(url, { ...fetchOptions, headers });
};

// --- Master Configuration ---
export const MASTER_ADMIN_EMAIL = 'geoffm1985@gmail.com';
export const EVENT_TAGS = ['Standard Day', 'Packers Game', 'Brewers Game', 'Live Music', 'Severe Weather', 'Private Catering', 'Holiday'];

// --- VERSION TRACKING ---
export const CURRENT_VERSION = '16.0.2';

// --- Helpers ---
export const useLiveCollection = (coll, restId, options = {}) => {
  const { enabled = true, limitCount = null } = options || {};
  const [data, setData] = useState([]);

  useEffect(() => {
    if (!enabled || !restId) {
      setData([]);
      return;
    }

    const constraints = [where("restaurantId", "==", restId)];
    if (limitCount && Number(limitCount) > 0) {
      constraints.push(firestoreLimit(Number(limitCount)));
    }

    const q = query(collection(db, coll), ...constraints);
    const unsubscribe = onSnapshot(
      q,
      snap => setData(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => {
        console.error(`Live collection error for ${coll} / ${restId}:`, err);
        setData([]);
      }
    );
    return () => unsubscribe();
  }, [coll, restId, enabled, limitCount]);

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
    addDoc(collection(db, "crashReports"), { 
      type: 'error', 
      message: msg, 
      stack: error?.stack || '', 
      breadcrumbs: window.breadcrumbs || [], // Attach the breadcrumbs to the crash
      userAgent: navigator.userAgent, // Captures device, OS, and browser info
      screenSize: `${window.innerWidth}x${window.innerHeight}`, // Helps debug UI clipping
      time: new Date().toISOString() 
    }).catch(()=>{}); 
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
    await addDoc(collection(db, "auditLogs"), {
      userId: isGhost ? (user.ghostRealUserId || user.id || 'system') : (user.id || 'system'),
      userName: isGhost
        ? `${user.ghostRealUserName || user.name || 'System'} (Ghost${user.ghostTargetUserName ? ` as ${user.ghostTargetUserName}` : ''})`
        : (user.name || 'System'),
      ghostTargetUserId: user.ghostTargetUserId || null,
      ghostTargetUserName: user.ghostTargetUserName || null,
      ghostWorkspaceId: isGhost ? user.restaurantId : null,
      action,
      target,
      details,
      timestamp: new Date().toISOString(),
      restaurantId: user.restaurantId,
      isGhost
    });
  } catch (err) { console.error("Audit log failed:", err); }
};


// --- UI Components ---
// ============================================================================
// BRANDING & LOGOS
// ============================================================================
