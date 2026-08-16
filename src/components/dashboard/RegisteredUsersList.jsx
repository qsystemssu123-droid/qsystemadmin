import { Users } from 'lucide-react';

export default function RegisteredUsersList({ registeredUsers }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-xs border border-sky-100 flex flex-col justify-between transition-all duration-300 hover:shadow-md">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            Registered System Users
          </h2>
          <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
            {registeredUsers.length} Users
          </span>
        </div>

        <div className="space-y-3 mt-4">
          {registeredUsers.map((u) => (
            <div key={u.uid} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 transition-all hover:bg-sky-50/50 hover:border-sky-200">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                  {u.name.charAt(0)}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">{u.name}</p>
                  <p className="text-[11px] text-slate-500 truncate max-w-[140px]">{u.email}</p>
                </div>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                {u.role}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-sky-100 flex items-center justify-between text-xs text-slate-500">
        <span>Firebase Auth Database</span>
        <span className="font-semibold text-indigo-600">Verified Records</span>
      </div>
    </div>
  );
}