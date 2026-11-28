
import {
  CalendarDays,
  Clock3,
  UserRound,
  Users,
  ClipboardList,
  BadgeCheck,
  AlertCircle,
  Flag,
  XCircle,
  Loader2,
} from "lucide-react";

const PHILIPPINE_TIME_ZONE = "Asia/Manila";

const getManilaDateKey = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PHILIPPINE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const value = (type) =>
    parts.find((part) => part.type === type)?.value || "";

  return `${value("year")}-${value("month")}-${value("day")}`;
};

// Get the effective appointment date.
// Rescheduled appointments use their rescheduled date.
const getScheduledDate = (item) => {
  return (
    item?.rescheduledToDate ||
    item?.appointmentDate ||
    ""
  );
};

// Get the effective appointment time.
const getScheduledTime = (item) => {
  return (
    item?.rescheduledToTime ||
    item?.appointmentTime ||
    ""
  );
};

// Normalize appointment status.
const getStatus = (item) =>
  String(item?.status || item?.appointmentStatus || "pending")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

// Check whether the appointment belongs to the requested office.
const belongsToOffice = (item, officeName) => {
  const appointmentOffice = String(
    item?.office ||
    item?.officeName ||
    item?.department ||
    ""
  )
    .trim()
    .toLowerCase();

  const requestedOffice = String(officeName || "")
    .trim()
    .toLowerCase();

  if (!appointmentOffice || !requestedOffice) {
    return false;
  }

  return (
    appointmentOffice === requestedOffice ||
    appointmentOffice.startsWith(`${requestedOffice} -`) ||
    appointmentOffice.startsWith(`${requestedOffice} `) ||
    appointmentOffice.includes(requestedOffice)
  );
};

// Only appointments from tomorrow onward belong here.
const isValidFutureAppointment = (item, todayKey) => {
  const appointmentDate = getScheduledDate(item);

  if (
    typeof appointmentDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)
  ) {
    return false;
  }

  const status = getStatus(item);

  if (
    [
      "completed",
      "rejected",
      "cancelled",
      "canceled",
    ].includes(status)
  ) {
    return false;
  }

  // Exclude today's appointments.
  // Today's later hours belong in later.jsx.
  return appointmentDate > todayKey;
};

