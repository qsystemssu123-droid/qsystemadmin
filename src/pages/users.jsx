import { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase.js';
import { Users as UsersIcon, Mail, ShieldAlert, Calendar, UserX, UserCheck } from 'lucide-react';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  // Modal and duration state for banning users
  const [banModalUser, setBanModalUser] = useState(null);
  const [durationValue, setDurationValue] = useState('1');
  const [durationUnit, setDurationUnit] = useState('days');

  useEffect(() => {
    async function fetchUsers() {
      try {
        // Fetch both collections concurrently
        const [usersSnapshot, bannedSnapshot] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'Banned')),
        ]);

        const now = new Date();
        const activeBannedDocs = [];
        const expiredIds = [];
        const banDetailsMap = {};

        // Check for expired bans and automatically clean them up
        bannedSnapshot.docs.forEach((docItem) => {
          const data = docItem.data();
          const expiresAt = data.expiresAt?.toDate 
            ? data.expiresAt.toDate() 
            : (data.expiresAt?.seconds ? new Date(data.expiresAt.seconds * 1000) : (data.expiresAt ? new Date(data.expiresAt) : null));

          if (expiresAt && expiresAt <= now) {
            // Ban has expired, mark for automatic removal
            expiredIds.push(docItem.id);
          } else {
            activeBannedDocs.push(docItem.id);
            banDetailsMap[docItem.id] = data;
          }
        });

        // Automatically delete expired ban records from Firestore so users become unbanned
        if (expiredIds.length > 0) {
          await Promise.all(expiredIds.map((id) => deleteDoc(doc(db, 'Banned', id))));
        }

        // Create a Set of UIDs that are actively banned
        const bannedIds = new Set(activeBannedDocs);

        const userList = usersSnapshot.docs.map((docItem) => {
          const uid = docItem.id;
          const isBannedInCollection = bannedIds.has(uid);
          const banData = banDetailsMap[uid] || {};
          
          return {
            id: uid,
            uid: uid,
            ...docItem.data(),
            // Mark as banned if present in active Banned collection OR if user doc explicitly says true
            banned: isBannedInCollection || !!docItem.data().banned,
            expiresAt: banData.expiresAt || null,
          };
        });
        
        setUsers(userList);
      } catch (error) {
        console.error('Error fetching user profiles from Firestore:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchUsers();
  }, []);

  const handleToggleBan = async (uid, currentBanStatus, userData) => {
    if (currentBanStatus) {
      // Unban directly when already banned
      try {
        setActionLoading(uid);
        const bannedRef = doc(db, 'Banned', uid);
        await deleteDoc(bannedRef);

        setUsers((prevUsers) =>
          prevUsers.map((user) =>
            user.uid === uid ? { ...user, banned: false, expiresAt: null } : user
          )
        );
      } catch (error) {
        console.error('Error updating user ban status:', error);
        alert('Failed to update ban status. Please check console.');
      } finally {
        setActionLoading(null);
      }
    } else {
      // Open duration selection modal before banning
      setDurationValue('1');
      setDurationUnit('days');
      setBanModalUser(userData);
    }
  };

  const confirmBan = async (userData) => {
    const uid = userData.uid || userData.id;
    try {
      setActionLoading(uid);
      const now = new Date();
      const val = parseInt(durationValue) || 1;
      let expiresAt = new Date(now.getTime());

      // Calculate expiration time based on admin's choice
      if (durationUnit === 'hours') {
        expiresAt.setTime(now.getTime() + val * 60 * 60 * 1000);
      } else if (durationUnit === 'days') {
        expiresAt.setDate(now.getDate() + val);
      } else if (durationUnit === 'weeks') {
        expiresAt.setDate(now.getDate() + val * 7);
      } else if (durationUnit === 'months') {
        expiresAt.setMonth(now.getMonth() + val);
      } else if (durationUnit === 'years') {
        expiresAt.setFullYear(now.getFullYear() + val);
      }

      const bannedRef = doc(db, 'Banned', uid);
      await setDoc(bannedRef, {
        ...userData,
        status: 'BANNED',
        bannedAt: now,
        expiresAt: expiresAt,
        banDurationText: `${val} ${durationUnit}`,
      });

      // Update local state smoothly
      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user.uid === uid ? { ...user, banned: true, expiresAt } : user
        )
      );
      setBanModalUser(null);
    } catch (error) {
      console.error('Error banning user with duration:', error);
      alert('Failed to apply ban. Please check console.');
    } finally {
      setActionLoading(null);
    }
  };

  // Safe helper to format Firestore Timestamps or strings without crashing React
  const formatDate = (timestamp) => {
    if (!timestamp) return 'Active Session';
    if (typeof timestamp.toDate === 'function') {
      return timestamp.toDate().toLocaleString();
    }
    if (timestamp.seconds) {
      return new Date(timestamp.seconds * 1000).toLocaleString();
    }
    if (typeof timestamp === 'string') {
      return new Date(timestamp).toLocaleString();
    }
    return 'Active Session';
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm font-medium text-slate-500 animate-pulse">Loading user accounts...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">System User Accounts</h1>
          <p className="text-sm text-slate-500 mt-1">Review user profiles, monitor system access, and manage user restrictions.</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 text-purple-700 px-4 py-2 rounded-xl text-xs font-semibold">
          Total Accounts: {users.length}
        </div>
      </div>

      {/* Users Table Card */}
      <div className="bg-white rounded-3xl shadow-xs border border-slate-200 overflow-hidden">
        {users.length === 0 ? (
          <div className="py-20 text-center">
            <UsersIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-700 font-medium text-base">No user profiles found in the database.</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Make sure user records are written to the <span className="font-mono font-semibold text-slate-600">users</span> collection with their UID as the document ID.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-4 px-6">User Profile</th>
                  <th className="py-4 px-6">Email Address</th>
                  <th className="py-4 px-6">User UID</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Last Login / Created</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {users.map((item) => {
                  const email = item.email || item.userEmail || 'N/A';
                  const name = item.displayName || item.userName || 'System User';
                  const photo = item.photoURL || item.userPhoto;
                  const uid = item.uid || item.id;
                  const isBanned = !!item.banned;
                  
                  return (
                    <tr key={uid} className="hover:bg-slate-50/50 transition-colors">
                      {/* Avatar & Name */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          {photo ? (
                            <img src={photo} alt="" className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-2xs" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm shadow-2xs">
                              {name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-slate-900 flex items-center gap-2">
                              {name}
                              <span className="bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                User
                              </span>
                            </p>
                            <p className="text-xs text-slate-400">Database Record</p>
                          </div>
                        </div>
                      </td>

                      {/* Email Identifier */}
                      <td className="py-4 px-6 text-slate-600">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="font-medium">{email}</span>
                        </div>
                      </td>

                      {/* UID */}
                      <td className="py-4 px-6">
                        <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200">
                          {uid}
                        </span>
                      </td>

                      {/* Status Tag */}
                      <td className="py-4 px-6">
                        {isBanned ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200 text-xs px-2.5 py-1 rounded-full font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                              Banned
                            </span>
                            {item.expiresAt && (
                              <p className="text-[10px] text-slate-500 pl-1">
                                Expires: {formatDate(item.expiresAt)}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-2.5 py-1 rounded-full font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Active
                          </span>
                        )}
                      </td>

                      {/* Last Login Date */}
                      <td className="py-4 px-6 text-slate-500 text-xs">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatDate(item.lastLogin || item.createdAt)}</span>
                        </div>
                      </td>

                      {/* Ban / Unban Actions */}
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => handleToggleBan(uid, isBanned, item)}
                          disabled={actionLoading === uid}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-2xs ${
                            isBanned
                              ? 'bg-slate-900 text-white hover:bg-slate-800'
                              : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                          } ${actionLoading === uid ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {isBanned ? (
                            <>
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Unban</span>
                            </>
                          ) : (
                            <>
                              <UserX className="w-3.5 h-3.5" />
                              <span>Ban User</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ban Duration Modal */}
      {banModalUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-600" />
                Ban User: {banModalUser.displayName || banModalUser.userName || 'User'}
              </h3>
              <button 
                onClick={() => setBanModalUser(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Select how long this user should be restricted for trolling the app. Once the time runs out, the student will be automatically unbanned.
            </p>
            
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Duration Amount</label>
                <input 
                  type="number" 
                  min="1" 
                  value={durationValue} 
                  onChange={(e) => setDurationValue(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Time Unit</label>
                <select 
                  value={durationUnit} 
                  onChange={(e) => setDurationUnit(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                >
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                  <option value="weeks">Weeks</option>
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setBanModalUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading === banModalUser.uid}
                onClick={() => confirmBan(banModalUser)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-all shadow-xs disabled:opacity-50"
              >
                {actionLoading === banModalUser.uid ? 'Applying Ban...' : 'Confirm Ban'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Database Integration Note */}
      <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 flex items-start gap-3 text-slate-600">
        <ShieldAlert className="w-5 h-5 text-purple-700 shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed space-y-1">
          <p className="font-semibold text-slate-800">Firestore Banned Collection Sync & Expiration</p>
          <p>
            Banning a user creates a document inside your <span className="font-mono font-semibold text-slate-700">Banned</span> collection with an expiration timestamp. When session data is loaded and the time runs out, the system automatically lifts the restriction and cleans up the record.
          </p>
        </div>
      </div>
    </div>
  );
}