import { AlertCircle } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../../services/firebase.js';

export default function LogoutModal({ setShowLogoutModal }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-4 border border-rose-100">
          <AlertCircle className="w-6 h-6" />
        </div>

        <h3 className="text-lg font-bold text-slate-900 mb-1">Log Out</h3>

        <p className="text-sm text-slate-500 mb-6">
          Are you sure you want to log out?
        </p>

        <div className="flex items-center gap-3 w-full">
          <button
            onClick={() => setShowLogoutModal(false)}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-slate-200 hover:bg-slate-300 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={async () => {
              setShowLogoutModal(false);

              try {
                await signOut(auth);
              } catch (error) {
                console.error('Logout error:', error);
              }
            }}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-xs cursor-pointer"
          >
            Yes, Log Out
          </button>
        </div>
      </div>
    </div>
  );
}