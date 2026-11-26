
import { useEffect, useState, useRef } from "react";
import emailjs from "@emailjs/browser";

import {
  CheckCircle2,
  XCircle,
  CheckCheck,
  Users,
  Eye,
  ShieldAlert,
  AlertTriangle,
  Loader2,
  Clock3,
  Play,
} from "lucide-react";

import {
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "../../services/firebase";
import WalkIn from "./walk-in";

const OFFICE_NAME = "SWDS";
const PUBLIC_QUEUE_COLLECTION = "queues";
const PHILIPPINE_TIME_ZONE = "Asia/Manila";

// Both service names require staff confirmation.
const COUNSELING_SERVICES = [
  "Guidance & Counseling Services",
  "Guidance and Counseling Services",
];

// EmailJS configuration
const EMAILJS_SERVICE_ID = "service_20wm2tz";
const EMAILJS_TEMPLATE_ID = "template_f57ki9i";
const EMAILJS_PUBLIC_KEY = "P8vS1-WoC60N-hGPD";

const FEEDBACK_LINK =
  "https://qsystem-admin.netlify.app/public-feedback";

// Normalize service names before comparing them.
const normalizeServiceName = (value) =>
  typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").toLowerCase()
    : "";

// Supports both old single-service records and the updated
// mobile app's multiple-service object structure.
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

  // Updated mobile app: services is an array of service objects.
  if (Array.isArray(item?.services)) {
    item.services.forEach(addService);
  }

  // Support other possible service-list fields.
  if (Array.isArray(item?.selectedServices)) {
    item.selectedServices.forEach(addService);
  }

  if (Array.isArray(item?.serviceNames)) {
    item.serviceNames.forEach(addService);
  }

  // Support older single-service records.
  if (
    typeof item?.service === "string" &&
    item.service.trim()
  ) {
    item.service
      .split(",")
      .forEach(addService);
  }

  // Support a direct serviceName field if present.
  if (
    typeof item?.serviceName === "string" &&
    item.serviceName.trim()
  ) {
    addService(item.serviceName);
  }

  // Remove duplicate service names without changing their order.
  return [...new Set(services)];
};

const getServiceLabel = (item) => {
  const services = getAppointmentServices(item);

  return services.length
    ? services.join(", ")
    : item?.reason || "Appointment";
};

// An appointment requires staff confirmation if ANY selected service
// matches either supported Guidance and Counseling service name.
const requiresCounselingConfirmation = (item) => {
  const selectedServices = getAppointmentServices(item).map(
    normalizeServiceName
  );

  const counselingNames = COUNSELING_SERVICES.map(
    normalizeServiceName
  );

  return selectedServices.some((service) =>
    counselingNames.includes(service)
  );
};

// The automatic-approval transaction must recheck the latest
// Firestore service data instead of relying only on the UI snapshot.
const assertAutomaticApprovalAllowed = (appointmentData) => {
  if (requiresCounselingConfirmation(appointmentData)) {
    throw new Error(
      "This appointment includes Guidance and Counseling Services. It must remain pending until staff explicitly accepts it."
    );
  }
};

// The queue is numbered separately for each Philippine calendar day.
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

// Identify walk-in appointments using the available registration markers.
// Online appointments must never receive the completion email.
const isWalkInAppointment = (item) => {
  if (!item || typeof item !== "object") {
    return false;
  }

  if (item.isWalkIn === true) {
    return true;
  }

  const possibleTypes = [
    item.source,
    item.bookingType,
    item.channel,
    item.type,
  ];

  const hasWalkInType = possibleTypes.some((value) => {
    const normalized = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, "-");

    return (
      normalized === "walk-in" ||
      normalized === "walkin" ||
      normalized.includes("walk-in") ||
      normalized.includes("walkin")
    );
  });

  if (hasWalkInType) {
    return true;
  }

  // Walk-in registrations may also identify the staff member
  // who registered the appointment.
  if (
    item.registeredBy ||
    item.registeredByEmail
  ) {
    return true;
  }

  return false;
};

// Prioritize the actual email field used by the appointment table.
const getAppointmentEmail = (item) => {
  const possibleEmails = [
    item?.userEmail,
    item?.email,
    item?.user?.email,
    item?.studentEmail,
  ];

  const email = possibleEmails.find(
    (value) =>
      typeof value === "string" &&
      value.trim().length > 0
  );

  return email ? email.trim() : "";
};

