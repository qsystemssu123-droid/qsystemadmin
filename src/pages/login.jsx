  import { useState } from 'react';
  import {
    signInWithPopup,
    GoogleAuthProvider,
    signInWithEmailAndPassword,
    signOut
  } from 'firebase/auth';
  import { db, auth } from '../services/firebase.js';
  import {
    doc,
    setDoc,
    getDoc,
    serverTimestamp
  } from 'firebase/firestore';
  import {
    ShieldCheck,
    Building2,
    Mail,
    Lock,
    Eye,
    EyeOff,
    Loader2
  } from 'lucide-react';
  import QueueMatrixLogo from '../assets/QueueMatrix.png';

  export default function Login({ onLogin }) {
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    // Staff login states
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [office, setOffice] = useState('');
    const [showPassword, setShowPassword] = useState(false);

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

          setErrorMessage(
            "You're not authorized to login. Only the system administrator can access this portal."
          );

          setLoading(false);
          return;
        }

        // Save to the 'admin' collection
        await setDoc(
          doc(db, 'admin', user.uid),
          {
            userId: user.uid,
            userName: user.displayName || 'Admin User',
            userEmail: user.email || '',
            userPhoto: user.photoURL || null,
            lastLogin: serverTimestamp()
          },
          { merge: true }
        );

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

    const handleStaffEmailLogin = async (e) => {
      e.preventDefault();

      if (loading) return;

      // Check if an office is actually chosen
      if (!office) {
        setErrorMessage('Please select an office before signing in.');
        return;
      }

      setLoading(true);
      setErrorMessage('');

      try {
        const userCredential = await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );

        const user = userCredential.user;

        // Verify if staff record exists in Firestore and matches selected office
        const staffDocRef = doc(db, 'staff', user.uid);
        let staffData = null;

        try {
          const staffDoc = await getDoc(staffDocRef);

          if (staffDoc.exists()) {
            staffData = staffDoc.data();
          }
        } catch (firestoreErr) {
          console.warn(
            'Firestore rule restriction encountered during staff lookup, proceeding with authenticated session:',
            firestoreErr
          );
        }

        // If Firestore data was successfully retrieved, validate office
        if (
          staffData &&
          staffData.office &&
          staffData.office !== office
        ) {
          await signOut(auth);

          setErrorMessage(
            `Selected office (${office}) does not match your assigned office (${staffData.office}).`
          );

          setLoading(false);
          return;
        }

        // Update last login or metadata if permitted
        try {
          await setDoc(
            staffDocRef,
            {
              lastLogin: serverTimestamp(),
              email: user.email,
              office: staffData?.office || office
            },
            { merge: true }
          );
        } catch (updateErr) {
          console.warn(
            'Could not update lastLogin timestamp due to permissions:',
            updateErr
          );
        }

        if (onLogin) {
          onLogin({
            ...user,
            office: staffData?.office || office,
            role: 'staff'
          });
        }
      } catch (error) {
        console.error(
          'Staff Login Error Code & Message:',
          error.code,
          error.message
        );

        try {
          await signOut(auth);
        } catch (signOutErr) {
          console.error('Sign out error:', signOutErr);
        }

        if (
          error.code === 'auth/invalid-credential' ||
          error.code === 'auth/user-not-found' ||
          error.code === 'auth/wrong-password'
        ) {
          setErrorMessage('Incorrect staff email or password.');
        } else {
          setErrorMessage(
            error.message ||
            'Invalid email, password, or office selection.'
          );
        }
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="flex min-h-screen w-screen items-center justify-center bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 px-4 py-8 relative overflow-hidden font-sans box-border">

        {/* Background Decorative Glows */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="w-full max-w-md bg-white/95 backdrop-blur-xl p-8 sm:p-10 rounded-3xl shadow-2xl border border-white/25 space-y-6 text-center relative z-10 transition-all box-border">

          {/* Branding Logo & University Tag */}
          <div className="space-y-3">
            <div className="inline-flex items-center justify-center w-25 h-25 rounded-2xl bg-blue-300 text-white shadow-lg shadow-blue-600/30 mb-1 overflow-hidden">
              <img 
                src={QueueMatrixLogo} 
                alt="Queue Matrix" 
                className="w-23 h-23 rounded-2xl object-contain" 
              />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2">
                
                Samar State University
              </div>

              <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                QueueMatrix
              </h1>

              <p className="text-sm font-medium text-slate-500 mt-1">
                Portal Authentication Center
              </p>
            </div>
          </div>

          {errorMessage && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-semibold leading-relaxed text-left flex items-start gap-3 shadow-xs">
              <ShieldCheck className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Staff Email & Password Login Form */}
          <form onSubmit={handleStaffEmailLogin} className="space-y-4 text-left">

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Staff Email
              </label>

              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </span>

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@ssu.edu.ph"
                  required
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Password
              </label>

              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>

                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeOff className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Office Assignment
              </label>

              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Building2 className="w-4 h-4" />
                </span>

                <select
                  value={office}
                  onChange={(e) => setOffice(e.target.value)}
                  required
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all cursor-pointer"
                >
                  <option value="" disabled>
                    Choose an office
                  </option>
                  <option value="CLINIC">CLINIC</option>
                  <option value="OSAS">OSAS</option>
                  <option value="SWDS">SWDS</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <span>Staff Sign In</span>
              )}
            </button>
          </form>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-200"></div>

            <span className="flex-shrink mx-4 text-slate-400 text-xs font-medium uppercase">
              Or Admin Access
            </span>

            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          {/* Action Form */}
          <div className="space-y-4">
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-700 font-bold py-3.5 px-4 rounded-2xl border border-slate-300 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 group cursor-pointer"
            >
              <svg
                className="w-5 h-5 group-hover:scale-105 transition-transform"
                viewBox="0 0 24 24"
              >
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

              <span className="text-sm font-semibold">
                {loading && !email
                  ? 'Authenticating...'
                  : 'Continue with Google (Admin)'}
              </span>
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