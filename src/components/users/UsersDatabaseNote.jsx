import { ShieldAlert } from 'lucide-react';

export default function UsersDatabaseNote() {
  return (
    <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 flex items-start gap-3 text-slate-600">
      <ShieldAlert className="w-5 h-5 text-purple-700 shrink-0 mt-0.5" />

      <div className="text-xs leading-relaxed space-y-1">
        <p className="font-semibold text-slate-800">
          Firestore Banned Collection Sync & Expiration
        </p>

        <p>
          Banning a user creates a document inside your{' '}
          <span className="font-mono font-semibold text-slate-700">
            Banned
          </span>{' '}
          collection with an expiration timestamp. When session data is loaded
          and the time runs out, the system automatically lifts the restriction
          and cleans up the record.
        </p>
      </div>
    </div>
  );
}