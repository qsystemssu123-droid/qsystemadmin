import { Loader2 } from 'lucide-react';

export function AnnouncementLoading() {
  return (
    <div className="w-full min-h-[400px] flex items-center justify-center">
      <div className="flex items-center gap-2 text-slate-500 font-medium text-sm animate-pulse">
        <Loader2 className="w-5 h-5 animate-spin text-sky-600" />
        Loading office statuses from Firestore...
      </div>
    </div>
  );
}

export function AuthRequiredState() {
  return (
    <div className="w-full min-h-[400px] flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 font-bold">
          !
        </div>
        <h2 className="text-lg font-bold text-slate-900">Authentication Required</h2>
        <p className="mt-2 text-sm text-slate-500">Please log in to manage office availability.</p>
      </div>
    </div>
  );
}

export function OfficeAssignmentRequiredState() {
  return (
    <div className="w-full min-h-[400px] flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 font-bold">
          !
        </div>
        <h2 className="text-lg font-bold text-slate-900">Office Assignment Required</h2>
        <p className="mt-2 text-sm text-slate-500">
          Your staff account does not have a valid office assignment. Please contact the system administrator.
        </p>
      </div>
    </div>
  );
}