// Extract selected services from different appointment formats.
const getAppointmentServices = (item) => {
  const services = [];

  const addService = (value) => {
    if (typeof value === "string") {
      const name = value.trim();

      if (name) services.push(name);

      return;
    }

    if (value && typeof value === "object") {
      const name =
        value.serviceName ||
        value.name ||
        value.label ||
        value.service ||
        value.title;

      if (typeof name === "string" && name.trim()) {
        services.push(name.trim());
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

  if (typeof item?.service === "string" && item.service.trim()) {
    item.service.split(",").forEach(addService);
  }

  if (typeof item?.serviceName === "string" && item.serviceName.trim()) {
    addService(item.serviceName);
  }

  return [...new Set(services)];
};

// Get assigned staff from selected services.
const getAssignedStaff = (item) => {
  const staff = [];

  const addStaff = (value) => {
    if (!value || typeof value !== "object") return;

    const name =
      value.assignedStaffName ||
      value.staffName ||
      value.staff?.name;

    if (typeof name === "string" && name.trim()) {
      staff.push(name.trim());
    }
  };

  if (Array.isArray(item?.services)) {
    item.services.forEach(addStaff);
  }

  if (Array.isArray(item?.selectedServices)) {
    item.selectedServices.forEach(addStaff);
  }

  if (item?.assignedStaffName) {
    staff.push(String(item.assignedStaffName).trim());
  }

  return [...new Set(staff)].filter(Boolean);
};

// Format appointment date.
const formatAppointmentDate = (dateString) => {
  if (!dateString) return "Date not specified";

  const match = String(dateString).match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (!match) return dateString;

  const [, year, month, day] = match;

  const date = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      12,
      0,
      0
    )
  );

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: PHILIPPINE_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

// Get tomorrow's date key without relying on local browser timezone.
const getTomorrowDateKey = (todayKey) => {
  const [year, month, day] = todayKey.split("-").map(Number);

  const tomorrow = new Date(
    Date.UTC(year, month - 1, day + 1, 12, 0, 0)
  );

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PHILIPPINE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(tomorrow);

  const value = (type) =>
    parts.find((part) => part.type === type)?.value || "";

  return `${value("year")}-${value("month")}-${value("day")}`;
};

const getDateCategory = (dateString, todayKey) => {
  const tomorrowKey = getTomorrowDateKey(todayKey);

  if (dateString === tomorrowKey) return "Tomorrow";

  return "Upcoming";
};

// Get readable status label.
const getStatusLabel = (status) => {
  const normalized = getStatus({ status });

  if (["approved", "confirmed"].includes(normalized)) {
    return "Approved";
  }

  if (
    [
      "pending",
      "waiting",
      "approved - waiting",
      "approved-waiting",
    ].includes(normalized)
  ) {
    return normalized.includes("approved")
      ? "Approved - Waiting"
      : "Pending Approval";
  }

  if (["in-progress", "serving", "now-serving"].includes(normalized)) {
    return "In Progress";
  }

  return normalized
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

export default function Future({
  appointments = [],
  officeName = "SWDS",
  todayKey,
  onReject,
  processingId,
}) {
  const currentDateKey = todayKey || getManilaDateKey();

  // Keep only appointments belonging to this office
  // and scheduled for tomorrow or a later date.
  const futureAppointments = (appointments || [])
    .filter((item) => {
      return (
        belongsToOffice(item, officeName) &&
        isValidFutureAppointment(item, currentDateKey)
      );
    })
    .sort((a, b) => {
      const dateA = getScheduledDate(a);
      const dateB = getScheduledDate(b);

      const dateComparison = String(dateA).localeCompare(
        String(dateB)
      );

      if (dateComparison !== 0) return dateComparison;

      return String(getScheduledTime(a)).localeCompare(
        String(getScheduledTime(b))
      );
    });

  // Group appointments by their effective scheduled date.
  const groupedAppointments = futureAppointments.reduce(
    (groups, item) => {
      const date = getScheduledDate(item);

      if (!groups[date]) {
        groups[date] = [];
      }

      groups[date].push(item);

      return groups;
    },
    {}
  );

  return (
    <div className="mt-4 sm:mt-6 w-full bg-white rounded-2xl shadow-xs border border-slate-200 p-4 sm:p-6">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-indigo-600" />
            Future Appointments ({officeName})
          </h2>

          <p className="text-xs text-slate-500 mt-1">
            Approved and pending appointments scheduled for tomorrow and upcoming dates.
          </p>
        </div>

        <span className="self-start sm:self-auto text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1.5 rounded-lg">
          {futureAppointments.length} Appointment
          {futureAppointments.length !== 1 ? "s" : ""}
        </span>
      </div>

      {futureAppointments.length === 0 ? (
        <div className="py-10 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50">
          <CalendarDays className="w-10 h-10 text-slate-300 mx-auto mb-3" />

          <p className="text-sm font-semibold text-slate-600">
            No future appointments
          </p>

          <p className="text-xs text-slate-400 mt-1">
            Appointments scheduled for tomorrow and later will appear here.
          </p>
        </div>
      ) : (
        <div className="max-h-[450px] overflow-y-auto overflow-x-hidden overscroll-contain pr-2 space-y-6 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
          {Object.entries(groupedAppointments).map(([date, items]) => (
            <div key={date}>
              <div className="flex items-center gap-2 mb-3 sticky top-0 z-10 bg-white/95 backdrop-blur-sm py-2">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-50">
                  <CalendarDays className="w-4 h-4 text-indigo-600" />
                </div>

                <div>
                  <p className="text-sm font-bold text-slate-800">
                    {formatAppointmentDate(date)}
                  </p>

                  <p className="text-xs text-slate-500">
                    {getDateCategory(date, currentDateKey)} · {items.length} appointment
                    {items.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {items.map((item) => {
                  const services = getAppointmentServices(item);
                  const assignedStaff = getAssignedStaff(item);
                  const status = getStatus(item);

                  const approved = [
                    "approved",
                    "confirmed",
                  ].includes(status);

                  const scheduledTime = getScheduledTime(item);

                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4 hover:bg-slate-100/60 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-10 h-10 shrink-0 rounded-full bg-white border border-slate-200 overflow-hidden flex items-center justify-center">
                            {item.userPhoto ? (
                              <img
                                src={item.userPhoto}
                                alt={item.userName || "Student"}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <UserRound className="w-5 h-5 text-slate-400" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="font-bold text-sm text-slate-900 break-words">
                              {item.userName || "Unknown Student"}
                            </p>

                            <p className="text-xs text-slate-500 break-all mt-0.5">
                              {item.userEmail || item.email || "No email available"}
                            </p>

                            {item.queueNumber && (
                              <p className="text-xs font-mono font-semibold text-slate-700 mt-1">
                                Queue: {item.queueNumber}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                              approved
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}
                          >
                            {approved ? (
                              <BadgeCheck className="w-3 h-3" />
                            ) : (
                              <AlertCircle className="w-3 h-3" />
                            )}

                            {getStatusLabel(status)}
                          </span>

                          {item.isPriority === true && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <Flag className="w-3 h-3" />
                              Priority
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-200">
                        <div className="flex items-start gap-2">
                          <Clock3 className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />

                          <div>
                            <p className="text-[10px] uppercase tracking-wide font-bold text-slate-400">
                              Appointment Time
                            </p>

                            <p className="text-xs font-semibold text-slate-800 mt-0.5">
                              {scheduledTime || "Time not specified"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <ClipboardList className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />

                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-wide font-bold text-slate-400">
                              Services
                            </p>

                            <p className="text-xs font-semibold text-slate-800 mt-0.5 break-words">
                              {services.length
                                ? services.join(", ")
                                : item.reason || "Appointment"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2 sm:col-span-2">
                          <Users className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />

                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-wide font-bold text-slate-400">
                              Assigned Staff
                            </p>

                            <p className="text-xs font-semibold text-slate-800 mt-0.5 break-words">
                              {assignedStaff.length
                                ? assignedStaff.join(", ")
                                : "Not yet assigned"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {item.reason && (
                        <div className="mt-3 rounded-lg bg-white border border-slate-200 p-3">
                          <p className="text-[10px] uppercase tracking-wide font-bold text-slate-400 mb-1">
                            Reason for Visit
                          </p>

                          <p className="text-xs text-slate-700 break-words whitespace-pre-wrap">
                            {item.reason}
                          </p>
                        </div>
                      )}

                      {/* Postpone Appointment */}
                      <div className="mt-3 pt-3 border-t border-slate-200 flex justify-end">
                        <button
                          type="button"
                          onClick={() => onReject?.(item)}
                          disabled={
                            Boolean(processingId) ||
                            !onReject
                          }
                          className="inline-flex items-center gap-1 text-rose-700 hover:text-rose-800 font-semibold text-xs bg-rose-50 hover:bg-rose-100 px-3 py-2 rounded-lg border border-rose-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Postpone with reason"
                        >
                          {processingId === item.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                          Postpone
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