// Retrieve the feedback reference saved in the appointment record.
// feedbackReference is the primary field used by the Appointments Table.
const getFeedbackReference = (item) => {
  const possibleReferences = [
    item?.feedbackReference,
    item?.feedbackRef,
    item?.feedbackCode,
    item?.reference,
    item?.feedback?.reference,
    item?.feedback?.feedbackReference,
    item?.feedback?.feedbackRef,
    item?.feedback?.code,
  ];

  const reference = possibleReferences.find(
    (value) =>
      typeof value === "string" &&
      value.trim().length > 0
  );

  return reference ? reference.trim() : "";
};

// Validate the reference using the same 48-character format
// required by the Appointments Table.
const isValidFeedbackReference = (reference) => {
  return (
    typeof reference === "string" &&
    /^[a-f0-9]{48}$/i.test(reference.trim())
  );
};

// Build a personalized feedback URL.
const buildPersonalizedFeedbackLink = (item) => {
  const reference = getFeedbackReference(item);

  if (!reference) {
    throw new Error(
      "The walk-in appointment does not contain a feedbackReference. " +
      "The appointment must have a generated feedback reference saved " +
      "in its Firestore record."
    );
  }

  if (!isValidFeedbackReference(reference)) {
    throw new Error(
      "The appointment has an invalid feedbackReference. " +
      "The reference must contain exactly 48 hexadecimal characters."
    );
  }

  const url = new URL(FEEDBACK_LINK);
  url.searchParams.set("reference", reference);

  return url.toString();
};

