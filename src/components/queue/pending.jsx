import { Clock3 } from "lucide-react";

import { PendingCard } from "./priority";

// Reusable Pending Appointments component.
export default function Pending({
  officeName = "SWDS",
  normalPendingAppointments = [],
  processingId,
  onAccept,
  onReject,
  setSelectedImage,
}) {
  const pendingList = Array.isArray(normalPendingAppointments)
    ? normalPendingAppointments
    : [];

  return (
    <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-xs border border-slate-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
        <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
          <Clock3 className="w-5 h-5 text-amber-600 shrink-0" />
          Pending Appointments ({officeName})
        </h2>

        <span className="self-start sm:self-auto text-xs font-semibold bg-amber-50 text-amber-700 px-2 py-1 rounded-lg border border-amber-200">
          {pendingList.length} Pending
        </span>
      </div>

      <p className="text-xs text-slate-500 mb-4">
        Only bookings that include Guidance &amp; Counseling Services or
        Guidance and Counseling Services require staff confirmation.
        Other services are automatically queued.
      </p>

      {pendingList.length === 0 ? (
        <div className="py-8 sm:py-12 text-center">
          <p className="text-slate-500 text-sm font-medium px-2">
            No pending Guidance &amp; Counseling appointments for {officeName}.
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
          {pendingList.map((item) => (
            <PendingCard
              key={item.id}
              item={item}
              processingId={processingId}
              onAccept={onAccept}
              onReject={onReject}
              setSelectedImage={setSelectedImage}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export {
  ReasonForVisit,
  ViewPriorityImage,
} from "./priority";