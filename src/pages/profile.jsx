import { useState } from 'react';
import { auth } from '../services/firebase.js';
import { 
  ShieldCheck, 
  Mail,  
  KeyRound, 
  Lock, 
  Clock, 
  CheckCircle2, 
  BadgeCheck 
} from 'lucide-react';

export default function AdminProfile() {
  const [adminUser] = useState(() => auth.currentUser);

  const adminEmail = adminUser?.email || 'qsystemssu123@gmail.com';
  const adminName = adminUser?.displayName || 'Koby R. Sacendoncillo';
  const adminPhoto = adminUser?.photoURL;
  const adminUid = adminUser?.uid || 'Protected System UID';
  const creationTime = adminUser?.metadata?.creationTime ? new Date(adminUser.metadata.creationTime).toLocaleDateString() : 'Active Session';

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-2 sm:px-0" style={{ animation: 'fadeIn 0.5s ease-in-out' }}>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

      {/* Page Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Administrator Profile & Security</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">Manage system credentials, access control permissions, and administrative security state.</p>
      </div>

      {/* Main Profile Card */}
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xs border border-slate-200 overflow-hidden">
        {/* Banner header */}
        <div className="h-32 sm:h-32 bg-gradient-to-r from-purple-700 via-indigo-700 to-slate-900 px-4 sm:px-8 flex flex-col sm:flex-row justify-between sm:justify-end items-start sm:items-end py-3 sm:pb-4 gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-semibold bg-white/20 text-white backdrop-blur-md z-10">
            <BadgeCheck className="w-3.5 h-3.5" /> Super Administrator
          </span>
        </div>

        {/* Profile Content */}
        <div className="px-4 sm:px-8 pb-6 sm:pb-8 pt-0 relative">
          {/* Avatar & Header Info */}
          <div className="-mt-12 sm:-mt-12 mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-3 sm:gap-5 text-center sm:text-left w-full sm:w-auto">
              {adminPhoto ? (
                <img 
                  src={adminPhoto} 
                  alt="Admin Avatar" 
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-4 border-white shadow-md bg-white relative z-20 shrink-0" 
                />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-2xl sm:text-3xl border-4 border-white shadow-md relative z-20 shrink-0">
                  KS
                </div>
              )}
              <div className="mb-0 sm:mb-1 w-full sm:w-auto min-w-0">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug truncate">{adminName}</h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">SSU Queue Management System Controller</p>
              </div>
            </div>
            
            <div className="flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3.5 py-2 rounded-xl text-xs font-semibold self-center sm:self-auto w-full sm:w-auto shrink-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              Secure Session Active
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 pt-4 border-t border-slate-100">
            {/* Email Field */}
            <div className="flex items-start gap-3.5 sm:gap-4 p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="p-2.5 sm:p-3 bg-white text-purple-700 rounded-xl shadow-2xs border border-slate-200 shrink-0">
                <Mail className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">Authorized Admin Email</p>
                <p className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5 truncate">{adminEmail}</p>
                <p className="text-xs text-slate-500 mt-1 leading-snug">Strictly whitelisted for portal access.</p>
              </div>
            </div>

            {/* Account UID */}
            <div className="flex items-start gap-3.5 sm:gap-4 p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="p-2.5 sm:p-3 bg-white text-purple-700 rounded-xl shadow-2xs border border-slate-200 shrink-0">
                <KeyRound className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">Firebase Account UID</p>
                <div className="mt-1">
                  <p className="font-mono text-[11px] sm:text-xs text-slate-800 bg-white px-2 py-1 rounded-md border border-slate-200 inline-block max-w-full truncate">
                    {adminUid}
                  </p>
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-snug">Unique database identifier reference.</p>
              </div>
            </div>

            {/* Security Level */}
            <div className="flex items-start gap-3.5 sm:gap-4 p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="p-2.5 sm:p-3 bg-white text-purple-700 rounded-xl shadow-2xs border border-slate-200 shrink-0">
                <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">Access Clearance</p>
                <p className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5">Full Read & Write Access</p>
                <p className="text-xs text-slate-500 mt-1 leading-snug">Granted control over appointments, queues, and office states.</p>
              </div>
            </div>

            {/* Session Verification */}
            <div className="flex items-start gap-3.5 sm:gap-4 p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="p-2.5 sm:p-3 bg-white text-purple-700 rounded-xl shadow-2xs border border-slate-200 shrink-0">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">Session Registered</p>
                <p className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5 truncate">{creationTime}</p>
                <p className="text-xs text-slate-500 mt-1 leading-snug">Google OAuth 2.0 Encrypted Sign-In.</p>
              </div>
            </div>
          </div>

          {/* Security Notice Box */}
          <div className="mt-5 sm:mt-6 p-3.5 sm:p-4 rounded-2xl bg-purple-50/60 border border-purple-100 flex items-start gap-3 text-purple-900">
            <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">
              <strong>Security Protocol Enforced:</strong> Firestore rules and frontend authentication guards ensure that any attempt to log in using an account other than <span className="font-mono font-semibold break-all">qsystemssu123@gmail.com</span> is automatically terminated.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}