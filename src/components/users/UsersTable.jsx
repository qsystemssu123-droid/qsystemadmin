import {
  Users as UsersIcon,
  Mail,
  Calendar,
  UserX,
  UserCheck,
} from 'lucide-react';
import { formatDate } from '../../services/usersService.js';

export default function UsersTable({
  users,
  actionLoading,
  onToggleBan,
}) {
  if (users.length === 0) {
    return (
      <div className="py-20 text-center">
        <UsersIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />

        <p className="text-slate-700 font-medium text-base">
          No user profiles found in the database.
        </p>

        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          Make sure user records are written to the{' '}
          <span className="font-mono font-semibold text-slate-600">
            users
          </span>{' '}
          collection with their UID as the document ID.
        </p>
      </div>
    );
  }

  return (
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
            const name =
              item.displayName || item.userName || 'System User';
            const photo = item.photoURL || item.userPhoto;
            const uid = item.uid || item.id;
            const isBanned = !!item.banned;

            return (
              <tr
                key={uid}
                className="hover:bg-slate-50/50 transition-colors"
              >
                <td className="py-4 px-6">
                  <div className="flex items-center gap-3">
                    {photo ? (
                      <img
                        src={photo}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-2xs"
                      />
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

                      <p className="text-xs text-slate-400">
                        Database Record
                      </p>
                    </div>
                  </div>
                </td>

                <td className="py-4 px-6 text-slate-600">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-medium">{email}</span>
                  </div>
                </td>

                <td className="py-4 px-6">
                  <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200">
                    {uid}
                  </span>
                </td>

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

                <td className="py-4 px-6 text-slate-500 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {formatDate(item.lastLogin || item.createdAt)}
                    </span>
                  </div>
                </td>

                <td className="py-4 px-6 text-right">
                  <button
                    onClick={() => onToggleBan(uid, isBanned, item)}
                    disabled={actionLoading === uid}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-2xs ${
                      isBanned
                        ? 'bg-slate-900 text-white hover:bg-slate-800'
                        : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                    } ${
                      actionLoading === uid
                        ? 'opacity-50 cursor-not-allowed'
                        : ''
                    }`}
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
  );
}