import { Search, Building2 } from 'lucide-react';

export default function AppointmentsTable({
  filteredAppointments,
  searchTerm,
  setSearchTerm,
  filterOffice,
  setFilterOffice,
  officeCounts
}) {
  const officesList = ['ALL', ...Object.keys(officeCounts)];

  return (
    <div className="animate-slide-right-4 bg-white rounded-2xl shadow-xs border border-sky-100 overflow-hidden transition-all duration-300 hover:shadow-md">
      {/* Search & Filter Header */}
      <div className="p-6 border-b border-sky-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Live Appointment Queue</h2>
          <p className="text-xs text-slate-500 mt-0.5">Filter and manage student queues in real-time.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search user or service..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all"
            />
          </div>

          {/* Office Filter Dropdown */}
          <div className="relative w-full sm:w-auto flex items-center gap-1.5 bg-slate-50 px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-700">
            <Building2 className="w-4 h-4 text-slate-400" />
            <select
              value={filterOffice}
              onChange={(e) => setFilterOffice(e.target.value)}
              className="bg-transparent focus:outline-none cursor-pointer pr-2"
            >
              {officesList.map((off) => (
                <option key={off} value={off}>
                  {off === 'ALL' ? 'All Offices' : off}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100">
            <tr>
              <th className="px-6 py-3.5">Queue #</th>
              <th className="px-6 py-3.5">Student / User</th>
              <th className="px-6 py-3.5">Office</th>
              <th className="px-6 py-3.5">Requested Service</th>
              <th className="px-6 py-3.5">Date & Time</th>
              <th className="px-6 py-3.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredAppointments.length > 0 ? (
              filteredAppointments.map((appt) => {
                const isCompleted = appt.status === 'completed';
                const isServing = appt.status === 'serving';

                return (
                  <tr key={appt.id} className="hover:bg-sky-50/40 transition-colors">
                    <td className="px-6 py-4 font-bold text-sky-700">
                      {appt.queueNumber || '#---'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {appt.userPhoto ? (
                          <img src={appt.userPhoto} alt={appt.userName} className="w-8 h-8 rounded-full border border-slate-200 object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs">
                            {appt.userName?.charAt(0) || 'U'}
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-slate-800">{appt.userName || 'Anonymous User'}</p>
                          <p className="text-[11px] text-slate-400">{appt.userEmail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-700">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-800">
                        {appt.office}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800">
                      {appt.service}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-700">{appt.appointmentDate}</p>
                      <p className="text-[11px] text-slate-400">{appt.appointmentTime}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                        isCompleted
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : isServing
                          ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                          : 'bg-sky-50 text-sky-700 border-sky-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          isCompleted ? 'bg-emerald-500' : isServing ? 'bg-amber-500' : 'bg-sky-500'
                        }`}></span>
                        {appt.status ? appt.status.toUpperCase() : 'WAITING'}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="6" className="text-center py-10 text-slate-400">
                  No appointments match the selected search criteria or filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}