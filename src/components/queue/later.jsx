import { useEffect, useState } from "react";

import {
  Clock,
  CalendarDays,
  User,
  ClipboardList,
  AlertCircle,
  Star,
} from "lucide-react";

// Philippine timezone
const PHILIPPINE_TIME_ZONE = "Asia/Manila";

// Get the current Philippine date and time.
const getManilaDateTime = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PHILIPPINE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const value = (type) =>
    parts.find((part) => part.type === type)?.value || "";

  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    minutes: Number(value("hour")) * 60 + Number(value("minute")),
  };
};

// Get the effective scheduled date.
const getScheduledDate = (item) => {
  return (
    item?.rescheduledToDate ||
    item?.appointmentDate ||
    ""
  );
};

// Get the effective scheduled time.
const getScheduledTime = (item) => {
  return (
    item?.rescheduledToTime ||
    item?.appointmentTime ||
    ""
  );
};

// Convert appointment time into minutes after midnight.
// Supports 08:00 AM, 1:00 PM, 13:00, and 08:00.
const convertTimeToMinutes = (time) => {
  if (typeof time !== "string" || !time.trim()) {
    return null;
  }

  const normalized = time.trim().toUpperCase();

  const twelveHourMatch = normalized.match(
    /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/
  );

  if (twelveHourMatch) {
    let hours = Number(twelveHourMatch[1]);
    const minutes = Number(twelveHourMatch[2]);
    const period = twelveHourMatch[3];

    if (
      hours < 1 ||
      hours > 12 ||
      minutes < 0 ||
      minutes > 59
    ) {
      return null;
    }

    if (period === "AM") {
      if (hours === 12) hours = 0;
    } else {
      if (hours !== 12) hours += 12;
    }

    return hours * 60 + minutes;
  }

  const twentyFourHourMatch = normalized.match(
    /^(\d{1,2}):(\d{2})(?::\d{2})?$/
  );

  if (twentyFourHourMatch) {
    const hours = Number(twentyFourHourMatch[1]);
    const minutes = Number(twentyFourHourMatch[2]);

    if (
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      return null;
    }

    return hours * 60 + minutes;
  }

  return null;
};

// Normalize appointment status.
const getStatus = (item) =>
  String(item?.status || item?.appointmentStatus || "pending")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

// Include appointments with the actual "Approved - Waiting" status.
const isPending = (item) => {
  const status = getStatus(item);

  return [
    "pending",
    "waiting",
    "approved - waiting",
    "approved-waiting",
  ].includes(status);
};

// Check whether an appointment is scheduled for a later hour TODAY.
//
// IMPORTANT:
// This component only displays appointments scheduled for today.
// Appointments scheduled tomorrow or beyond belong in future.jsx.
const isLaterTodayAppointment = (item, currentDateTime) => {
  const scheduledDate = getScheduledDate(item);
  const scheduledTime = getScheduledTime(item);

  if (!scheduledDate || !scheduledTime) {
    return false;
  }

  // Exclude tomorrow and all other future dates.
  if (scheduledDate !== currentDateTime.date) {
    return false;
  }

  const scheduledMinutes = convertTimeToMinutes(scheduledTime);

  if (scheduledMinutes === null) {
    return false;
  }

  // Only show appointments whose scheduled time is later than now.
  return scheduledMinutes > currentDateTime.minutes;
};

// Check whether the appointment belongs to the requested office.
// Supports both "SWDS" and "SWDS - Admission and Recruitment Services".
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

