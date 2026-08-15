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
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Administrator Profile & Security</h1>
        <p className="text-sm text-slate-500 mt-1">Manage system credentials, access control permissions, and administrative security state.</p>
      </div>

      {/* Main Profile Card */}
      <div className="bg-white rounded-3xl shadow-xs border border-slate-200 overflow-hidden">
        {/* Banner header */}
        <div className="h-32 bg-gradient-to-r from-purple-700 via-indigo-700 to-slate-900 px-8 flex justify-end items-end pb-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/20 text-white backdrop-blur-md z-10">
            <BadgeCheck className="w-3.5 h-3.5" /> Super Administrator
          </span>
        </div>

        {/* Profile Content */}
        <div className="px-8 pb-8 pt-0 relative">
          {/* Avatar */}
          <div className="-mt-12 mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="flex items-end gap-5">
              {adminPhoto ? (
                <img 
                  src={adminPhoto} 
                  alt="Admin Avatar" 
                  className="w-24 h-24 rounded-2xl object-cover border-4 border-white shadow-md bg-white relative z-20" 
                />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-3xl border-4 border-white shadow-md relative z-20">
                  KS
                </div>
              )}
              <div className="mb-1">
                <h2 className="text-xl font-bold text-slate-900">{adminName}</h2>
                <p className="text-sm text-slate-500">SSU Queue Management System Controller</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3.5 py-2 rounded-xl text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Secure Session Active
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
            {/* Email Field */}
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="p-3 bg-white text-purple-700 rounded-xl shadow-2xs border border-slate-200">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Authorized Admin Email</p>
                <p className="text-sm font-bold text-slate-900 mt-0.5">{adminEmail}</p>
                <p className="text-xs text-slate-500 mt-1">Strictly whitelisted for portal access.</p>
              </div>
            </div>

            {/* Account UID */}
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="p-3 bg-white text-purple-700 rounded-xl shadow-2xs border border-slate-200">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Firebase Account UID</p>
                <p className="font-mono text-xs text-slate-800 bg-white px-2 py-1 rounded-md border border-slate-200 mt-1 inline-block">
                  {adminUid}
                </p>
                <p className="text-xs text-slate-500 mt-1">Unique database identifier reference.</p>
              </div>
            </div>

            {/* Security Level */}
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="p-3 bg-white text-purple-700 rounded-xl shadow-2xs border border-slate-200">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Access Clearance</p>
                <p className="text-sm font-bold text-slate-900 mt-0.5">Full Read & Write Access</p>
                <p className="text-xs text-slate-500 mt-1">Granted control over appointments, queues, and office states.</p>
              </div>
            </div>

            {/* Session Verification */}
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="p-3 bg-white text-purple-700 rounded-xl shadow-2xs border border-slate-200">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Session Registered</p>
                <p className="text-sm font-bold text-slate-900 mt-0.5">{creationTime}</p>
                <p className="text-xs text-slate-500 mt-1">Google OAuth 2.0 Encrypted Sign-In.</p>
              </div>
            </div>
          </div>

          {/* Security Notice Box */}
          <div className="mt-6 p-4 rounded-2xl bg-purple-50/60 border border-purple-100 flex items-center gap-3 text-purple-900">
            <Lock className="w-5 h-5 text-purple-600 shrink-0" />
            <p className="text-xs leading-relaxed">
              <strong>Security Protocol Enforced:</strong> Firestore rules and frontend authentication guards ensure that any attempt to log in using an account other than <span className="font-mono font-semibold">qsystemssu123@gmail.com</span> is automatically terminated.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}