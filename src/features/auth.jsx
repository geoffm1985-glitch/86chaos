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

const LoginScreen = ({ setAppUser }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  
  // New state to hold the user temporarily if they need to change their password
  const [pendingUser, setPendingUser] = useState(null);
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (userDocSnap.exists()) {
        const userData = { id: firebaseUser.uid, ...userDocSnap.data() };
        
        // INTERCEPT: If the flag is true, hold them in the pending state
        if (userData.forcePasswordChange) {
          setPendingUser(userData);
        } else {
          localStorage.setItem('chaosRememberMe', rememberMe);
          setAppUser(userData); // Let them into the OS
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
      localStorage.setItem('chaosRememberMe', rememberMe);
      const { password, ...safePendingUser } = pendingUser;
      setAppUser({ ...safePendingUser, forcePasswordChange: false });
      
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
        
        {/* IF THEY NEED TO CHANGE PASSWORD, RENDER THIS FORM */}
        {pendingUser ? (
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
            
            <button type="submit" className="w-full bg-gradient-to-r from-[#D4A381] to-[#b58563] text-slate-900 font-black tracking-widest uppercase text-lg py-4 rounded-xl shadow-[0_0_20px_rgba(212,163,129,0.2)] hover:scale-[1.02] transition-all mt-4">
              Unlock System
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
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Last Updated: July 2, 2026</p>
          </div>
          <p>Chilton App Works, LLC ("we," "us," or "our") operates the 86chaos restaurant operating system (the "Service"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and website.</p>
          
          <h4 className="font-black text-[#D4A381] text-sm mt-4">1. Information We Collect</h4>
          <p>We collect information that identifies, relates to, describes, or could reasonably be linked to you or your restaurant, including:</p>
          <ul className="list-disc pl-5 space-y-1 mt-1 text-slate-400">
            <li><strong className="text-white">Personal & Account Information:</strong> Names, email addresses, phone numbers, and profile photos.</li>
            <li><strong className="text-white">Employment & Financial Data:</strong> Job titles, hourly wages, time punches, shift schedules, tips declared, and custom permissions.</li>
            <li><strong className="text-white">Location Data (GPS):</strong> We collect precise location data exclusively when you attempt to clock in or out. This data is used solely to verify your presence within your employer's designated GPS geofence boundary. We do not track your location in the background.</li>
            <li><strong className="text-white">Device & Telemetry Data:</strong> To improve system stability, we collect device information (Operating System, screen size, user agent), IP addresses (for security whitelisting), and usage telemetry (such as recent buttons clicked) attached to crash reports.</li>
            <li><strong className="text-white">Images & Camera Data:</strong> We access your device camera and photo library, with your explicit permission, for scanning vendor invoices and attaching photos to the Message Board or Events ledger.</li>
          </ul>

          <h4 className="font-black text-[#D4A381] text-sm mt-4">2. How We Use Your Information</h4>
          <p>We use the collected information to:</p>
          <ul className="list-disc pl-5 space-y-1 mt-1 text-slate-400">
            <li>Facilitate core operational features, including time tracking, scheduling, and inventory management.</li>
            <li>Process vendor invoices through our AI integration to extract line items and update stock. (Note: AI processing is used strictly for document parsing, not for biometric or facial recognition).</li>
            <li>Send push notifications regarding shift changes, trade board requests, and critical manager alerts.</li>
            <li>Monitor system health, troubleshoot crashes, and prevent fraudulent activity.</li>
          </ul>

          <h4 className="font-black text-[#D4A381] text-sm mt-4">3. Third-Party Data Sharing</h4>
          <p>We do not sell your personal data. We share data only with essential third-party service providers who assist in operating the Service:</p>
          <ul className="list-disc pl-5 space-y-1 mt-1 text-slate-400">
            <li><strong className="text-white">Cloud Hosting & Database:</strong> Google Cloud/Firebase (for secure data storage and authentication).</li>
            <li><strong className="text-white">Serverless Infrastructure:</strong> Vercel (for routing and processing data).</li>
            <li><strong className="text-white">AI Processing:</strong> Third-party AI APIs are used specifically to parse and read uploaded invoice images.</li>
            <li><strong className="text-white">External Integrations:</strong> If your employer connects 86chaos to third-party Point of Sale (POS) or Payroll providers, data is transmitted to those entities according to your employer's configuration.</li>
          </ul>

          <h4 className="font-black text-[#D4A381] text-sm mt-4">4. Employer Control (B2B Clause)</h4>
          <p>86chaos is a B2B service provided to your employer. Your employer acts as the primary Data Controller. If you are an employee seeking to access, modify, or permanently delete your personal data (such as time punches or account records), you must direct those requests to your restaurant management team.</p>

          <h4 className="font-black text-[#D4A381] text-sm mt-4">5. Data Security & Retention</h4>
          <p>We use industry-standard security measures, including encryption and secure server environments, to protect your data. Data is retained for as long as your employer maintains an active workspace. If an employer deletes a user or a workspace, the associated data is permanently purged from our active databases.</p>

          <h4 className="font-black text-[#D4A381] text-sm mt-4">6. Contact Us</h4>
          <p>If you have questions about this Privacy Policy, please contact us at:</p>
          <p className="text-white font-bold mt-1">Email: support@86chaos.com<br/>Company: Chilton App Works, LLC</p>
        </div>
      </Modal>
    </div>
  );
};

export { LoginScreen };
