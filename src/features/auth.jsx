import React, { useState, useEffect } from 'react';
import { Bell, Check, Camera, ChevronLeft, ChevronRight, MessageSquare, Plus, Trash2, Users, Calendar, Clock, X, Loader2, Package, ClipboardList, Menu, Settings, LogOut, Shield, Send, Repeat, Edit, Moon, Sun, TrendingUp, BookOpen, Search, ChefHat, Scale, Coffee, Star, Bug, Wrench, Globe } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, getDoc, setDoc, getDocs } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail, createUserWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { getToken, onMessage } from 'firebase/messaging';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
import { T, db, storage, auth, messaging, firebaseConfig, secureFetch, MASTER_ADMIN_EMAIL, EVENT_TAGS, CURRENT_VERSION, useLiveCollection, formatDate, getToday, getMonthStr, formatDisplayDate, formatDisplayFullDate, formatDisplayMonth, getDaysInMonth, formatShortTime, formatClockTime, formatClockDateTime, getAvatar, generateTempPass, getExpDate, getHoliday, logAudit, customMapIcon } from '../core/appCore';
import { CheersLogo, Modal, DrawerMenu, DayDotPrintScreen, MapClickListener, SmartEmptyState, MiniProblemCard, getHomeProfile, calculatePunchHours, getWeekStart, getWeekDates, roleMatches, toLocalTimeInput, makeLocalIso, PunchTable, StatusTile, FriendlyEmpty, GlobalSearchModal, QuickActionDock, KitchenTVMode, ChangeLogModal, UndoBar } from '../components/common';

const normEmail = (value) => String(value || '').toLowerCase().trim();
const safeWsName = (w = {}) => w.restaurantName || w.name || w.businessName || w.restaurantId || '86 Chaos Workspace';
const membershipDocId = (uid, restaurantId) => `${String(uid || '').replace(/[^A-Za-z0-9_-]/g, '_')}_${String(restaurantId || '').replace(/[^A-Za-z0-9_-]/g, '_')}`.slice(0, 240);
const buildActiveUserForWorkspace = (baseUser = {}, workspace = {}) => {
  const safeBase = { ...baseUser };
  delete safeBase.password;
  const accountProfile = {
    id: safeBase.id,
    name: safeBase.name,
    email: safeBase.email,
    phone: safeBase.phone,
    photoURL: safeBase.photoURL,
    isSuperAdmin: safeBase.isSuperAdmin,
    systemAccess: safeBase.systemAccess,
    defaultRestaurantId: safeBase.defaultRestaurantId || safeBase.restaurantId,
    workspaceIds: safeBase.workspaceIds || [],
    memberships: safeBase.memberships || {}
  };
  return {
    ...safeBase,
    id: safeBase.id || workspace.userId || workspace.uid,
    userId: safeBase.id || workspace.userId || workspace.uid,
    accountProfile,
    restaurantId: workspace.restaurantId || safeBase.restaurantId,
    restaurantName: safeWsName(workspace),
    membershipId: workspace.membershipId || workspace.id || membershipDocId(safeBase.id, workspace.restaurantId),
    name: workspace.name || safeBase.name || 'Staff',
    email: normEmail(workspace.email || safeBase.email),
    phone: workspace.phone || safeBase.phone || '',
    role: workspace.role || safeBase.role || 'Staff',
    wage: workspace.wage ?? safeBase.wage ?? 0,
    photoURL: workspace.photoURL || safeBase.photoURL || '',
    permissions: { ...(safeBase.permissions || {}), ...(workspace.permissions || {}) },
    isAdmin: workspace.isAdmin === true || safeBase.isSuperAdmin === true,
    isOwner: workspace.isOwner === true || workspace.accountOwner === true || workspace.workspaceOwner === true || safeBase.isOwner === true,
    accountOwner: workspace.accountOwner === true || safeBase.accountOwner === true,
    workspaceOwner: workspace.workspaceOwner === true || safeBase.workspaceOwner === true,
    isActive: workspace.isActive !== false && safeBase.isActive !== false,
    activeRestaurantId: workspace.restaurantId || safeBase.activeRestaurantId || safeBase.restaurantId,
    defaultRestaurantId: safeBase.defaultRestaurantId || workspace.restaurantId || safeBase.restaurantId,
    workspaceSwitcherReady: true
  };
};

