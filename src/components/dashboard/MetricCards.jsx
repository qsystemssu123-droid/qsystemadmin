import { Calendar, Users, Building2, CheckCircle2, TrendingUp } from 'lucide-react';

export default function MetricCards({ bookedTodayCount, registeredUsersCount, activeOfficesCount, completionRate, completedCount, totalBookings }) {
  return (
    <div className="animate-slide-right-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {/* Booked Today Card */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-sky-100 transition-all duration-300 hover:shadow-lg hover:border-sky-300 transform hover:-translate-y-1 group">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-500">Booked Today</h3>
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
            <Calendar className="w-5 h-5" />
          </div>
        </div>
        <p className="text-3xl font-bold text-slate-900 mt-3 transition-transform duration-300 group-hover:translate-x-1">{bookedTodayCount}</p>
        <div className="flex items-center gap-1.5 mt-3 text-xs font-semibold text-emerald-600">
          <TrendingUp className="w-4 h-4 transition-transform duration-300 group-hover:translate-y-[-2px]" />
          <span>Active queue flow normal</span>
        </div>
      </div>

      {/* Registered Users Card */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-sky-100 transition-all duration-300 hover:shadow-lg hover:border-sky-300 transform hover:-translate-y-1 group">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-500">Total Registered Users</h3>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
            <Users className="w-5 h-5" />
          </div>
        </div>
        <p className="text-3xl font-bold text-slate-900 mt-3 transition-transform duration-300 group-hover:translate-x-1">{registeredUsersCount}</p>
        <div className="flex items-center gap-1.5 mt-3 text-xs font-semibold text-indigo-600">
          <span>Synced with Firebase Auth</span>
        </div>
      </div>

      {/* Active Offices Card */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-sky-100 transition-all duration-300 hover:shadow-lg hover:border-sky-300 transform hover:-translate-y-1 group">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-500">Active Offices</h3>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
            <Building2 className="w-5 h-5" />
          </div>
        </div>
        <p className="text-3xl font-bold text-slate-900 mt-3 transition-transform duration-300 group-hover:translate-x-1">{activeOfficesCount}</p>
        <div className="flex items-center gap-1.5 mt-3 text-xs font-semibold text-amber-600">
          <span>OSAS, CLINIC, SWDS</span>
        </div>
      </div>

      {/* Completion Rate Card */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-sky-100 transition-all duration-300 hover:shadow-lg hover:border-sky-300 transform hover:-translate-y-1 group">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-500">Completion Rate</h3>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
        <p className="text-3xl font-bold text-emerald-600 mt-3 transition-transform duration-300 group-hover:translate-x-1">{completionRate}%</p>
        <div className="flex items-center gap-1.5 mt-3 text-xs font-semibold text-slate-500">
          <span>{completedCount} of {totalBookings} appointments completed</span>
        </div>
      </div>
    </div>
  );
}