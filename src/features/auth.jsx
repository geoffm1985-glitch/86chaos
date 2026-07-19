import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Camera, ChevronLeft, ChevronRight, MessageSquare, Plus, Trash2, Users, Calendar, Clock, X, Loader2, Package, ClipboardList, Menu, Settings, LogOut, Shield, Send, Repeat, Edit, Moon, Sun, TrendingUp, BookOpen, Search, ChefHat, Scale, Coffee, Star, Bug, Wrench, Globe } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, getDoc, setDoc, getDocs } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail, createUserWithEmailAndPassword, updatePassword, getMultiFactorResolver, PhoneAuthProvider, PhoneMultiFactorGenerator, RecaptchaVerifier } from 'firebase/auth';
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

  // MFA sign-in state. Enrollment lives under Settings → Profile → Account Security.
  const [mfaResolver, setMfaResolver] = useState(null);
  const [mfaHintIndex, setMfaHintIndex] = useState(0);
  const [mfaVerificationId, setMfaVerificationId] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaRecoveryCode, setMfaRecoveryCode] = useState('');
  const [mfaRecoveryBusy, setMfaRecoveryBusy] = useState(false);
  const [mfaSending, setMfaSending] = useState(false);
  const [mfaVerifying, setMfaVerifying] = useState(false);
  const mfaRecaptchaRef = useRef(null);


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
        planId: rest.subscription?.planId || rest.planId || raw.planId || baseUser.planId || 'smart_kitchen',
        subscriptionStatus: rest.subscription?.status || rest.subscriptionStatus || 'beta',
        membershipId: raw.membershipId || raw.id || membershipDocId(uid, restaurantId),
        permissions: { ...(baseUser.restaurantId === restaurantId ? (baseUser.permissions || {}) : {}), ...(raw.permissions || {}) },
        isAdmin: raw.isAdmin === true || (baseUser.restaurantId === restaurantId && baseUser.isAdmin === true),
        isOwner: raw.isOwner === true || raw.accountOwner === true || raw.workspaceOwner === true || (baseUser.restaurantId === restaurantId && (baseUser.isOwner === true || baseUser.accountOwner === true || baseUser.workspaceOwner === true))
      });
    };

    try {
      const apiRes = await secureFetch('/api/workspace-memberships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailKey, userId: uid })
      });
      const apiData = await apiRes.json().catch(() => ({}));
      if (apiRes.ok && Array.isArray(apiData.workspaces)) {
        for (const workspace of apiData.workspaces) await addOption({ ...workspace, membershipSource: workspace.membershipSource || 'workspace-memberships-api' });
      } else if (!apiRes.ok) {
        console.warn('Workspace membership API failed:', apiData?.error || apiRes.statusText);
      }
    } catch (err) {
      console.warn('Workspace membership API unavailable, falling back to browser queries:', err?.message || err);
    }

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
    try { sessionStorage.setItem(`chaosWorkspacePickerSeen_${workspaceUser.id}`, 'true'); } catch (_) {}
    updateDoc(doc(db, 'users', workspaceUser.id), {
      activeRestaurantId: workspace.restaurantId,
      lastWorkspaceId: workspace.restaurantId,
      lastWorkspaceSwitchedAt: new Date().toISOString()
    }).catch(() => {});
    setAppUser({ ...buildActiveUserForWorkspace(workspaceUser, workspace), availableWorkspaces: workspaceChoices });
    setWorkspaceChoices([]);
    setWorkspaceUser(null);
  };

  const clearMfaChallenge = () => {
    setMfaResolver(null);
    setMfaHintIndex(0);
    setMfaVerificationId('');
    setMfaCode('');
    setMfaRecoveryCode('');
  };

  const getMfaRecaptcha = () => {
    if (mfaRecaptchaRef.current) return mfaRecaptchaRef.current;
    mfaRecaptchaRef.current = new RecaptchaVerifier(auth, 'mfa-login-recaptcha-container', { size: 'invisible' });
    return mfaRecaptchaRef.current;
  };

  const syncAccountSecurity = async () => {
    try {
      await secureFetch('/api/account-security', { method: 'POST' });
    } catch (err) {
      console.warn('Account security sync failed:', err?.message || err);
    }
  };

  const completeFirebaseLogin = async (userCredential) => {
    const firebaseUser = userCredential.user;
    await syncAccountSecurity();
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      const userData = { id: firebaseUser.uid, ...userDocSnap.data() };
      delete userData.password;
      if (userData.forcePasswordChange) {
        setPendingUser(userData);
      } else {
        await finishLoginWithWorkspace(userData, firebaseUser, { forcePicker: true });
      }
    } else {
      setLoginError('Login successful, but user profile is missing in the database.');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setWorkspaceChoices([]);
    setWorkspaceUser(null);
    clearMfaChallenge();
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await completeFirebaseLogin(userCredential);
    } catch (error) {
      if (error?.code === 'auth/multi-factor-auth-required') {
        try {
          const resolver = getMultiFactorResolver(auth, error);
          setMfaResolver(resolver);
          setLoginError('This account requires two-step login. Send a code to continue.');
          return;
        } catch (resolverErr) {
          setLoginError(resolverErr.message || 'Two-step login could not be prepared.');
          return;
        }
      }
      setLoginError(error.message);
    }
  };

  const handleSendMfaSignInCode = async () => {
    if (!mfaResolver) return;
    setLoginError('');
    setMfaSending(true);
    try {
      const hint = mfaResolver.hints?.[Number(mfaHintIndex) || 0];
      if (!hint) throw new Error('No MFA phone factor was found for this account.');
      const provider = new PhoneAuthProvider(auth);
      const verificationId = await provider.verifyPhoneNumber({ multiFactorHint: hint, session: mfaResolver.session }, getMfaRecaptcha());
      setMfaVerificationId(verificationId);
      setLoginError('Code sent. Enter the verification code to unlock 86 Chaos.');
    } catch (err) {
      setLoginError(err.message || 'Could not send MFA code.');
    } finally {
      setMfaSending(false);
    }
  };

  const handleVerifyMfaSignInCode = async (e) => {
    e?.preventDefault?.();
    if (!mfaResolver || !mfaVerificationId || !mfaCode.trim()) return setLoginError('Send and enter the two-step login code first.');
    setLoginError('');
    setMfaVerifying(true);
    try {
      const credential = PhoneAuthProvider.credential(mfaVerificationId, mfaCode.trim());
      const assertion = PhoneMultiFactorGenerator.assertion(credential);
      const userCredential = await mfaResolver.resolveSignIn(assertion);
      clearMfaChallenge();
      await completeFirebaseLogin(userCredential);
    } catch (err) {
      setLoginError(err.message || 'Two-step login code was not accepted.');
    } finally {
      setMfaVerifying(false);
    }
  };

  const handleUseMfaRecoveryCode = async () => {
    if (!email || !mfaRecoveryCode.trim()) return setLoginError('Enter the account email and one recovery code.');
    setLoginError('');
    setMfaRecoveryBusy(true);
    try {
      const response = await fetch('/api/mfa-recovery-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: mfaRecoveryCode.trim() })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Recovery code was not accepted.');
      clearMfaChallenge();
      setPassword('');
      setLoginError(data.message || 'Recovery code accepted. Sign in again, then re-enroll MFA from Account Security.');
    } catch (err) {
      setLoginError(err.message || 'Recovery code could not be used.');
    } finally {
      setMfaRecoveryBusy(false);
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
      className="chaos-login-screen min-h-screen flex flex-col items-center justify-center bg-[#0B0E11] bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: `url('/6136.jpg')` }}
    >
      <div className="absolute inset-0 bg-[#0B0E11]/75 backdrop-blur-[3px]"></div>
      
      <div className="chaos-login-card relative z-10 w-full max-w-sm p-8 bg-[#161D22]/95 border border-[#2A353D] rounded-3xl shadow-2xl flex flex-col items-center animate-[slideIn_0.3s_ease-out]">
        
        <img src="/6139.png" alt="86 Chaos OS Logo" className="chaos-login-logo h-24 w-auto rounded-xl shadow-lg border border-[#2A353D] mb-8 object-contain bg-[#12161A] p-2" />
        
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
        ) : mfaResolver ? (
          <form onSubmit={handleVerifyMfaSignInCode} className="w-full space-y-4 animate-[slideIn_0.2s_ease-out]">
            <div className="text-center mb-4">
              <h2 className="text-xl font-black text-white leading-tight">Two-Step Login</h2>
              <p className="text-xs text-[#D4A381] font-bold mt-1 uppercase tracking-widest">Elevated account security</p>
              <p className="text-[10px] text-slate-400 font-bold mt-2 leading-snug">Send a code to your enrolled phone, then enter it here.</p>
            </div>
            {loginError && <div className="p-3 bg-red-900/50 border border-red-500/50 rounded-xl text-red-200 text-xs font-bold text-center">{loginError}</div>}
            {Array.isArray(mfaResolver.hints) && mfaResolver.hints.length > 1 && (
              <select value={mfaHintIndex} onChange={e => setMfaHintIndex(e.target.value)} className="w-full text-center text-sm font-bold bg-[#0B0E11] border border-[#2A353D] rounded-xl py-3 text-white focus:outline-none focus:border-[#D4A381]">
                {mfaResolver.hints.map((hint, idx) => <option key={hint.uid || idx} value={idx}>{hint.displayName || hint.phoneNumber || `Phone factor ${idx + 1}`}</option>)}
              </select>
            )}
            <button type="button" onClick={handleSendMfaSignInCode} disabled={mfaSending} className="w-full bg-[#12161A] border border-[#2A353D] text-[#D4A381] font-black tracking-widest uppercase text-xs py-3 rounded-xl hover:border-[#D4A381] disabled:opacity-50 transition-all">
              {mfaSending ? 'Sending Code…' : mfaVerificationId ? 'Resend Code' : 'Send Code'}
            </button>
            <input type="text" inputMode="numeric" placeholder="Verification Code" value={mfaCode} onChange={e => setMfaCode(e.target.value)} className="w-full text-center text-lg font-bold bg-[#0B0E11] border border-[#2A353D] rounded-xl py-4 text-white focus:outline-none focus:border-[#D4A381] transition-colors shadow-inner" />
            <button type="submit" disabled={mfaVerifying || !mfaVerificationId} className="w-full bg-gradient-to-r from-[#D4A381] to-[#b58563] text-slate-900 font-black tracking-widest uppercase text-lg py-4 rounded-xl shadow-[0_0_20px_rgba(212,163,129,0.2)] hover:scale-[1.02] transition-all mt-2 disabled:opacity-50 disabled:hover:scale-100">
              {mfaVerifying ? 'Verifying…' : 'Verify & Enter'}
            </button>
            <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3 space-y-2">
              <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Lost your phone?</div>
              <p className="text-[10px] text-slate-400 font-bold leading-snug">Use one saved recovery code to reset two-step login, then sign in again and enroll a new phone.</p>
              <input type="text" placeholder="Recovery code" value={mfaRecoveryCode} onChange={e => setMfaRecoveryCode(e.target.value)} className="w-full text-center text-sm font-bold bg-[#12161A] border border-[#2A353D] rounded-xl py-3 text-white focus:outline-none focus:border-[#D4A381] transition-colors" />
              <button type="button" onClick={handleUseMfaRecoveryCode} disabled={mfaRecoveryBusy || !mfaRecoveryCode.trim()} className="w-full bg-red-900/20 border border-red-900/50 text-red-200 font-black tracking-widest uppercase text-[10px] py-3 rounded-xl hover:bg-red-900/40 disabled:opacity-50 transition-all">{mfaRecoveryBusy ? 'Checking Recovery Code…' : 'Use Recovery Code'}</button>
            </div>
            <button type="button" onClick={clearMfaChallenge} className="w-full text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-[#D4A381] transition-colors">Back to login</button>
          </form>
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
        <div id="mfa-login-recaptcha-container" className="hidden"></div>
      </div>

      <Modal isOpen={isPrivacyModalOpen} onClose={() => setIsPrivacyModalOpen(false)} title="Privacy Policy">
        <div className="space-y-4 text-xs font-medium text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
          <div className="text-center border-b border-[#2A353D] pb-3 mb-3">
            <h3 className="font-black text-white text-lg uppercase tracking-widest">Privacy Policy for 86chaos</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Last Updated: July 12, 2026</p>
          </div>
          <p>Chilton App Works, LLC ("86 Chaos," "we," "us," or "our") operates the 86 Chaos restaurant operations web app, progressive web app, application programming interfaces, and related services (the "Service"). This policy explains what information the Service processes, why it is used, how long it is kept, and how privacy requests are handled.</p>
          <p>86 Chaos is a business-to-business workplace tool. The restaurant or other organization that creates a workspace generally decides what employee and operational information is entered and how the Service is used. In that setting, the restaurant is normally the business or data controller and 86 Chaos acts as its service provider or data processor. This policy does not replace an employer's own employee privacy notice, payroll obligations, recordkeeping duties, or consent requirements.</p>

          <h4 className="font-black text-[#D4A381] text-sm mt-4">1. Information We Process</h4>
          <p>Depending on the features your restaurant enables, the Service may process:</p>
          <ul className="list-disc pl-5 space-y-1 mt-1 text-slate-400">
            <li><strong className="text-white">Account and Staff Information:</strong> name, email or login label, phone number, profile photo, job role, permissions, workspace identifiers, account status, and security settings.</li>
            <li><strong className="text-white">Scheduling, Payroll-Support, and Labor Information:</strong> shifts, time punches, time-off and trade requests, wage labels entered by management, tips, approvals, punch corrections, and manager notes. 86 Chaos is not the employer or payroll processor of record unless a separate written agreement says otherwise.</li>
            <li><strong className="text-white">Location Information:</strong> precise GPS coordinates may be requested when a restaurant enables location-based punch verification. The location is compared with the restaurant's configured work area. 86 Chaos does not intentionally run continuous background location tracking.</li>
            <li><strong className="text-white">Restaurant Operations Content:</strong> prep lists, 86 alerts, inventory, recipes, invoices, vendor details, menu data, maintenance records, sales or ledger entries, messages, reminders, attachments, and administrative records.</li>
            <li><strong className="text-white">Camera, Files, and Photos:</strong> files submitted for menu or invoice scanning, profile photos, message attachments, maintenance photos, logos, and similar workflows.</li>
            <li><strong className="text-white">Device, Security, and Diagnostic Data:</strong> browser or device type, screen size, active app section, notification status, push-token status, service-worker and IndexedDB support, audit events, error reports, MFA status, App Check results, and recent app actions associated with troubleshooting.</li>
            <li><strong className="text-white">Plan, Subscription, and Billing-Support Data:</strong> workspace plan, Founder Beta status and dates, selected future tier, discount status, manual billing notes, scan-limit usage, integration lock status, and plan-change audit records. Live payment processing is not active unless a separate billing provider is enabled later.</li>
          </ul>

          <h4 className="font-black text-[#D4A381] text-sm mt-4">2. How We Use Information</h4>
          <ul className="list-disc pl-5 space-y-1 mt-1 text-slate-400">
            <li>Provide scheduling, time clock, staff, inventory, prep, menu, maintenance, messaging, reminders, financial/labor, backup, plan access, scan-limit, and support functions.</li>
            <li>Verify location-based punches when enabled and flag exceptions for authorized managers.</li>
            <li>Deliver schedule, message, reminder, security, and operational notifications.</li>
            <li>Secure accounts, enforce permissions, investigate abuse, diagnose failures, maintain audit trails, and restore data.</li>
            <li>Comply with law, enforce agreements, protect users and the Service, and establish or defend legal claims.</li>
          </ul>

          <h4 className="font-black text-[#D4A381] text-sm mt-4">3. AI-Assisted Features</h4>
          <p>Menu and invoice scans may be sent to an AI provider for extraction or classification. The Gemini Administrator Manual may receive a Super Admin's question, matched help articles, and redacted system context. OpenAI diagnostics may receive redacted health information for structured repair guidance. The Service is designed to remove credentials, tokens, signed URLs, and similar secrets before diagnostics are sent, but administrators must not intentionally paste private keys, passwords, full employee files, or other unnecessary personal information into AI prompts.</p>
          <p>AI output may be incomplete or incorrect and must be reviewed by an authorized person. 86 Chaos does not use AI output by itself to make hiring, firing, discipline, wage, scheduling, or other legally significant employment decisions.</p>

          <h4 className="font-black text-[#D4A381] text-sm mt-4">4. Sharing and Service Providers</h4>
          <p>We do not sell personal information, and we do not share personal information for cross-context behavioral advertising. Information may be disclosed only as reasonably necessary to operate the Service, follow workspace instructions, comply with law, complete a business transaction, or protect rights and safety.</p>
          <ul className="list-disc pl-5 space-y-1 mt-1 text-slate-400">
            <li><strong className="text-white">Google Cloud and Firebase:</strong> authentication, database, Cloud Storage, push notifications, App Check, scheduled functions, logs, and related infrastructure.</li>
            <li><strong className="text-white">Vercel:</strong> web hosting, deployments, and serverless API routes.</li>
            <li><strong className="text-white">AI providers:</strong> limited content required for an enabled scan, administrator-manual, or diagnostics workflow.</li>
            <li><strong className="text-white">Customer-selected integrations:</strong> payroll, accounting, POS, notification, or other providers if those integrations are enabled in the future and connected by the restaurant. Current customer integration setup is locked while rollout testing continues.</li>
            <li><strong className="text-white">Legal and safety disclosures:</strong> government authorities, courts, advisers, insurers, or affected parties when reasonably necessary and legally permitted.</li>
          </ul>

          <h4 className="font-black text-[#D4A381] text-sm mt-4">5. Restaurant and Employer Responsibilities</h4>
          <p>Restaurants control most workspace records and determine who may access them. Restaurants are responsible for giving legally required employee notices, obtaining any required consent for location or monitoring features, configuring permissions, reviewing AI output, responding to employment-record requests, and selecting retention periods that satisfy their own legal obligations. Employees should normally contact their restaurant first to access or correct workplace records.</p>

          <h4 className="font-black text-[#D4A381] text-sm mt-4">6. Data Retention and Deletion</h4>
          <ul className="list-disc pl-5 space-y-1 mt-1 text-slate-400">
            <li><strong className="text-white">Prep lists and 86 alerts:</strong> scheduled for permanent deletion after 30 days.</li>
            <li><strong className="text-white">Raw AI upload files:</strong> menu and invoice image files under the AI-upload storage paths are scheduled for deletion after 30 days. Parsed or manager-approved business records may remain separately in Firestore.</li>
            <li><strong className="text-white">Time punches and location logs:</strong> removed from active Firestore after 365 days, written to a restricted archive, and retained until the three-year mark measured from the record date.</li>
            <li><strong className="text-white">Database backups:</strong> kept on a 30-day rolling basis.</li>
            <li><strong className="text-white">Audit and security logs:</strong> retained for 1 year unless a legal hold, security investigation, dispute, or required recordkeeping obligation applies.</li>
            <li><strong className="text-white">Deleted workspaces:</strong> disabled when marked deleted and permanently removed after a 30-day recovery period unless restored.</li>
            <li><strong className="text-white">Plan, billing-support, and subscription records:</strong> kept as needed for account administration, Founder Beta discounts, audit logs, fraud prevention, support, disputes, tax/accounting needs if billing later activates, and legal obligations.</li>
            <li><strong className="text-white">Other records:</strong> kept only as long as reasonably needed for the Service, customer instructions, security, billing, dispute resolution, backups, fraud prevention, or legal obligations.</li>
          </ul>
          <p>Scheduled deletion normally occurs during the next cleanup run and may take up to approximately 24 hours after a stated deadline. Provider-level backups, disaster-recovery copies, or soft-deleted objects may remain inaccessible for a limited additional period before automatic expiration. Legal holds, active investigations, disputes, and mandatory recordkeeping obligations may pause deletion. When a hold ends, the applicable retention schedule resumes.</p>

          <h4 className="font-black text-[#D4A381] text-sm mt-4">7. Privacy Rights and Requests</h4>
          <p>Depending on where you live, you may have the right to request access, correction, deletion, restriction, objection, or a portable copy of personal information. You may also have the right to appeal a denied request. Because workplace information is usually controlled by the restaurant, we may forward a request to the appropriate workspace administrator. We may verify identity and authority before acting, and an authorized agent may be required to provide proof of authority.</p>
          <p>Some information cannot be deleted immediately when retention is required for payroll, tax, safety, fraud prevention, legal claims, or another lawful purpose. We will not discriminate against a person for making a legally protected privacy request.</p>

          <h4 className="font-black text-[#D4A381] text-sm mt-4">8. Location, Notifications, and Device Permissions</h4>
          <p>Browser permissions for location, camera, files, and notifications can be denied or revoked through device settings, but related features may stop working. Location is requested only for enabled punch-verification workflows. Push-notification tokens identify an app installation for delivery and are not used for advertising.</p>

          <h4 className="font-black text-[#D4A381] text-sm mt-4">9. Security and Incident Response</h4>
          <p>We use authentication, role-based access, server-side authorization, Firebase security rules, optional MFA, App Check, audit logs, encryption provided by hosting vendors, diagnostics redaction, backups, and administrative controls. No security system is guaranteed. Restaurants must use strong credentials, limit elevated access, remove former workers promptly, and report suspected unauthorized access. We will investigate confirmed security incidents and provide notices when required by applicable law.</p>

          <h4 className="font-black text-[#D4A381] text-sm mt-4">10. United States Processing and Business Transfers</h4>
          <p>86 Chaos is operated from the United States, and information may be processed in the United States or other locations where our service providers operate. If ownership of the Service changes through a merger, financing, reorganization, or sale, information may transfer as part of that transaction subject to applicable law and continued protection under an applicable privacy notice.</p>

          <h4 className="font-black text-[#D4A381] text-sm mt-4">11. Children</h4>
          <p>The Service is not directed to children under 13, and we do not knowingly collect personal information directly from children under 13. Restaurants must not create accounts for anyone who is not legally authorized to use their workplace systems. Contact us if you believe a child's information was submitted improperly.</p>

          <h4 className="font-black text-[#D4A381] text-sm mt-4">12. Policy Changes</h4>
          <p>We may update this policy as the Service, providers, or legal requirements change. The updated date will be shown above. Material changes may also be announced in the app or through the workspace administrator. Continued use after the effective date is subject to the updated policy, except where additional notice or consent is legally required.</p>

          <h4 className="font-black text-[#D4A381] text-sm mt-4">13. Contact and Privacy Requests</h4>
          <p>Questions, privacy requests, suspected security incidents, and requests to appeal a privacy decision may be sent to:</p>
          <p className="text-white font-bold mt-1">Email: support@86chaos.com<br/>Company: Chilton App Works, LLC<br/>Product: 86 Chaos</p>        </div>
      </Modal>
    </div>
  );
};

export { LoginScreen };