const LoginScreen = ({ setAppUser }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [workspaceChoices, setWorkspaceChoices] = useState([]);
  const [workspaceUser, setWorkspaceUser] = useState(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  
  // New state to hold the user temporarily if they need to change their password
  const [pendingUser, setPendingUser] = useState(null);
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');


  const loadWorkspaceChoices = async (baseUser, firebaseUser) => {
    const options = new Map();
    const uid = firebaseUser?.uid || baseUser.id;
    const emailKey = normEmail(firebaseUser?.email || baseUser.email);
    const addOption = async (raw = {}) => {
      const restaurantId = raw.restaurantId || raw.id;
      if (!restaurantId || raw.isActive === false) return;
      let rest = {};
      try {
        const restSnap = await getDoc(doc(db, 'restaurants', restaurantId));
        if (restSnap.exists()) rest = { id: restSnap.id, ...restSnap.data() };
      } catch (_) {}
      options.set(restaurantId, {
        ...raw,
        userId: raw.userId || uid,
        uid,
        email: normEmail(raw.email || emailKey),
        name: raw.name || baseUser.name || firebaseUser?.displayName || 'Staff',
        restaurantId,
        restaurantName: raw.restaurantName || rest.name || rest.businessName || rest.restaurantName || baseUser.restaurantName || restaurantId,
        planType: rest.planType || raw.planType || baseUser.planType || 'Pro',
        membershipId: raw.membershipId || raw.id || membershipDocId(uid, restaurantId),
        permissions: { ...(baseUser.restaurantId === restaurantId ? (baseUser.permissions || {}) : {}), ...(raw.permissions || {}) },
        isAdmin: raw.isAdmin === true || (baseUser.restaurantId === restaurantId && baseUser.isAdmin === true),
        isOwner: raw.isOwner === true || raw.accountOwner === true || raw.workspaceOwner === true || (baseUser.restaurantId === restaurantId && (baseUser.isOwner === true || baseUser.accountOwner === true || baseUser.workspaceOwner === true))
      });
    };

    if (baseUser.memberships && typeof baseUser.memberships === 'object') {
      for (const [restaurantId, membership] of Object.entries(baseUser.memberships)) await addOption({ ...(membership || {}), restaurantId });
    }
    try {
      const byUid = await getDocs(query(collection(db, 'workspaceMembers'), where('userId', '==', uid)));
      for (const d of byUid.docs) await addOption({ id: d.id, ...d.data() });
    } catch (err) {
      console.warn('Workspace membership lookup by user failed:', err?.message || err);
    }
    if (emailKey) {
      try {
        const byEmail = await getDocs(query(collection(db, 'workspaceMembers'), where('email', '==', emailKey)));
        for (const d of byEmail.docs) await addOption({ id: d.id, ...d.data() });
      } catch (err) {
        console.warn('Workspace membership lookup by email failed:', err?.message || err);
      }
    }
    if (baseUser.restaurantId) await addOption({ ...baseUser, restaurantId: baseUser.restaurantId, restaurantName: baseUser.restaurantName });
    return Array.from(options.values()).filter(w => w.isActive !== false);
  };

  const finishLoginWithWorkspace = async (baseUser, firebaseUser, { forcePicker = false } = {}) => {
    setWorkspaceLoading(true);
    try {
      const choices = await loadWorkspaceChoices(baseUser, firebaseUser);
      if (!choices.length) throw new Error('This login is not attached to an active restaurant workspace. Ask a manager to add this account.');
      const savedRestaurantId = localStorage.getItem(`chaosActiveRestaurantId_${baseUser.id}`);
      const preferred = choices.find(w => w.restaurantId === savedRestaurantId) || choices.find(w => w.restaurantId === baseUser.activeRestaurantId) || choices.find(w => w.restaurantId === baseUser.defaultRestaurantId) || choices.find(w => w.restaurantId === baseUser.restaurantId) || choices[0];
      if (choices.length > 1 && forcePicker) {
        setWorkspaceUser(baseUser);
        setWorkspaceChoices(choices);
        return;
      }
      localStorage.setItem('chaosRememberMe', rememberMe);
      localStorage.setItem(`chaosActiveRestaurantId_${baseUser.id}`, preferred.restaurantId);
      updateDoc(doc(db, 'users', baseUser.id), {
        activeRestaurantId: preferred.restaurantId,
        lastWorkspaceId: preferred.restaurantId,
        lastWorkspaceSwitchedAt: new Date().toISOString()
      }).catch(() => {});
      setAppUser({ ...buildActiveUserForWorkspace(baseUser, preferred), availableWorkspaces: choices });
    } finally {
      setWorkspaceLoading(false);
    }
  };

  const chooseWorkspace = (workspace) => {
    if (!workspaceUser) return;
    localStorage.setItem('chaosRememberMe', rememberMe);
    localStorage.setItem(`chaosActiveRestaurantId_${workspaceUser.id}`, workspace.restaurantId);
    updateDoc(doc(db, 'users', workspaceUser.id), {
      activeRestaurantId: workspace.restaurantId,
      lastWorkspaceId: workspace.restaurantId,
      lastWorkspaceSwitchedAt: new Date().toISOString()
    }).catch(() => {});
    setAppUser({ ...buildActiveUserForWorkspace(workspaceUser, workspace), availableWorkspaces: workspaceChoices });
    setWorkspaceChoices([]);
    setWorkspaceUser(null);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setWorkspaceChoices([]);
    setWorkspaceUser(null);
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (userDocSnap.exists()) {
        const userData = { id: firebaseUser.uid, ...userDocSnap.data() };
        delete userData.password;
        
        // INTERCEPT: If the flag is true, hold them in the pending state
        if (userData.forcePasswordChange) {
          setPendingUser(userData);
        } else {
          await finishLoginWithWorkspace(userData, firebaseUser, { forcePicker: true });
        }
      } else {
        setLoginError('Login successful, but user profile is missing in the database.');
      }
    } catch (error) {
      setLoginError(error.message);
    }
  };

  const handleForcePasswordChange = async (e) => {
    e.preventDefault();
    setLoginError('');

    if (newPass !== confirmPass) return setLoginError('Passwords do not match.');
    if (newPass.length < 6) return setLoginError('Password must be at least 6 characters.');

    try {
      // 1. Update the secure Firebase Auth password
      await updatePassword(auth.currentUser, newPass);
      
      // 2. Flip the database flag so they are never asked again.
      // Passwords belong ONLY in Firebase Auth, never in Firestore.
      await updateDoc(doc(db, "users", pendingUser.id), { 
        forcePasswordChange: false,
        passwordPurgedAt: new Date().toISOString()
      });
      
      // 3. Unlock the system without caching the password in app state.
      const { password, ...safePendingUser } = pendingUser;
      await finishLoginWithWorkspace({ ...safePendingUser, forcePasswordChange: false }, auth.currentUser, { forcePicker: true });
      
    } catch (error) {
      setLoginError(error.message);
    }
  };

  const handleForgotCredentials = async () => {
    if (!email) {
      setLoginError("Please type your email address into the top box first, then click Forgot Password.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth,
 email);
      setLoginError("Reset link sent! Check your email inbox.");
    } catch (error) {
      setLoginError(error.message);
    }
  };

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center bg-[#0B0E11] bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: `url('/6136.jpg')` }}
    >
      <div className="absolute inset-0 bg-[#0B0E11]/75 backdrop-blur-[3px]"></div>
      
      <div className="relative z-10 w-full max-w-sm p-8 bg-[#161D22]/95 border border-[#2A353D] rounded-3xl shadow-2xl flex flex-col items-center animate-[slideIn_0.3s_ease-out]">
        
        <img src="/6139.png" alt="86 Chaos OS Logo" className="h-24 w-auto rounded-xl shadow-lg border border-[#2A353D] mb-8 object-contain bg-[#12161A] p-2" />
        
        {workspaceLoading && (
          <div className="w-full mb-4 p-3 rounded-xl border border-[#2A353D] bg-[#0B0E11]/80 text-center text-xs font-black text-[#D4A381] uppercase tracking-widest flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading workspaces
          </div>
        )}

        {workspaceUser && workspaceChoices.length > 0 ? (
          <div className="w-full space-y-4 animate-[slideIn_0.2s_ease-out]">
            <div className="text-center mb-4">
              <h2 className="text-xl font-black text-white leading-tight">Choose Workspace</h2>
              <p className="text-xs text-slate-400 font-bold mt-1">Pick which restaurant you are working in right now.</p>
            </div>
            {loginError && <div className="p-3 bg-red-900/50 border border-red-500/50 rounded-xl text-red-200 text-xs font-bold text-center">{loginError}</div>}
            <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
              {workspaceChoices.map((workspace) => (
                <button
                  key={workspace.restaurantId}
                  type="button"
                  onClick={() => chooseWorkspace(workspace)}
                  className="w-full text-left p-4 rounded-2xl bg-[#0B0E11] border border-[#2A353D] hover:border-[#D4A381] transition-all group"
                >
                  <p className="text-white font-black text-sm group-hover:text-[#D4A381]">{workspace.restaurantName || workspace.restaurantId}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-1">{workspace.role || 'Staff'} • {workspace.restaurantId}</p>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => { setWorkspaceChoices([]); setWorkspaceUser(null); }}
              className="w-full py-3 rounded-xl border border-[#2A353D] text-slate-400 text-xs font-black uppercase tracking-widest hover:text-white hover:border-slate-500"
            >
              Back to Login
            </button>
          </div>
        ) : pendingUser ? (
          <form onSubmit={handleForcePasswordChange} className="w-full space-y-4 animate-[slideIn_0.2s_ease-out]">
            <div className="text-center mb-4">
              <h2 className="text-xl font-black text-white leading-tight">Welcome, {pendingUser.name.split(' ')[0]}!</h2>
              <p className="text-xs text-[#D4A381] font-bold mt-1 uppercase tracking-widest">Please set a permanent password.</p>
            </div>
            
            {loginError && <div className="p-3 bg-red-900/50 border border-red-500/50 rounded-xl text-red-200 text-xs font-bold text-center">{loginError}</div>}

            <div>
              <input type="password" placeholder="New Password (min 6 chars)" value={newPass} onChange={e => setNewPass(e.target.value)} className="w-full text-center text-lg font-bold bg-[#0B0E11] border border-[#2A353D] rounded-xl py-4 text-white focus:outline-none focus:border-[#D4A381] transition-colors shadow-inner" required />
            </div>
            <div>
              <input type="password" placeholder="Confirm New Password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} className="w-full text-center text-lg font-bold bg-[#0B0E11] border border-[#2A353D] rounded-xl py-4 text-white focus:outline-none focus:border-[#D4A381] transition-colors shadow-inner" required />
            </div>
            
            <button type="submit" className="w-full bg-gradient-to-r from-[#D4A381] to-[#b58563] text-slate-900 font-black tracking-widest uppercase text-lg py-4 rounded-xl shadow-[0_0_20px_rgba(212,163,129,0.2)] hover:scale-[1.02] transition-all mt-2">
              Save & Enter OS
            </button>
          </form>
        ) : (
          /* OTHERWISE, RENDER THE STANDARD LOGIN FORM */
          <form onSubmit={handleLogin} className="w-full space-y-4">
            
            {loginError && <div className="p-3 bg-red-900/50 border border-red-500/50 rounded-xl text-red-200 text-xs font-bold text-center">{loginError}</div>}

            <div>
              <input type="text" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} className="w-full text-center text-lg font-bold bg-[#0B0E11] border border-[#2A353D] rounded-xl py-4 text-white focus:outline-none focus:border-[#D4A381] transition-colors shadow-inner" />
            </div>
     <div>
              <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full text-center text-lg font-bold bg-[#0B0E11] border border-[#2A353D] rounded-xl py-4 text-white focus:outline-none focus:border-[#D4A381] transition-colors shadow-inner" />
            </div>

            <label className="flex items-center justify-center gap-2 cursor-pointer mt-2">
              <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="w-4 h-4 accent-[#D4A381] bg-[#0B0E11] border border-[#2A353D] rounded cursor-pointer" />
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Remember Me</span>
            </label>
            
            <button type="submit" disabled={workspaceLoading} className="w-full bg-gradient-to-r from-[#D4A381] to-[#b58563] disabled:opacity-60 disabled:cursor-wait text-slate-900 font-black tracking-widest uppercase text-lg py-4 rounded-xl shadow-[0_0_20px_rgba(212,163,129,0.2)] hover:scale-[1.02] transition-all mt-4">
              {workspaceLoading ? 'Checking Workspaces...' : 'Unlock System'}
            </button>
<div className="pt-3 text-center flex flex-col gap-2">
              <button type="button" onClick={handleForgotCredentials} className="text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-[#D4A381] transition-colors">
                Forgot Password or Username?
              </button>
              <button type="button" onClick={() => setIsPrivacyModalOpen(true)} className="text-[10px] font-bold text-slate-600 hover:text-slate-400 transition-colors mt-4">
                Privacy Policy & Terms of Service
              </button>
            </div>
          </form>
        )}
      </div>

      <Modal isOpen={isPrivacyModalOpen} onClose={() => setIsPrivacyModalOpen(false)} title="Privacy Policy">
        <div className="space-y-4 text-xs font-medium text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
          <div className="text-center border-b border-[#2A353D] pb-3 mb-3">
            <h3 className="font-black text-white text-lg uppercase tracking-widest">Privacy Policy for 86chaos</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Last Updated: July 6, 2026</p>
          </div>
          <p>Chilton App Works, LLC ("we," "us," or "our") operates the 86chaos restaurant operations web app, progressive web app, and related services (the "Service"). This policy explains what information may be collected, how it is used, and how restaurants and employees can request help with privacy questions.</p>
          <p>86chaos is built for restaurants and workplace operations. It is not directed to children under 13, and restaurant managers should not create accounts for children who are not legally authorized to use workplace systems.</p>

          <h4 className="font-black text-[#D4A381] text-sm mt-4">1. Information We Collect</h4>
          <p>Depending on what your restaurant enables, we may collect:</p>
          <ul className="list-disc pl-5 space-y-1 mt-1 text-slate-400">
            <li><strong className="text-white">Account and Staff Information:</strong> name, email/login label, phone number, profile photo, job role, permissions, workspace/restaurant ID, and account status.</li>
            <li><strong className="text-white">Scheduling and Labor Information:</strong> shifts, time punches, time-off requests, trade requests, wage labels entered by management, tips, approvals, punch corrections, and manager notes.</li>
            <li><strong className="text-white">Location Information:</strong> precise GPS location may be requested only when a clock-in or clock-out location rule is enabled. Location is used to compare the punch against the restaurant's required work area. 86chaos does not run background location tracking.</li>
            <li><strong className="text-white">Operational Content:</strong> prep lists, inventory records, recipes, invoices, vendor information, maintenance logs, sales/ledger entries, message board posts, likes, alerts, and uploaded attachments.</li>
            <li><strong className="text-white">Camera, Files, and Photos:</strong> with permission, the app can use camera/file access for invoice scanning, profile photos, message attachments, maintenance photos, and similar restaurant workflows.</li>
            <li><strong className="text-white">Device, Security, and Diagnostic Data:</strong> browser/device type, screen size, active tab, notification permission status, push token status, service worker support, IndexedDB support, error logs, audit logs, and recent app actions attached to crash reports.</li>
          </ul>

          <h4 className="font-black text-[#D4A381] text-sm mt-4">2. How We Use Information</h4>
          <ul className="list-disc pl-5 space-y-1 mt-1 text-slate-400">
            <li>Provide restaurant operations tools, including scheduling, time clock, staff management, inventory, prep, message board, financial/labor views, maintenance, backups, and support tools.</li>
            <li>Verify location-based punches when the restaurant enables geofence rules and mark punches for manager review when needed.</li>
            <li>Send notifications about schedules, shift changes, messages, trade requests, time-off updates, manager alerts, and system notices.</li>
            <li>Scan vendor invoices with AI document parsing so managers can review purchased product rows before updating inventory.</li>
            <li>Secure the app, troubleshoot bugs, investigate support issues, maintain audit trails, prevent unauthorized access, and restore data from backups.</li>
          </ul>

          <h4 className="font-black text-[#D4A381] text-sm mt-4">3. Sharing and Service Providers</h4>
          <p>We do not sell personal information. We share information only as needed to operate the Service, support your restaurant, comply with legal requirements, or protect the app and users.</p>
          <ul className="list-disc pl-5 space-y-1 mt-1 text-slate-400">
            <li><strong className="text-white">Cloud hosting, database, authentication, push, and storage:</strong> Google Cloud/Firebase services.</li>
            <li><strong className="text-white">Web hosting and serverless routes:</strong> Vercel.</li>
            <li><strong className="text-white">AI document processing:</strong> AI providers used only for document parsing workflows such as invoice scanning, not for facial recognition or biometric identification.</li>
            <li><strong className="text-white">Optional integrations:</strong> POS, payroll, accounting, notification, or other providers connected by your restaurant.</li>
          </ul>

          <h4 className="font-black text-[#D4A381] text-sm mt-4">4. Restaurant / Employer Control</h4>
          <p>86chaos is a business-to-business tool. Your restaurant/employer controls most workspace content and staff records. Employees who want to access, correct, export, or delete workplace records should contact restaurant management first. We can assist the restaurant with support requests when appropriate.</p>

          <h4 className="font-black text-[#D4A381] text-sm mt-4">5. Data Retention</h4>
          <p>Operational data is retained while the restaurant workspace is active and as needed for payroll, scheduling, compliance, support, backups, fraud prevention, and legitimate business records. Backup files may retain restored or historical data for a limited backup window. If a workspace or user is deleted, active records are removed according to the restaurant's instructions and our backup/maintenance practices.</p>

          <h4 className="font-black text-[#D4A381] text-sm mt-4">6. Security</h4>
          <p>We use authentication, role-based permissions, server-side admin routes, audit logs, secure hosting, Firebase security rules, and backup controls to protect data. No system is perfect, so restaurants should use strong passwords, limit administrator access, and promptly disable accounts that no longer need access.</p>

          <h4 className="font-black text-[#D4A381] text-sm mt-4">7. Choices and Permissions</h4>
          <p>You can deny browser permissions such as notifications, camera, or location, but some features may be limited. Location permission is only requested for location-based punch verification. Push notification preferences may be controlled inside the app or through the browser/device settings.</p>

          <h4 className="font-black text-[#D4A381] text-sm mt-4">8. Contact Us</h4>
          <p>If you have questions about this Privacy Policy or need help with a privacy request, contact:</p>
          <p className="text-white font-bold mt-1">Email: support@86chaos.com<br/>Company: Chilton App Works, LLC</p>        </div>
      </Modal>
    </div>
  );
};

export { LoginScreen };
