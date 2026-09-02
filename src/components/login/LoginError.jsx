import { ShieldCheck } from 'lucide-react';

export default function LoginError({ errorMessage }) {
  if (!errorMessage) {
    return null;
  }

  return (
    <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-semibold leading-relaxed text-left flex items-start gap-3 shadow-xs">
      <ShieldCheck className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
      <span>{errorMessage}</span>
    </div>
  );
}