import { useState, useEffect } from 'react';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { db, auth } from '../services/firebase.js';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ShieldCheck, Sparkles, Building2 } from 'lucide-react';

export default function Login({ onLogin }) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Clear any cached session on mount
  useEffect(() => {
    signOut(auth).catch((error) => {
      console.error('Error clearing previous session:', error);
    });
  }, []);

  const handleGoogleLogin = async () => {
    if (loading) return;
    setLoading(true);
    setErrorMessage('');
    
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ 
        prompt: 'select_account',
        login_hint: 'qsystemssu123@gmail.com'
      });

      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Strictly check the email; reject anyone who isn't the specific admin
      if (!user || user.email !== 'qsystemssu123@gmail.com') {
        await signOut(auth);
        setErrorMessage("You're not authorized to login. Only the system administrator can access this portal.");
        setLoading(false);
        return;
      }

      // Save to the 'admin' collection
      await setDoc(doc(db, 'admin', user.uid), {
        userId: user.uid,
        userName: user.displayName || 'Admin User',
        userEmail: user.email || '',
        userPhoto: user.photoURL || null,
        lastLogin: serverTimestamp()
      }, { merge: true });

      if (onLogin) {
        onLogin(user);
      }
    } catch (error) {
      console.error('Google Sign-In Error:', error);
      try {
        await signOut(auth);
      } catch (signOutErr) {
        console.error('Sign out error:', signOutErr);
      }
      setErrorMessage("You're not authorized to login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 px-4 relative overflow-hidden font-sans">
      {/* Background Decorative Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md bg-white/95 backdrop-blur-xl p-8 sm:p-10 rounded-3xl shadow-2xl border border-white/20 space-y-8 text-center relative z-10 transition-all">
        
        {/* Branding Logo & University Tag */}
        <div className="space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-700 text-white shadow-lg shadow-purple-700/30 mb-1">
            <Building2 className="w-8 h-8" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5" /> Samar State University
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">QueueMatrix</h1>
            <p className="text-sm font-medium text-slate-500 mt-1">Administrator Control Center</p>
          </div>
        </div>

        {errorMessage && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-semibold leading-relaxed text-left flex items-start gap-3 shadow-xs">
            <ShieldCheck className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action Form */}
        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-700 font-bold py-3.5 px-4 rounded-2xl border border-slate-300 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 group cursor-pointer"
          >
            <svg className="w-5 h-5 group-hover:scale-105 transition-transform" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span className="text-sm font-semibold">{loading ? 'Authenticating...' : 'Continue with Google'}</span>
          </button>
        </div>

        {/* Footer info */}
        <div className="pt-2 border-t border-slate-100">
          <p className="text-[11px] font-medium text-slate-400">
            Authorized Personnel Only • Samar State University SSU
          </p>
        </div>
      </div>
    </div>
  );
}