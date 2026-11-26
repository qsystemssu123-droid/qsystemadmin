
import {
  CheckCircle2,
  XCircle,
  Eye,
  ShieldAlert,
  Loader2,
  Clock3,
} from "lucide-react";

// Display the student's actual reason separately from the selected service.
export function ReasonForVisit({ item, className = "" }) {
  const reason =
    typeof item?.reason === "string" ? item.reason.trim() : "";

  return (
    <div
      className={`w-full min-w-0 rounded-lg border border-blue-100 bg-blue-50/70 p-3 text-left ${className}`}
    >
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-blue-700">
        Reason for Visit
      </p>

      <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-700">
        {reason || "No reason provided"}
      </p>
    </div>
  );
}

// View priority ID image.
export function ViewPriorityImage({
  item,
  compact = false,
  setSelectedImage,
}) {
  if (!item?.priorityImageUrl) return null;

  return (
    <button
      type="button"
      onClick={() =>
        setSelectedImage?.(item.priorityImageUrl)
      }
      className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-300 transition-colors"
    >
      <Eye className="w-3.5 h-3.5" />
      {compact ? "View ID" : "View ID Image"}
    </button>
  );
}

// Pending appointment card.
function PendingCard({
  item,
  processingId,
  onAccept,
  onReject,
  setSelectedImage,
}) {
  const busy = processingId === item.id;

  return (
    <div className="flex flex-col p-3 sm:p-3.5 bg-amber-50/40 rounded-xl border border-amber-200/70 hover:bg-amber-50 transition-colors gap-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono font-bold text-amber-700 bg-white px-2.5 py-1 rounded-md border border-amber-200 text-xs shrink-0">
            Pending
          </span>

          <div className="min-w-0">
            <p className="font-semibold text-slate-900 text-sm truncate">
              {item.userName || "Unknown Student"}
            </p>

            <p className="text-xs text-slate-500">
              {item.office} - {getServiceLabel(item)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => onAccept(item)}
            disabled={Boolean(processingId)}
            className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold text-xs bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg border border-emerald-200 transition-colors disabled:opacity-50"
            title="Accept and assign queue number"
          >
            {busy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}

            {busy ? "Accepting..." : "Accept"}
          </button>

          <button
            type="button"
            onClick={() => onReject(item)}
            disabled={Boolean(processingId)}
            className="inline-flex items-center gap-1 text-rose-700 hover:text-rose-800 font-semibold text-xs bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 rounded-lg border border-rose-200 transition-colors disabled:opacity-50"
            title="Reject with reason"
          >
            <XCircle className="w-3.5 h-3.5" />
            Postponed
          </button>
        </div>
      </div>

      <ReasonForVisit item={item} />

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-amber-200/50">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
          <Clock3 className="w-3 h-3" />
          Awaiting Staff Acceptance
        </span>

        {item.isPriority && (
          <span className="text-[10px] font-bold text-amber-700">
            Priority Lane
          </span>
        )}

        <ViewPriorityImage
          item={item}
          setSelectedImage={setSelectedImage}
        />
      </div>
    </div>
  );
}

// Get the selected service names for display.
const getAppointmentServices = (item) => {
  const services = [];

  const addService = (value) => {
    if (typeof value === "string") {
      const normalized = value.trim();

      if (normalized) {
        services.push(normalized);
      }

      return;
    }

    if (value && typeof value === "object") {
      const serviceName =
        value.serviceName ||
        value.name ||
        value.label ||
        value.service ||
        value.title;

      if (
        typeof serviceName === "string" &&
        serviceName.trim()
      ) {
        services.push(serviceName.trim());
      }
    }
  };

  if (Array.isArray(item?.services)) {
    item.services.forEach(addService);
  }

  if (Array.isArray(item?.selectedServices)) {
    item.selectedServices.forEach(addService);
  }

  if (Array.isArray(item?.serviceNames)) {
    item.serviceNames.forEach(addService);
  }

  if (
    typeof item?.service === "string" &&
    item.service.trim()
  ) {
    item.service.split(",").forEach(addService);
  }

  if (
    typeof item?.serviceName === "string" &&
    item.serviceName.trim()
  ) {
    addService(item.serviceName);
  }

  return [...new Set(services)];
};

const getServiceLabel = (item) => {
  const services = getAppointmentServices(item);

  return services.length
    ? services.join(", ")
    : item?.reason || "Appointment";
};

// Reusable Pending component.
export default function Pending({
  officeName = "SWDS",
  priorityLaneQueue = [],
  normalPendingAppointments = [],
  processingId,
  onAccept,
  onReject,
  setSelectedImage,
}) {
  return (
    <>
      {/* Priority Pending Lineup */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-xs border border-amber-200/60 flex flex-col justify-between">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
              Priority Lineup ({officeName})
            </h2>

            <span className="self-start sm:self-auto text-xs font-semibold bg-amber-50 text-amber-700 px-2 py-1 rounded-lg border border-amber-200">
              {priorityLaneQueue.length} Pending
            </span>
          </div>

          <p className="text-xs text-slate-500 mb-4">
            Priority counseling bookings remain pending until staff accepts them and assigns a queue number.
          </p>

          {priorityLaneQueue.length === 0 ? (
            <div className="py-8 sm:py-12 text-center">
              <p className="text-slate-500 text-sm font-medium px-2">
                No pending priority counseling bookings for {officeName}.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[350px] sm:max-h-[380px] overflow-y-auto pr-1">
              {priorityLaneQueue.map((item) => (
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
      </div>

      {/* Normal Pending Appointments */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-xs border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
            <Clock3 className="w-5 h-5 text-amber-600 shrink-0" />
            Guidance & Counseling Services ({officeName})
          </h2>

          <span className="self-start sm:self-auto text-xs font-semibold bg-amber-50 text-amber-700 px-2 py-1 rounded-lg border border-amber-200">
            {normalPendingAppointments.length} Pending
          </span>
        </div>

        <p className="text-xs text-slate-500 mb-4">
          Only bookings that include Guidance & Counseling Services or Guidance and Counseling Services require staff confirmation. Other services are automatically queued.
        </p>

        {normalPendingAppointments.length === 0 ? (
          <div className="py-8 sm:py-12 text-center">
            <p className="text-slate-500 text-sm font-medium">
              No pending regular counseling appointments for {officeName}.
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {normalPendingAppointments.map((item) => (
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
    </>
  );
}
