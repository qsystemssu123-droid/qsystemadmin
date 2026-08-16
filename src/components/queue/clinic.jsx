import {
  CheckCircle2,
  XCircle,
  CheckCheck,
  Users,
  Eye,
  ShieldAlert,
} from 'lucide-react';

export default function Clinic({
  appointments,
  approveAppointment,
  rejectAppointment,
  completeAppointment,
  setSelectedImage,
}) {
  const officeName = 'Clinic';

  const getTimestamp = (item) => {
    if (item.createdAt?.seconds) return item.createdAt.seconds;
    if (item.createdAt?.toMillis) return item.createdAt.toMillis();
    if (typeof item.createdAt === 'number') return item.createdAt;
    return 0;
  };

  const getStatus = (item) => item.status?.toLowerCase() || '';

  const officeAppointments = appointments.filter((item) => {
    const itemOffice = item.office?.trim().toLowerCase() || '';
    return itemOffice === officeName.toLowerCase();
  });

  const validAppointments = officeAppointments.filter((item) => {
    const status = getStatus(item);
    return status !== 'completed' && status !== 'rejected';
  });

  const completedCount = officeAppointments.filter(
    (item) => getStatus(item) === 'completed'
  ).length;

  // 1. Explicit in-progress appointment
  const inProgressAppointment = validAppointments.find(
    (item) => getStatus(item) === 'in-progress'
  ) || null;

  // 2. Priority Lane Queue (Pending approval):
  const priorityLaneQueue = validAppointments
    .filter((item) => {
      const status = getStatus(item);
      return (
        item.isPriority &&
        status !== 'approved' &&
        status !== 'in-progress'
      );
    })
    .sort((a, b) => getTimestamp(a) - getTimestamp(b));

  // Approved priority appointments
  const approvedPriority = validAppointments
    .filter((item) => {
      const status = getStatus(item);
      return item.isPriority && status === 'approved' && status !== 'in-progress';
    })
    .sort((a, b) => getTimestamp(a) - getTimestamp(b));

  // Normal appointments
  const normalAppointments = validAppointments
    .filter((item) => {
      const status = getStatus(item);
      return !item.isPriority && status !== 'in-progress';
    })
    .sort((a, b) => getTimestamp(a) - getTimestamp(b));

  // Determine currentServing and upcomingQueue cleanly using const
  const { currentServing, upcomingQueue } = (() => {
    if (inProgressAppointment) {
      return {
        currentServing: inProgressAppointment,
        upcomingQueue: [...approvedPriority, ...normalAppointments],
      };
    }
    if (completedCount === 0 && normalAppointments.length > 0) {
      return {
        currentServing: normalAppointments[0],
        upcomingQueue: [...approvedPriority, ...normalAppointments.slice(1)],
      };
    }
    const serving = approvedPriority[0] || normalAppointments[0] || null;
    const queue =
      serving?.isPriority && getStatus(serving) === 'approved'
        ? [...approvedPriority.slice(1), ...normalAppointments]
        : [
            ...approvedPriority,
            ...normalAppointments.filter((item) => item.id !== serving?.id),
          ];

    return { currentServing: serving, upcomingQueue: queue };
  })();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 animate-fade-in transition-all duration-300">
      <div className="flex flex-col gap-4 sm:gap-6">
        {/* Now Serving Card */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-xs border border-slate-200 text-center flex flex-col items-center justify-between transition-all duration-300 hover:shadow-md hover:border-purple-200 transform hover:-translate-y-0.5 group">
          <div className="w-full">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
              Now Serving ({officeName})
            </span>
            {currentServing ? (
              <div className="flex flex-col items-center animate-fade-in">
                <span className="text-4xl sm:text-5xl font-black text-purple-600 my-2 font-mono transition-transform duration-300 group-hover:scale-105 break-all">
                  {currentServing.queueNumber || 'N/A'}
                </span>
                <p className="font-semibold text-slate-800 text-base sm:text-lg mt-1 break-words max-w-full">
                  {currentServing.userName || 'Unknown Student'}
                </p>
                <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100 my-1 transition-transform duration-200 hover:scale-105 break-words max-w-full">
                  {currentServing.office} -{' '}
                  {currentServing.service || currentServing.reason}
                </span>
                {currentServing.isPriority && (
                  <div className="mt-3 mb-1 animate-fade-in">
                    <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 mb-2 transition-transform duration-200 hover:scale-105">
                      Priority Lane Active
                    </span>
                    {currentServing.priorityImageUrl && (
                      <div>
                        <button
                          onClick={() =>
                            setSelectedImage(currentServing.priorityImageUrl)
                          }
                          className="inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 border border-slate-300 shadow-xs cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 transition-transform duration-200 hover:scale-110" />
                          View ID Image
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 sm:py-12 animate-fade-in">
                <Users className="w-10 h-10 sm:w-12 sm:h-12 text-slate-300 mx-auto mb-2 transition-transform duration-300 hover:scale-110" />
                <p className="text-slate-500 text-xs sm:text-sm font-medium">
                  No active ticket being served for {officeName}.
                </p>
              </div>
            )}
          </div>
          {currentServing && (
            <div className="flex items-center gap-2 mt-6 w-full justify-center">
              <button
                onClick={() => completeAppointment(currentServing.id)}
                className="w-full inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl transition-all duration-300 hover:shadow-md transform hover:-translate-y-0.5 active:scale-95 text-xs cursor-pointer"
              >
                <CheckCheck className="w-4 h-4 transition-transform duration-200 hover:scale-110" />
                Complete
              </button>
            </div>
          )}
        </div>

        {/* Priority Lineup Card */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-xs border border-amber-200/60 flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:border-amber-300 transform hover:-translate-y-0.5">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-1 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 truncate">
                <ShieldAlert className="w-5 h-5 text-amber-600 transition-transform duration-300 hover:rotate-12 shrink-0" />
                <span className="truncate">Priority Lineup ({officeName})</span>
              </span>
              <span className="text-xs font-semibold bg-amber-50 text-amber-700 px-2 py-1 rounded-lg border border-amber-200 transition-transform duration-200 hover:scale-105 shrink-0">
                {priorityLaneQueue.length} Pending
              </span>
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Bookings remain here until reviewed and approved.
            </p>
            {priorityLaneQueue.length === 0 ? (
              <div className="py-8 sm:py-12 text-center animate-fade-in">
                <p className="text-slate-500 text-xs sm:text-sm font-medium">
                  No pending priority bookings for {officeName}.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {priorityLaneQueue.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex flex-col p-3.5 bg-amber-50/40 rounded-xl border border-amber-200/70 hover:bg-amber-50 transition-all duration-300 hover:shadow-sm transform hover:scale-[1.01] gap-2 animate-fade-in"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start sm:items-center gap-3 min-w-0">
                        <span className="font-mono font-bold text-slate-900 bg-white px-2.5 py-1 rounded-md border border-slate-200 text-xs shadow-2xs transition-transform duration-200 hover:scale-105 shrink-0">
                          {item.queueNumber || 'N/A'}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 text-sm truncate">
                            {item.userName || 'Unknown Student'}
                          </p>
                          <p className="text-xs text-slate-500 truncate">{item.office}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        <button
                          onClick={() => approveAppointment(item.id)}
                          className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold text-xs bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg border border-emerald-200 transition-all duration-200 hover:scale-105 active:scale-95 shadow-2xs cursor-pointer"
                          title="Approve and move to waiting queue"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 transition-transform duration-200 hover:scale-110" />
                          Approve
                        </button>
                        <button
                          onClick={() => rejectAppointment(item.id)}
                          className="inline-flex items-center gap-1 text-rose-700 hover:text-rose-800 font-semibold text-xs bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 rounded-lg border border-rose-200 transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
                          title="Reject"
                        >
                          <XCircle className="w-3.5 h-3.5 transition-transform duration-200 hover:scale-110" />
                          <span className="inline sm:hidden">Reject</span>
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-amber-200/50 mt-1 gap-2 flex-wrap">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 transition-transform duration-200 hover:scale-105">
                        Awaiting Approval
                      </span>
                      {item.priorityImageUrl && (
                        <button
                          onClick={() => setSelectedImage(item.priorityImageUrl)}
                          className="inline-flex items-center gap-1 text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md border border-slate-300 shadow-2xs transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
                        >
                          <Eye className="w-3 h-3 transition-transform duration-200 hover:scale-110" />
                          View ID Image
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upcoming Queue Card */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-xs border border-slate-200 flex flex-col justify-between h-full transition-all duration-300 hover:shadow-md transform hover:-translate-y-0.5">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-4 flex items-center justify-between gap-2">
            <span className="truncate">Upcoming Queue ({officeName})</span>
            <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-1 rounded-lg transition-transform duration-200 hover:scale-105 shrink-0">
              {upcomingQueue.length} Waiting
            </span>
          </h2>
          {upcomingQueue.length === 0 ? (
            <div className="py-8 sm:py-12 text-center animate-fade-in">
              <p className="text-slate-500 text-xs sm:text-sm font-medium">
                No items in the upcoming queue for {officeName}.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[820px] overflow-y-auto pr-1">
              {upcomingQueue.map((item, index) => (
                <div
                  key={item.id}
                  className="flex flex-col p-3.5 bg-slate-50 rounded-xl border border-slate-200 hover:bg-slate-100/50 transition-all duration-300 hover:shadow-sm transform hover:scale-[1.01] gap-2 animate-fade-in"
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      <span className="font-mono font-bold text-slate-900 bg-white px-2.5 py-1 rounded-md border border-slate-200 text-xs shadow-2xs transition-transform duration-200 hover:scale-105 shrink-0">
                        {item.queueNumber || 'N/A'}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 text-sm truncate">
                          {item.userName || 'Unknown Student'}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{item.office}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      <button
                        onClick={() => rejectAppointment(item.id)}
                        className="inline-flex items-center gap-1 text-rose-700 hover:text-rose-800 font-semibold text-xs bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 rounded-lg border border-rose-200 transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
                        title="Reject"
                      >
                        <XCircle className="w-3.5 h-3.5 transition-transform duration-200 hover:scale-110" />
                        <span className="inline sm:hidden">Reject</span>
                      </button>
                    </div>
                  </div>
                  {item.isPriority && (
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 mt-1 gap-2 flex-wrap">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 transition-transform duration-200 hover:scale-105">
                        Priority Lane (Approved)
                      </span>
                      {item.priorityImageUrl && (
                        <button
                          onClick={() => setSelectedImage(item.priorityImageUrl)}
                          className="inline-flex items-center gap-1 text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md border border-slate-300 shadow-2xs transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
                        >
                          <Eye className="w-3 h-3 transition-transform duration-200 hover:scale-110" />
                          View ID
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}