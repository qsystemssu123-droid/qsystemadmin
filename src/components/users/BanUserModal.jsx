import { ShieldAlert } from 'lucide-react';

export default function BanUserModal({
  user,
  durationValue,
  durationUnit,
  actionLoading,
  onDurationValueChange,
  onDurationUnitChange,
  onClose,
  onConfirm,
}) {
  if (!user) {
    return null;
  }

  const uid = user.uid || user.id;
  const userName =
    user.displayName || user.userName || 'User';

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-600" />
            Ban User: {userName}
          </h3>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold text-sm"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Select how long this user should be restricted for trolling the app.
          Once the time runs out, the student will be automatically unbanned.
        </p>

        <div className="space-y-3 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Duration Amount
            </label>

            <input
              type="number"
              min="1"
              value={durationValue}
              onChange={(e) => onDurationValueChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Time Unit
            </label>

            <select
              value={durationUnit}
              onChange={(e) => onDurationUnitChange(e.target.value)}
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
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-all"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={actionLoading === uid}
            onClick={() => onConfirm(user)}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-all shadow-xs disabled:opacity-50"
          >
            {actionLoading === uid
              ? 'Applying Ban...'
              : 'Confirm Ban'}
          </button>
        </div>
      </div>
    </div>
  );
}