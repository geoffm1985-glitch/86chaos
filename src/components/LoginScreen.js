import React, { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail, updatePassword } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

const LoginScreen = ({ setAppUser, auth, db }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // State to hold the user temporarily if they need to change their password
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
      
      // 2. Flip the database flag so they are never asked again, and track the new text password
      await updateDoc(doc(db, "users", pendingUser.id), { 
        forcePasswordChange: false,
        password: newPass 
      });
      
      // 3. Unlock the system
      setAppUser({ ...pendingUser, forcePasswordChange: false, password: newPass });
      
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
      await sendPasswordResetEmail(auth, email);
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
            
            <button type="submit" className="w-full bg-gradient-to-r from-[#D4A381] to-[#b58563] text-slate-900 font-black tracking-widest uppercase text-lg py-4 rounded-xl shadow-[0_0_20px_rgba(212,163,129,0.2)] hover:scale-[1.02] transition-all mt-2">
              Unlock System
            </button>

            <div className="pt-3 text-center">
              <button type="button" onClick={handleForgotCredentials} className="text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-[#D4A381] transition-colors">
                Forgot Password or Username?
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};

export default LoginScreen;