// Extract selected services from different appointment formats.
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

  if (typeof item?.service === "string" && item.service.trim()) {
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

// Sort appointments by their scheduled time.
const sortByScheduledTime = (a, b) => {
  const timeA =
    convertTimeToMinutes(getScheduledTime(a)) ?? 0;

  const timeB =
    convertTimeToMinutes(getScheduledTime(b)) ?? 0;

  return timeA - timeB;
};

// Format the date for display without changing the stored value.
const formatScheduledDate = (dateString) => {
  if (!dateString) return "Date not specified";

  const match = String(dateString).match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (!match) return dateString;

  const [, year, month, day] = match;

  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
  );

  return date.toLocaleDateString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

export default function Later({
  appointments = [],
  officeName = "SWDS",
}) {
  const [currentDateTime, setCurrentDateTime] = useState(
    () => getManilaDateTime()
  );

  // Refresh Philippine time so appointments automatically
  // leave this list when their scheduled time arrives.
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDateTime(getManilaDateTime());
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  // Keep only pending appointments scheduled for a later hour TODAY.
  // Tomorrow and later dates are handled by future.jsx.
  const laterAppointments = (appointments || [])
    .filter((item) => {
      return (
        belongsToOffice(item, officeName) &&
        isPending(item) &&
        isLaterTodayAppointment(item, currentDateTime)
      );
    })
    .sort(sortByScheduledTime);

  return (
    <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-4 sm:p-6 w-full">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            Later Appointments ({officeName})
          </h2>

          <p className="text-xs text-slate-500 mt-1">
            Pending appointments scheduled for later hours today.
          </p>
        </div>

        <span className="self-start sm:self-auto inline-flex items-center gap-1.5 text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1.5 rounded-lg">
          <Clock className="w-3.5 h-3.5" />
          {laterAppointments.length} Pending
        </span>
      </div>

      {/* Appointment List */}
      {laterAppointments.length === 0 ? (
        <div className="py-8 sm:py-10 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50">
          <CalendarDays className="w-10 h-10 text-slate-300 mx-auto mb-3" />

          <p className="text-sm font-semibold text-slate-600">
            No later appointments today
          </p>

          <p className="text-xs text-slate-400 mt-1 px-3">
            Pending appointments scheduled for later hours today will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto overflow-x-hidden overscroll-contain pr-2">
          {laterAppointments.map((item) => {
            const scheduledDate = getScheduledDate(item);
            const scheduledTime = getScheduledTime(item);

            const isRescheduled =
              Boolean(item?.rescheduledToDate) ||
              Boolean(item?.rescheduledToTime);

            return (
              <div
                key={item.id}
                className="flex flex-col gap-3 p-3 sm:p-4 rounded-xl border border-indigo-100 bg-indigo-50/40 hover:bg-indigo-50/70 transition-colors"
              >

                {/* Student and Status */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 shrink-0 rounded-xl bg-indigo-100 flex items-center justify-center">
                      <User className="w-4 h-4 text-indigo-700" />
                    </div>

                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 text-sm break-words">
                        {item.userName ||
                          item.studentName ||
                          item.fullName ||
                          "Unknown Student"}
                      </p>

                      <p className="text-xs text-slate-500 mt-0.5">
                        {item.office || item.officeName || officeName}
                      </p>

                      {(item.appointmentNumber ||
                        item.referenceNumber ||
                        item.queueNumber ||
                        item.id) && (
                        <p className="text-xs font-semibold text-indigo-600 mt-1">
                          {item.appointmentNumber ||
                            item.referenceNumber ||
                            item.queueNumber ||
                            item.id}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      <AlertCircle className="w-3 h-3" />
                      {getStatus(item) === "approved - waiting" ||
                      getStatus(item) === "approved-waiting"
                        ? "Approved - Waiting"
                        : "Pending"}
                    </span>

                    {item.isPriority === true && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
                        <Star className="w-3 h-3" />
                        Priority
                      </span>
                    )}
                  </div>
                </div>

                {/* Scheduled Date and Time */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 rounded-lg bg-white border border-indigo-100 p-3">
                    <CalendarDays className="w-4 h-4 text-indigo-600 shrink-0" />

                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-400">
                        Appointment Date
                      </p>

                      <p className="text-xs font-bold text-slate-800 break-words">
                        {formatScheduledDate(scheduledDate)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-lg bg-white border border-indigo-100 p-3">
                    <Clock className="w-4 h-4 text-indigo-600 shrink-0" />

                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-400">
                        Appointment Time
                      </p>

                      <p className="text-xs font-bold text-slate-800">
                        {scheduledTime || "Time not specified"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Services */}
                <div className="flex items-start gap-2 pt-2 border-t border-indigo-100">
                  <ClipboardList className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />

                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-400 mb-1">
                      Selected Services
                    </p>

                    <p className="text-xs font-medium text-slate-700 break-words">
                      {getServiceLabel(item)}
                    </p>
                  </div>
                </div>

                {/* Reason for Visit */}
                {item.reason && (
                  <div className="flex items-start gap-2">
                    <ClipboardList className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />

                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-400 mb-1">
                        Reason for Visit
                      </p>

                      <p className="text-xs font-medium text-slate-700 break-words">
                        {item.reason}
                      </p>
                    </div>
                  </div>
                )}

                {/* Rescheduled Indicator */}
                {isRescheduled && (
                  <div className="text-[10px] font-semibold text-indigo-700 bg-indigo-100/70 rounded-lg px-3 py-2">
                    This appointment has been rescheduled.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      {laterAppointments.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-100">
          <p className="text-[11px] text-slate-400">
            These appointments remain pending until their scheduled time arrives.
          </p>
        </div>
      )}
    </div>
  );
}