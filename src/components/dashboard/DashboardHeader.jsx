export default function DashboardHeader() {
  const formattedToday = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="animate-slide-right-1 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-sky-100 shadow-xs transition-all duration-300 hover:shadow-md transform hover:-translate-y-0.5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 transition-colors">SSU Q-Systems Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Real-time queue monitoring, office metrics, and user analytics.</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 transition-transform duration-300 hover:scale-105">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          System Operational
        </span>
        <span className="text-xs font-medium text-slate-500 bg-sky-50 px-3 py-1.5 rounded-xl border border-sky-100 transition-transform duration-300 hover:scale-105">
          Today: {formattedToday}
        </span>
      </div>
    </div>
  );
}