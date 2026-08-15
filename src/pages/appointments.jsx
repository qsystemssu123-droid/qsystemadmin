import { useAppointments } from '../hooks/useAppointments';
import { Calendar, Clock, CheckCircle2, AlertCircle, Star, Users } from 'lucide-react';

export default function Appointments() {
  const { appointments, loading } = useAppointments();

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'in-progress':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'approved':
      case 'waiting':
      case 'pending':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'rejected':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm font-medium text-slate-500 animate-pulse">Loading appointments from database...</p>
      </div>
    );
  }

  // Determine current serving ticket (First one with 'in-progress', or fall back to the first available non-completed/non-rejected one if needed)
  const activeServing = appointments.find(
    (item) => item.status?.toLowerCase() === 'in-progress'
  );
  const defaultServing = appointments.find(
    (item) => !['completed', 'rejected'].includes(item.status?.toLowerCase())
  );
  const currentServing = activeServing || defaultServing;

  // Filter out completed, rejected, and current serving items for active lists
  const validAppointments = appointments.filter(
    (item) => !['completed', 'rejected'].includes(item.status?.toLowerCase()) && item.id !== currentServing?.id
  );

  // Priority Lane Box: Priority bookings that haven't been approved yet (pending review)
  const priorityAppointments = validAppointments.filter(
    (item) => item.isPriority && item.status?.toLowerCase() !== 'approved'
  ).sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));

  // Waiting Bookings: Normal waiting appointments + Approved Priority appointments.
  // Approved priority appointments are sorted to the VERY FRONT of the waiting line.
  const waitingAppointments = validAppointments.filter(
    (item) => {
      // Exclude unapproved priority items (they stay in the Priority Lane box)
      if (item.isPriority && item.status?.toLowerCase() !== 'approved') return false;
      return true;
    }
  ).sort((a, b) => {
    const aIsApprovedPriority = a.isPriority && a.status?.toLowerCase() === 'approved';
    const bIsApprovedPriority = b.isPriority && b.status?.toLowerCase() === 'approved';

    // Approved priority items go first in the waiting list
    if (aIsApprovedPriority && !bIsApprovedPriority) return -1;
    if (!aIsApprovedPriority && bIsApprovedPriority) return 1;

    // Otherwise sort by creation time (FIFO)
    return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
  });

  const completedAppointments = appointments.filter(
    (item) => item.status?.toLowerCase() === 'completed'
  );

  const renderTable = (items, emptyMessage) => {
    if (items.length === 0) {
      return (
        <div className="py-12 text-center">
          <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm font-medium">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-4">Student</th>
              <th className="py-3 px-4">Office & Service</th>
              <th className="py-3 px-4">Schedule</th>
              <th className="py-3 px-4">Queue #</th>
              <th className="py-3 px-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2.5">
                    {item.userPhoto ? (
                      <img src={item.userPhoto} alt="" className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-2xs" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                        {item.userName ? item.userName.charAt(0) : 'U'}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-slate-900 text-xs flex items-center gap-1">
                        {item.userName || 'Unknown User'}
                      </p>
                      <p className="text-[11px] text-slate-500">{item.userEmail}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-100 mb-0.5">
                    {item.office}
                  </span>
                  <p className="text-[11px] text-slate-600 truncate max-w-[180px]">{item.service || item.reason}</p>
                </td>
                <td className="py-3 px-4 text-slate-600 whitespace-nowrap text-xs">
                  <p className="font-medium text-slate-900">{item.appointmentDate}</p>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" /> {item.appointmentTime}
                  </p>
                </td>
                <td className="py-3 px-4">
                  <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-xs">
                    {item.queueNumber || 'N/A'}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium capitalize border ${getStatusBadge(item.status)}`}>
                    {item.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Box UI Update */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Student Bookings & Appointments</h1>
            <p className="text-sm text-slate-500 mt-1">Manage serving, waiting, priority, and completed student bookings in real-time.</p>
          </div>
        </div>
      </div>

      {/* Grid Layout matching the requested wireframe structure */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* Left Column: Stacked boxes (Now Serving, Waiting Bookings & Priority Lane) */}
        <div className="space-y-6 flex flex-col">
          
          {/* Top-Left Box: Now Serving */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 text-center flex flex-col items-center justify-between">
            <div className="w-full flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                  <Users className="w-5 h-5" />
                </div>
                <h2 className="font-bold text-slate-900 text-base">Now Serving</h2>
              </div>
              <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2.5 py-1 rounded-full">
                Active
              </span>
            </div>

            {currentServing ? (
              <div className="flex flex-col items-center py-2 w-full">
                <span className="text-4xl font-black text-purple-600 my-1 font-mono">
                  {currentServing.queueNumber || 'N/A'}
                </span>
                <p className="font-semibold text-slate-800 text-sm mt-1">{currentServing.userName || 'Unknown Student'}</p>
                <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100 mt-1">
                  {currentServing.office} - {currentServing.service || currentServing.reason}
                </span>
              </div>
            ) : (
              <div className="py-6 text-center">
                <p className="text-slate-500 text-sm font-medium">No active ticket being served.</p>
              </div>
            )}
          </div>

          {/* Middle-Left Box: Waiting Bookings */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden p-5">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <h2 className="font-bold text-slate-900 text-base">Waiting Bookings</h2>
              </div>
              <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full">
                {waitingAppointments.length}
              </span>
            </div>
            {renderTable(waitingAppointments, "No waiting appointments found.")}
          </div>

          {/* Bottom-Left Box: Priority Lane Bookings */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden p-5">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Star className="w-5 h-5" />
                </div>
                <h2 className="font-bold text-slate-900 text-base">Priority Lane (Pending)</h2>
              </div>
              <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-1 rounded-full">
                {priorityAppointments.length}
              </span>
            </div>
            {renderTable(priorityAppointments, "No pending priority appointments found.")}
          </div>

        </div>

        {/* Right Column: Tall Box for Completed Bookings */}
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden p-5 h-full flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h2 className="font-bold text-slate-900 text-base">Completed Bookings</h2>
            </div>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full">
              {completedAppointments.length}
            </span>
          </div>
          <div className="flex-1">
            {renderTable(completedAppointments, "No completed appointments found.")}
          </div>
        </div>

      </div>
    </div>
  );
}