// Convert EmailJS errors into readable messages.
const getEmailJSErrorMessage = (error) => {
  const status = error?.status;
  const text = error?.text;
  const message = error?.message;

  if (status || text) {
    return [
      status ? `EmailJS status: ${status}.` : "",
      text ? `Details: ${text}` : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (message) {
    return message;
  }

  return "Unknown EmailJS error. Check your EmailJS service and template configuration.";
};

// Send an email only for completed walk-in appointments.
const sendWalkInCompletionEmail = async (item, officeName) => {
  if (!isWalkInAppointment(item)) {
    return {
      sent: false,
      reason: "Not a walk-in appointment.",
    };
  }

  const recipientEmail = getAppointmentEmail(item);

  if (!recipientEmail) {
    throw new Error(
      "The walk-in appointment has no recipient email. " +
      "Expected the userEmail field in the appointment record."
    );
  }

  // Generate the personalized feedback link for this specific walk-in.
  const personalizedFeedbackLink =
    buildPersonalizedFeedbackLink(item);

  const templateParams = {
    to_email: recipientEmail,
    to_name: item?.userName || "Valued Client",
    user_name: item?.userName || "Valued Client",
    queue_number: item?.queueNumber || "N/A",
    office: officeName,
    services: getServiceLabel(item),

    // Must match href="{{feedback_link}}" in the EmailJS template.
    feedback_link: personalizedFeedbackLink,
  };

  try {
    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams,
      EMAILJS_PUBLIC_KEY
    );

    if (response?.status && response.status !== 200) {
      throw new Error(
        `EmailJS returned status ${response.status}: ${
          response.text || "Email delivery request was unsuccessful."
        }`
      );
    }

    return {
      sent: true,
      email: recipientEmail,
      feedbackLink: personalizedFeedbackLink,
      status: response?.status || 200,
      responseText: response?.text || "OK",
    };
  } catch (error) {
    console.error(
      "EmailJS send request failed:",
      {
        status: error?.status || null,
        text: error?.text || null,
        message: error?.message || null,
      }
    );

    throw new Error(getEmailJSErrorMessage(error), { cause: error });
  }
};

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

const publicTicket = (item, status, queueNumber) => ({
  appointmentId: item.id,
  queueNumber: String(queueNumber || item.queueNumber || ""),
  status,
  isPriority: item.isPriority === true,
  queuePosition: Number(item.queuePosition || 0),
});

const readTickets = (data) =>
  Array.isArray(data?.tickets) ? data.tickets : [];

const withoutTicket = (tickets, appointmentId) =>
  tickets.filter(
    (ticket) => ticket.appointmentId !== appointmentId
  );

const getStatus = (item) =>
  String(item?.status || "pending").trim().toLowerCase();

const isPending = (item) =>
  ["pending", "waiting"].includes(getStatus(item));

const isApproved = (item) =>
  ["approved", "confirmed"].includes(getStatus(item));

const isServing = (item) =>
  ["in-progress", "serving", "now-serving"].includes(
    getStatus(item)
  );

const getQueueNumber = (item) => {
  if (isPending(item)) return "Pending";

  return item?.queueNumber
    ? String(item.queueNumber)
    : "Not Assigned";
};

const getTimestamp = (item) => {
  const value = item?.approvedAt || item?.createdAt;

  if (typeof value?.toMillis === "function")
    return value.toMillis();

  if (typeof value?.seconds === "number")
    return value.seconds * 1000;

  if (typeof value === "number") return value;

  if (typeof value === "string")
    return Date.parse(value) || 0;

  return 0;
};

// Display the student's actual reason separately from the selected service.
function ReasonForVisit({ item, className = "" }) {
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
function ViewPriorityImage({
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

export default function Swds({
  appointments = [],
  completeAppointment,
  setSelectedImage,
}) {
  const officeName = OFFICE_NAME;

  const [todayKey, setTodayKey] = useState(() =>
    getManilaDateKey()
  );

  // Prevent repeated automatic approval attempts for the same appointment.
  const autoApprovalAttempted = useRef(new Set());

  // Keep the latest appointments available to asynchronous callbacks.
  const appointmentsRef = useRef(appointments);

  useEffect(() => {
    appointmentsRef.current = appointments;
  }, [appointments]);

  // Refresh the visible queue after midnight.
  useEffect(() => {
    const interval = setInterval(() => {
      setTodayKey(getManilaDateKey());
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const [appointmentToReject, setAppointmentToReject] =
    useState(null);

  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionError, setRejectionError] = useState("");

  const [processingId, setProcessingId] = useState(null);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const officeAppointments = (appointments || []).filter(
    (item) =>
      String(item?.office || "").trim().toLowerCase() ===
      officeName.toLowerCase()
  );

  const validAppointments = officeAppointments.filter(
    (item) =>
      ![
        "completed",
        "rejected",
        "cancelled",
        "canceled",
      ].includes(getStatus(item))
  );

  const completedCount = officeAppointments.filter(
    (item) => getStatus(item) === "completed"
  ).length;

  // All pending appointments.
  const allPendingAppointments = validAppointments
    .filter(isPending)
    .sort((a, b) => getTimestamp(a) - getTimestamp(b));

  // ONLY appointments containing either supported counseling service
  // remain pending for staff confirmation.
  const pendingAppointments = allPendingAppointments.filter(
    requiresCounselingConfirmation
  );

  const priorityLaneQueue = pendingAppointments.filter(
    (item) => item.isPriority
  );

  const normalPendingAppointments =
    pendingAppointments.filter((item) => !item.isPriority);

  // Appointments without either counseling service are automatically approved.
  const automaticApprovalAppointments =
    allPendingAppointments.filter(
      (item) => !requiresCounselingConfirmation(item)
    );

  const approvedPriority = validAppointments
    .filter(
      (item) =>
        item.isPriority &&
        isApproved(item) &&
        isTicketForDay(item, todayKey) &&
        item.queueNumber
    )
    .sort((a, b) => getTimestamp(a) - getTimestamp(b));

  const normalAppointments = validAppointments
    .filter(
      (item) =>
        !item.isPriority &&
        isApproved(item) &&
        isTicketForDay(item, todayKey) &&
        item.queueNumber
    )
    .sort((a, b) => getTimestamp(a) - getTimestamp(b));

  const currentServing =
    validAppointments.find(
      (item) =>
        isServing(item) && isTicketForDay(item, todayKey)
    ) || null;

  const upcomingQueue = [
    ...approvedPriority,
    ...normalAppointments,
  ];

  const clearMessages = () => {
    setActionError("");
    setActionSuccess("");
  };

  // Staff accepts counseling bookings.
  // Only now is a queue number created.
  const handleAcceptAppointment = async (
    item,
    options = {}
  ) => {
    if (processingId) return;

    const isAutomatic = options.automatic === true;

    const currentStaff = auth.currentUser;

    if (!currentStaff) {
      if (isAutomatic) {
        autoApprovalAttempted.current.delete(item.id);
      }

      setActionError(
        "Your session has expired. Please log in again."
      );
      return;
    }

    setProcessingId(item.id);
    clearMessages();

    try {
      const appointmentRef = doc(
        db,
        "appointments",
        item.id
      );

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

      const assignedNumber = await runTransaction(
        db,
        async (transaction) => {
          const appointmentSnapshot =
            await transaction.get(appointmentRef);

          const counterSnapshot =
            await transaction.get(counterRef);

          const publicSnapshot =
            await transaction.get(publicQueueRef);

          if (!appointmentSnapshot.exists()) {
            throw new Error(
              "The appointment could not be found."
            );
          }

          const appointmentData =
            appointmentSnapshot.data();

          if (
            String(appointmentData.office || "")
              .trim()
              .toLowerCase() !== officeName.toLowerCase()
          ) {
            throw new Error(
              "This appointment does not belong to SWDS."
            );
          }

          const currentStatus = String(
            appointmentData.status || "pending"
          ).trim().toLowerCase();

          if (
            !["pending", "waiting"].includes(currentStatus)
          ) {
            throw new Error(
              "Only pending appointments can be accepted."
            );
          }

          // Critical protection:
          // An automatic approval must NEVER approve an appointment
          // containing either Guidance and Counseling service name.
          if (isAutomatic) {
            assertAutomaticApprovalAllowed(appointmentData);
          }

          const dateKey = getManilaDateKey();

          const counterData = counterSnapshot.exists()
            ? counterSnapshot.data()
            : {};

          const sameDayCounter =
            counterData.queueDate === dateKey
              ? Number(counterData.lastNumber || 0)
              : 0;

          const highestToday = Math.max(
            0,
            ...appointmentsRef.current
              .filter(
                (appointment) =>
                  appointment.id !== item.id &&
                  isTicketForDay(appointment, dateKey)
              )
              .map((appointment) => {
                const match = String(
                  appointment.queueNumber || ""
                ).match(/^SWDS-?(\d+)$/i);

                return match ? Number(match[1]) : 0;
              })
          );

          const nextNumber =
            Math.max(sameDayCounter, highestToday) + 1;

          const queueNumber = `SWDS-${String(
            nextNumber
          ).padStart(3, "0")}`;

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

          const publicData = publicSnapshot.exists()
            ? publicSnapshot.data()
            : {};

          const sameDayPublicQueue =
            publicData.queueDate === dateKey;

          const tickets = sameDayPublicQueue
            ? readTickets(publicData)
            : [];

          transaction.set(
            publicQueueRef,
            {
              office: officeName,
              queueDate: dateKey,

              nowServing: sameDayPublicQueue
                ? publicData.nowServing || ""
                : "",

              tickets: [
                ...withoutTicket(tickets, item.id),
                publicTicket(
                  {
                    ...appointmentData,
                    id: item.id,
                    queuePosition: nextNumber,
                  },
                  "approved",
                  queueNumber
                ),
              ],

              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          transaction.update(appointmentRef, {
            status: "approved",

            queueNumber,
            queuePosition: nextNumber,
            queueDate: dateKey,

            approvedAt: serverTimestamp(),
            approvedBy: currentStaff.uid,
            approvedByEmail: currentStaff.email || "",
          });

          return queueNumber;
        }
      );

      setActionSuccess(
        `Appointment accepted. Queue number ${assignedNumber} assigned successfully.`
      );
    } catch (error) {
      console.error(
        "Failed to accept appointment:",
        error
      );

      if (isAutomatic) {
        // Allow another attempt if the automatic operation failed.
        // Counseling appointments will not be retried because they
        // are excluded from the automatic-approval list.
        autoApprovalAttempted.current.delete(item.id);
      }

      setActionError(
        error?.message || "Failed to accept appointment."
      );
    } finally {
      setProcessingId(null);
    }
  };

  // Automatically approve appointments that do NOT include
  // either Guidance & Counseling Services or Guidance and Counseling Services.
  //
  // Appointments containing either counseling service remain pending
  // until staff explicitly accepts them.
  useEffect(() => {
    if (processingId) return;

    const nextAppointment =
      automaticApprovalAppointments.find(
        (item) =>
          !autoApprovalAttempted.current.has(item.id)
      );

    if (!nextAppointment) return;

    // Mark before starting the async operation to prevent duplicate attempts.
    autoApprovalAttempted.current.add(nextAppointment.id);

    handleAcceptAppointment(nextAppointment, {
      automatic: true,
    });
  }, [appointments, processingId]);

  // Explicit staff action to begin serving.
  const handleStartServing = async (item) => {
    if (processingId) return;

    if (currentServing) {
      setActionError(
        "Please complete the currently serving appointment first."
      );
      return;
    }

    setProcessingId(item.id);
    clearMessages();

    try {
      const currentStaff = auth.currentUser;

      if (!currentStaff) {
        throw new Error(
          "Your session has expired. Please log in again."
        );
      }

      const appointmentRef = doc(
        db,
        "appointments",
        item.id
      );

      const publicQueueRef = doc(
        db,
        PUBLIC_QUEUE_COLLECTION,
        officeName
      );

      await runTransaction(
        db,
        async (transaction) => {
          const snapshot =
            await transaction.get(appointmentRef);

          const publicSnapshot =
            await transaction.get(publicQueueRef);

          if (!snapshot.exists()) {
            throw new Error("Appointment not found.");
          }

          const data = snapshot.data();

          if (
            String(data.office || "")
              .trim()
              .toLowerCase() !== officeName.toLowerCase()
          ) {
            throw new Error(
              "This appointment does not belong to SWDS."
            );
          }

          if (getStatus(data) !== "approved") {
            throw new Error(
              "Only approved appointments or registered walk-ins can be served."
            );
          }

          const dateKey = getManilaDateKey();

          if (!isTicketForDay(data, dateKey)) {
            throw new Error(
              "This ticket belongs to a previous day and cannot be served today."
            );
          }

          if (!data.queueNumber) {
            throw new Error(
              "This appointment has no assigned queue number."
            );
          }

          const publicData =
            publicSnapshot.data() || {};

          const sameDayPublicQueue =
            publicData.queueDate === dateKey;

          if (
            sameDayPublicQueue &&
            publicData.nowServing &&
            publicData.nowServing !== data.queueNumber
          ) {
            throw new Error(
              "Another ticket is currently being served."
            );
          }

          const tickets = sameDayPublicQueue
            ? readTickets(publicData)
            : [];

          transaction.set(
            publicQueueRef,
            {
              office: officeName,
              queueDate: dateKey,
              nowServing: data.queueNumber,

              tickets: [
                ...withoutTicket(tickets, item.id),
                publicTicket(
                  { ...data, id: item.id },
                  "in-progress"
                ),
              ],

              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          transaction.update(appointmentRef, {
            status: "in-progress",
            servingAt: serverTimestamp(),
            servingBy: currentStaff.uid,
            servingByEmail: currentStaff.email || "",
          });
        }
      );

      setActionSuccess(
        `Now serving ${item.queueNumber}.`
      );
    } catch (error) {
      console.error(
        "Failed to start serving:",
        error
      );

      setActionError(
        error?.message || "Failed to start serving."
      );
    } finally {
      setProcessingId(null);
    }
  };

  // Complete appointment.
  // Email notification is sent ONLY for walk-in appointments.
  const handleCompleteAppointment = async (item) => {
    if (processingId) return;

    setProcessingId(item.id);
    clearMessages();

    try {
      if (typeof completeAppointment !== "function") {
        throw new Error(
          "The completion handler is unavailable."
        );
      }

      // Preserve the existing appointment completion functionality.
      await completeAppointment(item.id);

      // Remove the completed appointment from the public queue.
      const publicQueueRef = doc(
        db,
        PUBLIC_QUEUE_COLLECTION,
        officeName
      );

      await runTransaction(
        db,
        async (transaction) => {
          const publicSnapshot =
            await transaction.get(publicQueueRef);

          const publicData =
            publicSnapshot.data() || {};

          const sameDay =
            publicData.queueDate === getManilaDateKey();

          const matchingServingTicket =
            readTickets(publicData).some(
              (ticket) =>
                ticket.appointmentId === item.id &&
                ticket.queueNumber === publicData.nowServing
            );

          transaction.set(
            publicQueueRef,
            {
              office: officeName,

              nowServing:
                sameDay && matchingServingTicket
                  ? ""
                  : publicData.nowServing || "",

              tickets: withoutTicket(
                readTickets(publicData),
                item.id
              ),

              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }
      );

      // Send an email only if this appointment is a walk-in.
      // Online appointments are skipped.
      let emailMessage = "";

      if (isWalkInAppointment(item)) {
        try {
          const emailResult =
            await sendWalkInCompletionEmail(
              item,
              officeName
            );

          if (emailResult.sent) {
            emailMessage =
              ` A completion email was successfully sent to ${emailResult.email}.`;
          }
        } catch (emailError) {
          console.error(
            "Walk-in completion email failed:",
            emailError
          );

          // The appointment remains completed even if the email fails.
          emailMessage =
            ` However, the completion email failed: ${emailError?.message || "Unknown email error"}`;
        }
      }

      setActionSuccess(
        `Appointment ${item.queueNumber || ""} completed successfully.${emailMessage}`
      );
    } catch (error) {
      console.error(
        "Failed to complete appointment:",
        error
      );

      setActionError(
        error?.message || "Failed to complete appointment."
      );
    } finally {
      setProcessingId(null);
    }
  };

  const openRejectModal = (appointment) => {
    setAppointmentToReject(appointment);
    setRejectionReason("");
    setRejectionError("");
  };

  const closeRejectModal = () => {
    if (isRejecting) return;

    setAppointmentToReject(null);
    setRejectionReason("");
    setRejectionError("");
  };

  // Original Firestore rejection and archive functionality.
  const handleConfirmRejection = async () => {
    const reason = rejectionReason.trim();

    if (!appointmentToReject) return;

    if (!reason) {
      setRejectionError(
        "Please provide a reason for rejecting this appointment."
      );
      return;
    }

    if (reason.length > 500) {
      setRejectionError(
        "The rejection reason cannot exceed 500 characters."
      );
      return;
    }

    if (isRejecting) return;

    const currentStaff = auth.currentUser;

    if (!currentStaff) {
      setRejectionError(
        "Your session has expired. Please log in again."
      );
      return;
    }

    setIsRejecting(true);
    setRejectionError("");

    try {
      const appointmentId = appointmentToReject.id;

      const appointmentRef = doc(
        db,
        "appointments",
        appointmentId
      );

      const rejectedAppointmentRef = doc(
        db,
        "rejected-appointments",
        appointmentId
      );

      const publicQueueRef = doc(
        db,
        PUBLIC_QUEUE_COLLECTION,
        officeName
      );

      await runTransaction(
        db,
        async (transaction) => {
          const appointmentSnapshot =
            await transaction.get(appointmentRef);

          const publicSnapshot =
            await transaction.get(publicQueueRef);

          if (!appointmentSnapshot.exists()) {
            throw new Error(
              "The appointment could not be found."
            );
          }

          const appointmentData =
            appointmentSnapshot.data();

          if (
            String(appointmentData.office || "")
              .trim()
              .toLowerCase() !== officeName.toLowerCase()
          ) {
            throw new Error(
              "This appointment does not belong to SWDS."
            );
          }

          const currentStatus =
            getStatus(appointmentData);

          if (
            [
              "rejected",
              "completed",
              "cancelled",
              "canceled",
            ].includes(currentStatus)
          ) {
            throw new Error(
              "This appointment has already been processed."
            );
          }

          const rejectionDetails = {
            status: "rejected",
            rejectionReason: reason,
            rejectedAt: serverTimestamp(),
            rejectedBy: currentStaff.uid,
            rejectedByEmail: currentStaff.email || "",
          };

          transaction.update(
            appointmentRef,
            rejectionDetails
          );

          transaction.set(
            rejectedAppointmentRef,
            {
              ...appointmentData,
              id: appointmentId,
              appointmentId,
              ...rejectionDetails,
            }
          );

          const publicData =
            publicSnapshot.data() || {};

          transaction.set(
            publicQueueRef,
            {
              office: officeName,

              nowServing:
                publicData.queueDate === getManilaDateKey() &&
                readTickets(publicData).some(
                  (ticket) =>
                    ticket.appointmentId === appointmentId &&
                    ticket.queueNumber === publicData.nowServing
                )
                  ? ""
                  : publicData.nowServing || "",

              tickets: withoutTicket(
                readTickets(publicData),
                appointmentId
              ),

              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }
      );

      setAppointmentToReject(null);
      setRejectionReason("");
      setRejectionError("");

      setActionSuccess(
        "Appointment rejected successfully."
      );
    } catch (error) {
      console.error(
        "Failed to reject appointment:",
        error
      );

      setRejectionError(
        error?.message ||
          "Failed to reject the appointment. Please try again."
      );
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <>
      {/* Walk-in registration component */}
      <WalkIn
        appointments={officeAppointments}
        officeName={officeName}
      />

      {/* Action feedback */}
      {actionError && (
        <div
          role="alert"
          className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
        >
          <span>{actionError}</span>

          <button
            type="button"
            onClick={() => setActionError("")}
            aria-label="Dismiss error"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionSuccess && (
        <div
          role="status"
          className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
        >
          <span>{actionSuccess}</span>

          <button
            type="button"
            onClick={() => setActionSuccess("")}
            aria-label="Dismiss message"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 w-full">
        {/* Left Column */}
        <div className="flex flex-col gap-4 sm:gap-6">
          {/* Now Serving Card */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-xs border border-slate-200 text-center flex flex-col items-center justify-between">
            <div className="w-full">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                Now Serving ({officeName})
              </span>

              {currentServing ? (
                <div className="flex flex-col items-center">
                  <span className="text-4xl sm:text-5xl font-black text-purple-600 my-2 font-mono break-all">
                    {currentServing.queueNumber || "N/A"}
                  </span>

                  <p className="font-semibold text-slate-800 text-base sm:text-lg mt-1 px-2 break-words">
                    {currentServing.userName || "Unknown Student"}
                  </p>

                  <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100 my-1 max-w-full break-words">
                    {currentServing.office} - {getServiceLabel(currentServing)}
                  </span>

                  <ReasonForVisit
                    item={currentServing}
                    className="mt-3"
                  />

                  {currentServing.isPriority && (
                    <div className="mt-3 mb-1 flex flex-col items-center gap-2">
                      <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        Priority Lane Active
                      </span>

                      <ViewPriorityImage
                        item={currentServing}
                        setSelectedImage={setSelectedImage}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-8 sm:py-12">
                  <Users className="w-10 h-10 sm:w-12 sm:h-12 text-slate-300 mx-auto mb-2" />

                  <p className="text-slate-500 text-sm font-medium px-2">
                    No active ticket being served for {officeName}.
                  </p>
                </div>
              )}
            </div>

            {currentServing && (
              <div className="flex items-center gap-2 mt-6 w-full justify-center">
                <button
                  type="button"
                  onClick={() =>
                    handleCompleteAppointment(currentServing)
                  }
                  disabled={Boolean(processingId)}
                  className="w-full inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors shadow-xs text-xs sm:text-sm disabled:opacity-50"
                >
                  {processingId === currentServing.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCheck className="w-4 h-4" />
                  )}
                  Complete
                </button>
              </div>
            )}
          </div>

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
                      onAccept={handleAcceptAppointment}
                      onReject={openRejectModal}
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
                Pending Appointments ({officeName})
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
                    onAccept={handleAcceptAppointment}
                    onReject={openRejectModal}
                    setSelectedImage={setSelectedImage}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Upcoming Queue */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-xs border border-slate-200 flex flex-col justify-between h-full">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                Upcoming Queue ({officeName})
              </h2>

              <span className="self-start sm:self-auto text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">
                {upcomingQueue.length} Waiting
              </span>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              Automatically approved appointments, accepted counseling appointments, and registered walk-ins with assigned queue numbers appear here.
            </p>

            {upcomingQueue.length === 0 ? (
              <div className="py-8 sm:py-12 text-center">
                <p className="text-slate-500 text-sm font-medium px-2">
                  No accepted appointments in the upcoming queue for {officeName}.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[450px] lg:max-h-[820px] overflow-y-auto pr-1">
                {upcomingQueue.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col p-3 sm:p-3.5 bg-slate-50 rounded-xl border border-slate-200 hover:bg-slate-100/50 transition-colors gap-2.5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono font-bold text-slate-900 bg-white px-2.5 py-1 rounded-md border border-slate-200 text-xs shadow-2xs shrink-0">
                          {getQueueNumber(item)}
                        </span>

                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 text-sm truncate">
                            {item.userName || "Unknown Student"}
                          </p>

                          <p className="text-xs text-slate-500 break-words">
                            {item.office} - {getServiceLabel(item)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            handleStartServing(item)
                          }
                          disabled={
                            Boolean(processingId) ||
                            Boolean(currentServing)
                          }
                          className="inline-flex items-center gap-1 text-purple-700 hover:text-purple-800 font-semibold text-xs bg-purple-50 hover:bg-purple-100 px-2.5 py-1.5 rounded-lg border border-purple-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Start serving this appointment"
                        >
                          {processingId === item.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                          Serve
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            openRejectModal(item)
                          }
                          disabled={Boolean(processingId)}
                          className="inline-flex items-center gap-1 text-rose-700 hover:text-rose-800 font-semibold text-xs bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 rounded-lg border border-rose-200 transition-colors disabled:opacity-50"
                          title="Postpone with reason"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Postpone
                        </button>
                      </div>
                    </div>

                    <ReasonForVisit item={item} />

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Approved - Waiting
                      </span>

                      {item.isPriority && (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Priority Lane (Approved)
                        </span>
                      )}

                      <ViewPriorityImage
                        item={item}
                        compact
                        setSelectedImage={setSelectedImage}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-amber-50 p-3 text-center">
                <p className="text-xl font-bold text-amber-700">
                  {pendingAppointments.length}
                </p>

                <p className="text-xs text-amber-700">
                  Pending Approval
                </p>
              </div>

              <div className="rounded-xl bg-emerald-50 p-3 text-center">
                <p className="text-xl font-bold text-emerald-700">
                  {completedCount}
                </p>

                <p className="text-xs text-emerald-700">
                  Completed
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rejection Reason Modal */}
      {appointmentToReject && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeRejectModal();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="swds-reject-title"
            className="w-full max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100">
                  <AlertTriangle className="h-5 w-5 text-rose-600" />
                </div>

                <div>
                  <h2
                    id="swds-reject-title"
                    className="text-lg font-bold text-slate-900"
                  >
                    Reject Appointment
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    Please provide a reason for rejection.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeRejectModal}
                disabled={isRejecting}
                aria-label="Close rejection dialog"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {/* Appointment Details */}
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Appointment Details
              </p>

              <div className="mt-3 space-y-2">
                <div className="flex justify-between gap-3">
                  <span className="text-xs text-slate-500">
                    Queue Number
                  </span>

                  <span className="text-xs font-bold text-slate-900">
                    {getQueueNumber(appointmentToReject)}
                  </span>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="text-xs text-slate-500">
                    Student
                  </span>

                  <span className="text-right text-xs font-semibold text-slate-900">
                    {appointmentToReject.userName || "Unknown Student"}
                  </span>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="text-xs text-slate-500">
                    Office
                  </span>

                  <span className="text-xs font-semibold text-slate-900">
                    {appointmentToReject.office || officeName}
                  </span>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="text-xs text-slate-500">
                    Services
                  </span>

                  <span className="text-right text-xs font-semibold text-slate-900">
                    {getServiceLabel(appointmentToReject)}
                  </span>
                </div>

                <ReasonForVisit
                  item={appointmentToReject}
                  className="mt-3"
                />

                <div className="flex justify-between gap-3">
                  <span className="text-xs text-slate-500">
                    Status
                  </span>

                  <span className="text-xs font-semibold text-slate-900 capitalize">
                    {getStatus(appointmentToReject)}
                  </span>
                </div>
              </div>
            </div>

            {/* Required Rejection Reason */}
            <div className="mt-5">
              <label
                htmlFor="swds-rejection-reason"
                className="mb-2 block text-sm font-semibold text-slate-800"
              >
                Reason for Rejection{" "}
                <span className="text-rose-600">*</span>
              </label>

              <textarea
                id="swds-rejection-reason"
                value={rejectionReason}
                onChange={(event) => {
                  setRejectionReason(event.target.value);

                  if (rejectionError) {
                    setRejectionError("");
                  }
                }}
                placeholder="Explain why this appointment is being rejected..."
                rows={4}
                maxLength={500}
                disabled={isRejecting}
                aria-invalid={Boolean(rejectionError)}
                className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100 disabled:opacity-60"
              />

              <div className="mt-1.5 flex justify-between gap-3">
                <p className="text-xs text-slate-500">
                  This reason will be saved in both appointments and rejected-appointments.
                </p>

                <span className="shrink-0 text-xs text-slate-400">
                  {rejectionReason.length}/500
                </span>
              </div>

              {rejectionError && (
                <p
                  role="alert"
                  className="mt-2 text-xs font-medium text-rose-600"
                >
                  {rejectionError}
                </p>
              )}
            </div>

            {/* Modal Actions */}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeRejectModal}
                disabled={isRejecting}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmRejection}
                disabled={
                  isRejecting || !rejectionReason.trim()
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isRejecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4" />
                    Confirm Rejection
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
