
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Globe,
  Footprints,
  CalendarCheck,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import {
  collection,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../services/firebase";

const OFFICE_NAME = "SWDS";

// Normalize booking values to handle different formats.
const normalizeBookingValue = (value) => {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
};

// Identify whether an appointment is Online or Walk-In.
const getBookingChannel = (booking) => {
  if (!booking || typeof booking !== "object") {
    return "online";
  }

  const bookingValues = [
    booking.bookingType,
    booking.bookingMode,
    booking.source,
    booking.channel,
    booking.type,
    booking.appointmentType,
    booking.registrationType,
  ];

  const normalizedValues = bookingValues
    .filter(Boolean)
    .map(normalizeBookingValue);

  const isWalkIn =
    booking.isWalkIn === true ||
    normalizedValues.some(
      (value) =>
        value.includes("walk-in") ||
        value.includes("walkin")
    ) ||
    Boolean(
      booking.registeredBy ||
      booking.registeredByEmail
    );

  return isWalkIn ? "walk-in" : "online";
};

// Determine whether a record belongs to SWDS.
// Records without an office field are retained because the parent
// may already be supplying office-specific appointment records.
const isSWDSAppointment = (appointment) => {
  if (!appointment || typeof appointment !== "object") {
    return false;
  }

  const officeValue =
    appointment.office ||
    appointment.officeName ||
    appointment.department ||
    appointment.departmentName ||
    "";

  if (!String(officeValue).trim()) {
    return true;
  }

  const normalizedOffice = String(officeValue)
    .trim()
    .toLowerCase();

  return (
    normalizedOffice === "swds" ||
    normalizedOffice.includes("student welfare and development services") ||
    normalizedOffice.includes("student welfare & development services") ||
    normalizedOffice.includes("student welfare")
  );
};

export default function OfficeDistribution({
  appointments,
}) {
  const [firestoreAppointments, setFirestoreAppointments] = useState([]);

  const [firestoreState, setFirestoreState] = useState({
    status: "loading",
    error: "",
  });

  /*
   * Use the supplied appointments when they contain records.
   * If the parent supplies an empty array or no array, load directly
   * from Firestore instead of automatically displaying zero.
   */
  const hasProvidedAppointments =
    Array.isArray(appointments) &&
    appointments.length > 0;

  // Subscribe to Firestore when no usable appointment records are supplied.
  useEffect(() => {
    if (hasProvidedAppointments) {
      return undefined;
    }

    const unsubscribe = onSnapshot(
      collection(db, "appointments"),
      (snapshot) => {
        const records = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        }));

        setFirestoreAppointments(records);

        setFirestoreState({
          status: "success",
          error: "",
        });
      },
      (error) => {
        console.error(
          "Failed to load office distribution appointments:",
          error
        );

        setFirestoreState({
          status: "error",
          error:
            error?.message ||
            "Unable to load appointment records. Please try again.",
        });
      }
    );

    return () => unsubscribe();
  }, [hasProvidedAppointments]);

  // Use supplied records or the live Firestore records.
  const sourceAppointments = hasProvidedAppointments
    ? appointments
    : firestoreAppointments;

  // Include all SWDS appointment records, regardless of status.
  const safeAppointments = useMemo(() => {
    if (!Array.isArray(sourceAppointments)) {
      return [];
    }

    return sourceAppointments.filter(isSWDSAppointment);
  }, [sourceAppointments]);

  // Count ALL appointment records.
  // No status filtering is performed.
  const totalBookings = safeAppointments.length;

  const onlineCount = safeAppointments.filter(
    (appointment) =>
      getBookingChannel(appointment) === "online"
  ).length;

  const walkInCount = safeAppointments.filter(
    (appointment) =>
      getBookingChannel(appointment) === "walk-in"
  ).length;

  const bookingChannels = [
    {
      name: "Online Appointments",
      count: onlineCount,
      icon: Globe,
      color: "bg-sky-600",
      iconColor: "text-sky-600",
      background: "bg-sky-50",
      border: "border-sky-100",
    },
    {
      name: "Walk-In Appointments",
      count: walkInCount,
      icon: Footprints,
      color: "bg-violet-600",
      iconColor: "text-violet-600",
      background: "bg-violet-50",
      border: "border-violet-100",
    },
  ];

  // Loading state when retrieving records directly from Firestore.
  if (
    !hasProvidedAppointments &&
    firestoreState.status === "loading"
  ) {
    return (
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-sky-100 flex flex-col justify-between">
        <div className="flex items-center justify-between mb-6 gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Booking Channel Distribution
            </h2>

            <p className="text-xs text-slate-500 mt-1">
              Online vs. walk-in appointments
            </p>
          </div>

          <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
            Loading data
          </span>
        </div>

        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-sky-600 animate-spin" />

          <p className="text-sm font-medium text-slate-500 mt-3">
            Loading SWDS booking records...
          </p>
        </div>

        <div className="mt-6 pt-4 border-t border-sky-100 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-sky-600" />
            {OFFICE_NAME}
          </span>
        </div>
      </div>
    );
  }

  // Error state when Firestore cannot load the records.
  if (
    !hasProvidedAppointments &&
    firestoreState.status === "error"
  ) {
    return (
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-rose-100 flex flex-col justify-between">
        <div className="flex items-center justify-between mb-6 gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Booking Channel Distribution
            </h2>

            <p className="text-xs text-slate-500 mt-1">
              Online vs. walk-in appointments
            </p>
          </div>

          <AlertCircle className="w-5 h-5 text-rose-500" />
        </div>

        <div className="py-6 text-center">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />

          <p className="text-sm font-bold text-slate-800 mt-3">
            Unable to Load Booking Records
          </p>

          <p className="text-xs text-slate-500 mt-2 break-words">
            {firestoreState.error}
          </p>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-sky-700"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reload
          </button>
        </div>

        <div className="mt-6 pt-4 border-t border-rose-100 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-sky-600" />
            {OFFICE_NAME}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-xs border border-sky-100 flex flex-col justify-between transition-all duration-300 hover:shadow-md">
      <div>
        <div className="flex items-center justify-between mb-6 gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Booking Channel Distribution
            </h2>

            <p className="text-xs text-slate-500 mt-1">
              Online vs. walk-in appointments
            </p>
          </div>

          <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
            Real-time share
          </span>
        </div>

        {/* Total Bookings */}
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-100 transition-all duration-300 hover:shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-600">
                Total Bookings
              </p>

              <p className="text-3xl font-bold text-slate-900 mt-1 tabular-nums">
                {totalBookings.toLocaleString()}
              </p>

              <p className="text-xs text-slate-500 mt-1">
                All recorded bookings, regardless of status
              </p>
            </div>

            <div className="w-12 h-12 rounded-xl bg-white border border-sky-100 flex items-center justify-center shadow-sm">
              <CalendarCheck className="w-6 h-6 text-sky-600" />
            </div>
          </div>
        </div>

        {/* Booking Channel Breakdown */}
        <div className="space-y-5">
          {bookingChannels.map((channel, idx) => {
            const percentage =
              totalBookings > 0
                ? Math.round(
                    (channel.count / totalBookings) * 100
                  )
                : 0;

            const Icon = channel.icon;

            return (
              <div
                key={channel.name}
                className="space-y-2 transition-all duration-300 hover:translate-x-1"
              >
                <div className="flex justify-between items-center gap-3 text-sm font-medium">
                  <span className="text-slate-700 flex items-center gap-2 min-w-0">
                    <span
                      className={`w-8 h-8 rounded-lg ${channel.background} flex items-center justify-center shrink-0`}
                    >
                      <Icon
                        className={`w-4 h-4 ${channel.iconColor}`}
                      />
                    </span>

                    <span className="break-words">
                      {channel.name}
                    </span>
                  </span>

                  <span className="text-slate-900 font-semibold text-right whitespace-nowrap">
                    {channel.count.toLocaleString()} ({percentage}%)
                  </span>
                </div>

                <div
                  className={`w-full h-3 ${channel.background} rounded-full overflow-hidden border ${channel.border}`}
                >
                  <div
                    className={`h-full ${channel.color} rounded-full transition-all duration-1000 ease-out`}
                    style={{
                      width: `${percentage}%`,
                      transitionDelay: `${idx * 150}ms`,
                    }}
                  />
                </div>
              </div>
            );
          })}

          {totalBookings === 0 && (
            <p className="text-sm text-slate-500 py-4 text-center animate-pulse">
              No booking channel metrics recorded yet.
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-sky-100 flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5 text-sky-600" />
          SWDS
        </span>

        <span className="font-semibold text-sky-700 animate-pulse">
          Updated Live
        </span>
      </div>
    </div>
  );
}
