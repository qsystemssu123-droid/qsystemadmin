import { Building2 } from 'lucide-react';

export default function OfficeDistribution({ officeCounts, totalBookings }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-xs border border-sky-100 flex flex-col justify-between transition-all duration-300 hover:shadow-md">
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-slate-900">Office Bookings Distribution</h2>
          <span className="text-xs font-medium text-slate-500">Real-time share</span>
        </div>

        <div className="space-y-4">
          {Object.entries(officeCounts).map(([officeName, count], idx) => {
            const percentage = Math.round((count / totalBookings) * 100);
            return (
              <div key={officeName} className="space-y-1.5 transition-all duration-300 hover:translate-x-1">
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-slate-700 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-sky-600 transition-transform duration-300 hover:scale-125" />
                    {officeName}
                  </span>
                  <span className="text-slate-900 font-semibold">{count} bookings ({percentage}%)</span>
                </div>
                <div className="w-full h-3 bg-sky-50 rounded-full overflow-hidden border border-sky-100">
                  <div
                    className="h-full bg-sky-600 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${Math.max(percentage, 10)}%`, transitionDelay: `${idx * 150}ms` }}
                  ></div>
                </div>
              </div>
            );
          })}
          {Object.keys(officeCounts).length === 0 && (
            <p className="text-sm text-slate-500 py-8 text-center animate-pulse">No office booking metrics recorded yet.</p>
          )}
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-sky-100 flex items-center justify-between text-xs text-slate-500">
        <span>Sample Office: OSAS, Registrar, Cashier</span>
        <span className="font-semibold text-sky-700 animate-pulse">Updated Live</span>
      </div>
    </div>
  );
}