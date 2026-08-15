import {
  CheckCircle2,
  XCircle,
  CheckCheck,
  Users,
  Eye,
  ShieldAlert,
} from 'lucide-react';

export default function Swds({
  appointments,
  approveAppointment,
  rejectAppointment,
  completeAppointment,
  setSelectedImage,
}) {
  const officeName = 'SWDS';

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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="flex flex-col gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 text-center flex flex-col items-center justify-between">
          <div className="w-full">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
              Now Serving ({officeName})
            </span>
            {currentServing ? (
              <div className="flex flex-col items-center">
                <span className="text-5xl font-black text-purple-600 my-2 font-mono">
                  {currentServing.queueNumber || 'N/A'}
                </span>
                <p className="font-semibold text-slate-800 text-lg mt-1">
                  {currentServing.userName || 'Unknown Student'}
                </p>
                <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100 my-1">
                  {currentServing.office} -{' '}
                  {currentServing.service || currentServing.reason}
                </span>
                {currentServing.isPriority && (
                  <div className="mt-3 mb-1">
                    <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 mb-2">
                      Priority Lane Active
                    </span>
                    {currentServing.priorityImageUrl && (
                      <div>
                        <button
                          onClick={() =>
                            setSelectedImage(currentServing.priorityImageUrl)
                          }
                          className="inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg transition-colors border border-slate-300"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View ID Image
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 text-sm font-medium">
                  No active ticket being served for {officeName}.
                </p>
              </div>
            )}
          </div>
          {currentServing && (
            <div className="flex items-center gap-2 mt-6 w-full justify-center">
              <button
                onClick={() => completeAppointment(currentServing.id)}
                className="w-full inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors shadow-xs text-xs"
              >
                <CheckCheck className="w-4 h-4" />
                Complete
              </button>
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-xs border border-amber-200/60 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-600" />
                Priority Lineup ({officeName})
              </span>
              <span className="text-xs font-semibold bg-amber-50 text-amber-700 px-2 py-1 rounded-lg border border-amber-200">
                {priorityLaneQueue.length} Pending
              </span>
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Bookings remain here until reviewed and approved.
            </p>
            {priorityLaneQueue.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-slate-500 text-sm font-medium">
                  No pending priority bookings for {officeName}.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {priorityLaneQueue.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col p-3.5 bg-amber-50/40 rounded-xl border border-amber-200/70 hover:bg-amber-50 transition-colors gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-slate-900 bg-white px-2.5 py-1 rounded-md border border-slate-200 text-xs shadow-2xs">
                          {item.queueNumber || 'N/A'}
                        </span>
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">
                            {item.userName || 'Unknown Student'}
                          </p>
                          <p className="text-xs text-slate-500">{item.office}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => approveAppointment(item.id)}
                          className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold text-xs bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg border border-emerald-200 transition-colors shadow-2xs"
                          title="Approve and move to waiting queue"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Approve
                        </button>
                        <button
                          onClick={() => rejectAppointment(item.id)}
                          className="inline-flex items-center gap-1 text-rose-700 hover:text-rose-800 font-semibold text-xs bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 rounded-lg border border-rose-200 transition-colors"
                          title="Reject"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-amber-200/50 mt-1">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                        Awaiting Approval
                      </span>
                      {item.priorityImageUrl && (
                        <button
                          onClick={() => setSelectedImage(item.priorityImageUrl)}
                          className="inline-flex items-center gap-1 text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md border border-slate-300 shadow-2xs transition-colors"
                        >
                          <Eye className="w-3 h-3" />
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

      <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 flex flex-col justify-between h-full">
        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center justify-between">
            <span>Upcoming Queue ({officeName})</span>
            <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">
              {upcomingQueue.length} Waiting
            </span>
          </h2>
          {upcomingQueue.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-slate-500 text-sm font-medium">
                No items in the upcoming queue for {officeName}.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[820px] overflow-y-auto pr-1">
              {upcomingQueue.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col p-3.5 bg-slate-50 rounded-xl border border-slate-200 hover:bg-slate-100/50 transition-colors gap-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-slate-900 bg-white px-2.5 py-1 rounded-md border border-slate-200 text-xs shadow-2xs">
                        {item.queueNumber || 'N/A'}
                      </span>
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">
                          {item.userName || 'Unknown Student'}
                        </p>
                        <p className="text-xs text-slate-500">{item.office}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => rejectAppointment(item.id)}
                        className="inline-flex items-center gap-1 text-rose-700 hover:text-rose-800 font-semibold text-xs bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 rounded-lg border border-rose-200 transition-colors"
                        title="Reject"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {item.isPriority && (
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 mt-1">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        Priority Lane (Approved)
                      </span>
                      {item.priorityImageUrl && (
                        <button
                          onClick={() => setSelectedImage(item.priorityImageUrl)}
                          className="inline-flex items-center gap-1 text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md border border-slate-300 shadow-2xs transition-colors"
                        >
                          <Eye className="w-3 h-3" />
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