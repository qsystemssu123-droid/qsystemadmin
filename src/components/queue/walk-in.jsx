
import { useState } from "react";
import {
  UserPlus,
  X,
  Check,
  Loader2,
  XCircle,
} from "lucide-react";
import {
  doc,
  collection,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../../services/firebase";

const SWDS_SERVICES = [
  "Guidance & Counseling Services",
  "Services for Students with Special Needs & PWDs",
  "Psychological & Wellness Services",
  "Information & Orientation Services",
  "Economic Enterprise Development",
  "Career & Placement Services / PESO",
  "Admission & Recruitment Services",
  "University Student Council",
  "Student Organizations",
  "Multi-Faith Services",
];

const OTHER_SERVICE = "Others";
const OFFICE_NAME = "SWDS";
const PUBLIC_QUEUE_COLLECTION = "queues";
const PHILIPPINE_TIME_ZONE = "Asia/Manila";

// Generate a unique feedback reference for each appointment.
const generateFeedbackReference = () => {
  if (
    typeof globalThis !== "undefined" &&
    globalThis.crypto &&
    typeof globalThis.crypto.getRandomValues === "function"
  ) {
    const bytes = new Uint8Array(24);
    globalThis.crypto.getRandomValues(bytes);

    return Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  // Fallback for environments without crypto.getRandomValues.
  return `${Date.now().toString(16)}${Math.random()
    .toString(16)
    .slice(2)}${Math.random().toString(16).slice(2)}`;
};

// Get the current Philippine calendar date.
const getManilaDateKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PHILIPPINE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const value = (type) =>
    parts.find((part) => part.type === type)?.value || "";

  return `${value("year")}-${value("month")}-${value("day")}`;
};

// Supports existing appointment records.
const getAppointmentQueueDate = (item) => {
  if (typeof item?.queueDate === "string" && item.queueDate) {
    return item.queueDate;
  }

  const approvedAt = item?.approvedAt;

  const date =
    typeof approvedAt?.toDate === "function"
      ? approvedAt.toDate()
      : typeof approvedAt?.seconds === "number"
        ? new Date(approvedAt.seconds * 1000)
        : approvedAt instanceof Date
          ? approvedAt
          : approvedAt
            ? new Date(approvedAt)
            : null;

  return date && !Number.isNaN(date.getTime())
    ? getManilaDateKey(date)
    : null;
};

const isTicketForDay = (item, dateKey) =>
  getAppointmentQueueDate(item) === dateKey;

const readTickets = (data) =>
  Array.isArray(data?.tickets) ? data.tickets : [];

const withoutTicket = (tickets, appointmentId) =>
  tickets.filter(
    (ticket) => ticket.appointmentId !== appointmentId
  );

const publicTicket = (item, status, queueNumber) => ({
  appointmentId: item.id,
  queueNumber: String(queueNumber || item.queueNumber || ""),
  status,
  isPriority: item.isPriority === true,
  queuePosition: Number(item.queuePosition || 0),
});

export default function WalkIn({
  appointments = [],
  officeName = OFFICE_NAME,
}) {
  const [showWalkInModal, setShowWalkInModal] = useState(false);

  const [walkInName, setWalkInName] = useState("");
  const [walkInEmail, setWalkInEmail] = useState("");
  const [walkInServices, setWalkInServices] = useState([]);
  const [walkInOtherService, setWalkInOtherService] = useState("");
  const [walkInReason, setWalkInReason] = useState("");
  const [walkInPriority, setWalkInPriority] = useState(false);

  const [walkInSaving, setWalkInSaving] = useState(false);
  const [walkInError, setWalkInError] = useState("");
  const [walkInSuccess, setWalkInSuccess] = useState("");

  const clearWalkInMessages = () => {
    setWalkInError("");
    setWalkInSuccess("");
  };

  const closeWalkInModal = () => {
    if (walkInSaving) return;
    setShowWalkInModal(false);
    setWalkInError("");
  };

  // Multiple service selection, including Others.
  const handleWalkInServiceToggle = (service) => {
    setWalkInServices((previous) =>
      previous.includes(service)
        ? previous.filter((item) => item !== service)
        : [...previous, service]
    );

    if (service === OTHER_SERVICE) {
      setWalkInOtherService("");
    }

    if (walkInError) {
      setWalkInError("");
    }
  };

  // Register a walk-in and immediately assign a queue number.
  const handleRegisterWalkIn = async (event) => {
    event.preventDefault();

    if (walkInSaving) return;

    const name = walkInName.trim();
    const email = walkInEmail.trim().toLowerCase();

    const selectedServices = [
      ...new Set(
        walkInServices
          .filter(
            (service) =>
              typeof service === "string" &&
              service !== OTHER_SERVICE
          )
          .map((service) => service.trim())
          .filter(Boolean)
      ),
    ];

    const customService = walkInOtherService.trim();

    if (walkInServices.includes(OTHER_SERVICE)) {
      if (!customService) {
        setWalkInError(
          "Please enter the service requested under Others."
        );
        return;
      }

      selectedServices.push(`Others: ${customService}`);
    }

    const services = [...new Set(selectedServices)];
    const reason = walkInReason.trim();

    if (!name || !email || services.length === 0) {
      setWalkInError(
        "Student name, email address, and at least one service are required."
      );
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
      setWalkInError("Please enter a valid email address.");
      return;
    }

    if (email.length > 254) {
      setWalkInError(
        "The email address cannot exceed 254 characters."
      );
      return;
    }

    if (
      name.length > 120 ||
      services.some((service) => service.length > 150) ||
      reason.length > 500
    ) {
      setWalkInError(
        "Please shorten the information entered. Each service must not exceed 150 characters."
      );
      return;
    }

    const staff = auth.currentUser;

    if (!staff) {
      setWalkInError(
        "Your session has expired. Please log in again."
      );
      return;
    }

    setWalkInSaving(true);
    clearWalkInMessages();

    try {
      const appointmentRef = doc(
        collection(db, "appointments")
      );

      // Generate the reference before the transaction.
      // Firestore transaction retries will reuse the same reference.
      const feedbackReference = generateFeedbackReference();

      const counterRef = doc(
        db,
        "queue-counters",
        officeName
      );

      const publicQueueRef = doc(
        db,
        PUBLIC_QUEUE_COLLECTION,
        officeName
      );

      const queueNumber = await runTransaction(
        db,
        async (transaction) => {
          const counterSnapshot =
            await transaction.get(counterRef);

          const publicSnapshot =
            await transaction.get(publicQueueRef);

          const dateKey = getManilaDateKey();

          const counterData = counterSnapshot.exists()
            ? counterSnapshot.data()
            : {};

          const lastNumber =
            counterData.queueDate === dateKey
              ? Number(counterData.lastNumber || 0)
              : 0;

          // Include existing appointments when determining
          // the highest queue number for the current day.
          const highestToday = Math.max(
            0,
            ...appointments
              .filter((item) =>
                String(item?.office || "")
                  .trim()
                  .toLowerCase() === officeName.toLowerCase()
              )
              .filter((item) =>
                isTicketForDay(item, dateKey)
              )
              .map((item) => {
                const match = String(
                  item.queueNumber || ""
                ).match(/^SWDS-?(\d+)$/i);

                return match ? Number(match[1]) : 0;
              })
          );

          const nextNumber =
            Math.max(lastNumber, highestToday) + 1;

          const number = `SWDS-${String(
            nextNumber
          ).padStart(3, "0")}`;

          const walkIn = {
            office: officeName,

            userName: name,
            userEmail: email,

            services,
            service: services.join(", "),

            reason,

            status: "approved",

            source: "walk-in",
            bookingType: "walk-in",
            isWalkIn: true,

            // Required for personalized feedback links.
            feedbackReference,

            isPriority: walkInPriority,

            queueNumber: number,
            queuePosition: nextNumber,
            queueDate: dateKey,

            createdAt: serverTimestamp(),
            approvedAt: serverTimestamp(),

            approvedBy: staff.uid,
            approvedByEmail: staff.email || "",

            registeredBy: staff.uid,
            registeredByEmail: staff.email || "",
          };

          const publicData = publicSnapshot.exists()
            ? publicSnapshot.data()
            : {};

          const sameDay =
            publicData.queueDate === dateKey;

          const tickets = sameDay
            ? readTickets(publicData)
            : [];

          transaction.set(
            counterRef,
            {
              office: officeName,
              queueDate: dateKey,
              lastNumber: nextNumber,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          // Save the feedback reference in the appointment document.
          transaction.set(appointmentRef, walkIn);

          transaction.set(
            publicQueueRef,
            {
              office: officeName,
              queueDate: dateKey,

              nowServing: sameDay
                ? publicData.nowServing || ""
                : "",

              tickets: [
                ...withoutTicket(
                  tickets,
                  appointmentRef.id
                ),
                publicTicket(
                  {
                    ...walkIn,
                    id: appointmentRef.id,
                  },
                  "approved",
                  number
                ),
              ],

              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          return number;
        }
      );

      setShowWalkInModal(false);

      setWalkInName("");
      setWalkInEmail("");
      setWalkInServices([]);
      setWalkInOtherService("");
      setWalkInReason("");
      setWalkInPriority(false);
      setWalkInError("");

      setWalkInSuccess(
        `Walk-in registered successfully. Queue number ${queueNumber} assigned.`
      );
    } catch (error) {
      console.error("Failed to register walk-in:", error);

      setWalkInError(
        error?.message ||
          "Failed to register walk-in. Check Firestore permissions."
      );
    } finally {
      setWalkInSaving(false);
    }
  };

  return (
    <>
      {/* Walk-in registration trigger */}
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <UserPlus className="h-5 w-5 text-blue-600" />
            Walk-In Registration ({officeName})
          </h2>

          <p className="mt-1 text-xs text-slate-600">
            Register students without online appointments and assign a queue number immediately.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            clearWalkInMessages();
            setShowWalkInModal(true);
          }}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <UserPlus className="h-4 w-4" />
          Add Walk-In
        </button>
      </div>

      {/* Walk-in success message */}
      {walkInSuccess && (
        <div
          role="status"
          className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
        >
          <span>{walkInSuccess}</span>

          <button
            type="button"
            onClick={() => setWalkInSuccess("")}
            aria-label="Dismiss message"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Walk-in registration modal */}
      {showWalkInModal && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !walkInSaving
            ) {
              closeWalkInModal();
            }
          }}
        >
          <form
            onSubmit={handleRegisterWalkIn}
            role="dialog"
            aria-modal="true"
            aria-labelledby="swds-walkin-title"
            className="my-auto w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2
                  id="swds-walkin-title"
                  className="flex items-center gap-2 text-lg font-bold text-slate-900"
                >
                  <UserPlus className="h-5 w-5 text-blue-600" />
                  Register Walk-In
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  {officeName} • Queue number assigned automatically upon registration.
                </p>
              </div>

              <button
                type="button"
                aria-label="Close walk-in registration"
                disabled={walkInSaving}
                onClick={closeWalkInModal}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Student name */}
              <div>
                <label
                  htmlFor="walkin-name"
                  className="mb-1.5 block text-sm font-semibold text-slate-700"
                >
                  Student Name *
                </label>

                <input
                  id="walkin-name"
                  type="text"
                  required
                  maxLength={120}
                  value={walkInName}
                  onChange={(event) =>
                    setWalkInName(event.target.value)
                  }
                  disabled={walkInSaving}
                  placeholder="Enter student's full name"
                  autoComplete="name"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* Student email */}
              <div>
                <label
                  htmlFor="walkin-email"
                  className="mb-1.5 block text-sm font-semibold text-slate-700"
                >
                  Student Email Address *
                </label>

                <input
                  id="walkin-email"
                  type="email"
                  required
                  maxLength={254}
                  value={walkInEmail}
                  onChange={(event) => {
                    setWalkInEmail(event.target.value);

                    if (walkInError) {
                      setWalkInError("");
                    }
                  }}
                  disabled={walkInSaving}
                  placeholder="example@gmail.com"
                  autoComplete="email"
                  inputMode="email"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />

                <p className="mt-1 text-xs text-slate-500">
                  Enter the student's actual email address.
                </p>
              </div>

              {/* Multiple service selection */}
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    SWDS Services *
                  </label>

                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                    {walkInServices.length} Selected
                  </span>
                </div>

                <p className="mb-3 text-xs text-slate-500">
                  Select all services requested by the student. Choose Others if the requested service is not listed.
                </p>

                <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                  {[...SWDS_SERVICES, OTHER_SERVICE].map(
                    (service) => {
                      const selected =
                        walkInServices.includes(service);

                      return (
                        <label
                          key={service}
                          className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                            selected
                              ? "border-blue-300 bg-blue-50"
                              : "border-slate-200 bg-white hover:bg-slate-50"
                          } ${
                            walkInSaving
                              ? "cursor-not-allowed opacity-60"
                              : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() =>
                              handleWalkInServiceToggle(service)
                            }
                            disabled={walkInSaving}
                            className="sr-only"
                          />

                          <span
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                              selected
                                ? "border-blue-600 bg-blue-600 text-white"
                                : "border-slate-300 bg-white"
                            }`}
                          >
                            {selected && (
                              <Check className="h-3.5 w-3.5" />
                            )}
                          </span>

                          <span
                            className={`text-sm leading-relaxed ${
                              selected
                                ? "font-semibold text-blue-800"
                                : "text-slate-700"
                            }`}
                          >
                            {service}
                          </span>
                        </label>
                      );
                    }
                  )}
                </div>

                {/* Custom Others service */}
                {walkInServices.includes(OTHER_SERVICE) && (
                  <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50/60 p-3">
                    <label
                      htmlFor="walkin-other-service"
                      className="mb-1.5 block text-sm font-semibold text-blue-800"
                    >
                      Specify Other SWDS Service *
                    </label>

                    <input
                      id="walkin-other-service"
                      type="text"
                      required
                      maxLength={150}
                      value={walkInOtherService}
                      onChange={(event) => {
                        setWalkInOtherService(
                          event.target.value
                        );

                        if (walkInError) {
                          setWalkInError("");
                        }
                      }}
                      disabled={walkInSaving}
                      placeholder="Enter the service requested by the student"
                      className="w-full rounded-xl border border-blue-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />

                    <p className="mt-1.5 text-xs text-slate-500">
                      Describe the specific service the student needs from SWDS.
                    </p>
                  </div>
                )}

                {/* Selected service preview */}
                {walkInServices.length > 0 && (
                  <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/60 p-3">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-blue-700">
                      Selected Services
                    </p>

                    <div className="flex flex-wrap gap-1.5">
                      {walkInServices.map((service) => {
                        const displayService =
                          service === OTHER_SERVICE
                            ? walkInOtherService.trim()
                              ? `Others: ${walkInOtherService.trim()}`
                              : "Others (specify service)"
                            : service;

                        return (
                          <span
                            key={service}
                            className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-medium text-blue-800"
                          >
                            {displayService}

                            <button
                              type="button"
                              disabled={walkInSaving}
                              onClick={() =>
                                handleWalkInServiceToggle(service)
                              }
                              aria-label={`Remove ${service}`}
                              className="ml-1 rounded-full text-blue-500 hover:text-rose-600"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Reason for visit */}
              <div>
                <label
                  htmlFor="walkin-reason"
                  className="mb-1.5 block text-sm font-semibold text-slate-700"
                >
                  Reason for Visit
                </label>

                <textarea
                  id="walkin-reason"
                  rows={3}
                  maxLength={500}
                  value={walkInReason}
                  onChange={(event) =>
                    setWalkInReason(event.target.value)
                  }
                  disabled={walkInSaving}
                  placeholder="Optional additional details"
                  className="w-full resize-none rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* Priority lane */}
              <label className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={walkInPriority}
                  onChange={(event) =>
                    setWalkInPriority(event.target.checked)
                  }
                  disabled={walkInSaving}
                  className="h-4 w-4 accent-amber-600"
                />

                Priority lane (eligible PWD / senior citizen)
              </label>

              {/* Validation and Firestore errors */}
              {walkInError && (
                <p
                  role="alert"
                  className="rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700"
                >
                  {walkInError}
                </p>
              )}
            </div>

            {/* Modal actions */}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={walkInSaving}
                onClick={closeWalkInModal}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  walkInSaving ||
                  !walkInName.trim() ||
                  !walkInEmail.trim() ||
                  walkInServices.length === 0 ||
                  (
                    walkInServices.includes(OTHER_SERVICE) &&
                    !walkInOtherService.trim()
                  )
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {walkInSaving && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}

                {walkInSaving
                  ? "Registering..."
                  : "Register & Assign Queue"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
