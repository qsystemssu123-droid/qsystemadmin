import { useEffect, useState } from "react";
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
  onSnapshot,
} from "firebase/firestore";
import { auth, db } from "../../services/firebase";

const SWDS_SERVICES = [
  { id: "guidance_counseling", name: "Guidance & Counseling Services" },
  { id: "special_needs_pwd", name: "Services for Students with Special Needs & PWDs" },
  { id: "psychological_wellness", name: "Psychological & Wellness Services" },
  { id: "information_orientation", name: "Information & Orientation Services" },
  { id: "economic_enterprise", name: "Economic Enterprise Development" },
  { id: "career_placement_peso", name: "Career & Placement Services / PESO" },
  { id: "admission_recruitment", name: "Admission & Recruitment Services" },
  { id: "university_student_council", name: "University Student Council" },
  { id: "student_organizations", name: "Student Organizations" },
  { id: "multi_faith", name: "Multi-Faith Services" },
  { id: "others", name: "Others" },
];

const OTHER_SERVICE = "Others";
const OFFICE_NAME = "SWDS";
const PUBLIC_QUEUE_COLLECTION = "queues";
const SERVICE_TASKS_COLLECTION = "appointment_services";
const STAFF_ASSIGNMENTS_COLLECTION = "swds_service_assignments";
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

  return `${Date.now().toString(16)}${Math.random()
    .toString(16)
    .slice(2)}${Math.random().toString(16).slice(2)}`.slice(0, 48);
};

// Get Philippine date and time information.
const getManilaDateTime = (date = new Date()) => {
  const dateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: PHILIPPINE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const timeParts = new Intl.DateTimeFormat("en-US", {
    timeZone: PHILIPPINE_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const value = (parts, type) =>
    parts.find((part) => part.type === type)?.value || "";

  const year = value(dateParts, "year");
  const month = value(dateParts, "month");
  const day = value(dateParts, "day");
  const hour = Number(value(timeParts, "hour"));

  const appointmentTime = new Intl.DateTimeFormat("en-US", {
    timeZone: PHILIPPINE_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);

  return {
    dateKey: `${year}-${month}-${day}`,
    hour,
    appointmentTime,
  };
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

  if (!date || Number.isNaN(date.getTime())) return null;

  return getManilaDateTime(date).dateKey;
};

const isTicketForCurrentHour = (item, dateKey, hour) => {
  if (item?.queueDate && item.queueDate !== dateKey) {
    return false;
  }

  if (typeof item?.queueHour === "number") {
    return (
      getAppointmentQueueDate(item) === dateKey &&
      item.queueHour === hour
    );
  }

  const timestamp =
    item?.approvedAt ||
    item?.createdAt ||
    item?.updatedAt;

  const date =
    typeof timestamp?.toDate === "function"
      ? timestamp.toDate()
      : typeof timestamp?.seconds === "number"
        ? new Date(timestamp.seconds * 1000)
        : timestamp instanceof Date
          ? timestamp
          : timestamp
            ? new Date(timestamp)
            : null;

  return (
    date &&
    !Number.isNaN(date.getTime()) &&
    getAppointmentQueueDate(item) === dateKey &&
    getManilaDateTime(date).hour === hour
  );
};

const readTickets = (data) =>
  Array.isArray(data?.tickets) ? data.tickets : [];

const getQueueNumberValue = (value) => {
  const match = String(value || "").match(/^SWDS-?(\d+)$/i);
  return match ? Number(match[1]) : 0;
};

const publicTicket = (item) => ({
  appointmentId: item.id,
  serviceTaskId: item.serviceTaskId,
  serviceId: item.serviceId,
  serviceName: item.serviceName,
  assignedStaffId: item.assignedStaffId,
  assignedStaffEmail: item.assignedStaffEmail,
  assignedStaffName: item.assignedStaffName,
  queueNumber: String(item.queueNumber || ""),
  status: item.status,
  isPriority: item.isPriority === true,
  queuePosition: Number(item.queuePosition || 0),
  queueDate: item.queueDate,
  queueHour: item.queueHour,
  services: item.services || [],
});

const normalizeEmail = (email) =>
  String(email || "").trim().toLowerCase();

const isAssignmentForStaff = (assignment, staff) => {
  if (!assignment || !staff) return false;

  const assignedStaffId = String(
    assignment.staffId || ""
  ).trim();

  const assignedStaffEmail = normalizeEmail(
    assignment.staffEmail
  );

  const currentStaffId = String(staff.uid || "").trim();
  const currentStaffEmail = normalizeEmail(staff.email);

  return (
    (!!assignedStaffId &&
      !!currentStaffId &&
      assignedStaffId === currentStaffId) ||
    (!!assignedStaffEmail &&
      !!currentStaffEmail &&
      assignedStaffEmail === currentStaffEmail)
  );
};

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

  const [serviceAssignments, setServiceAssignments] = useState({});
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [assignmentErrorState, setAssignmentErrorState] = useState("");

  const staff = auth.currentUser;

  // Derive session-related values instead of setting state synchronously
  // inside the effect.
  const assignmentError = !staff
    ? "Your session has expired. Please log in again."
    : assignmentErrorState;

  // Listen to the current SWDS staff-service assignments.
  useEffect(() => {
    if (!staff) return;

    const assignmentRef = doc(
      db,
      STAFF_ASSIGNMENTS_COLLECTION,
      "current"
    );

    const unsubscribe = onSnapshot(
      assignmentRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setServiceAssignments({});
          setAssignmentErrorState(
            "SWDS staff-service assignments have not been configured."
          );
          setAssignmentsLoading(false);
          return;
        }

        const data = snapshot.data();

        setServiceAssignments(
          data?.assignments && typeof data.assignments === "object"
            ? data.assignments
            : {}
        );

        setAssignmentErrorState("");
        setAssignmentsLoading(false);
      },
      (error) => {
        console.error(
          "Failed to load SWDS service assignments:",
          error
        );

        setServiceAssignments({});
        setAssignmentErrorState(
          "Unable to load staff-service assignments. Please try again."
        );
        setAssignmentsLoading(false);
      }
    );

    return unsubscribe;
  }, [staff?.uid, staff?.email]);

  const getServiceAssignment = (serviceId) =>
    serviceAssignments?.[serviceId] || null;

  const isServiceAssignedToCurrentStaff = (serviceId) =>
    isAssignmentForStaff(
      getServiceAssignment(serviceId),
      auth.currentUser
    );

  const getAvailableServices = () =>
    SWDS_SERVICES.filter((service) =>
      isServiceAssignedToCurrentStaff(service.id)
    );

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
    const serviceConfig = SWDS_SERVICES.find(
      (item) => item.name === service
    );

    if (
      !serviceConfig ||
      !isServiceAssignedToCurrentStaff(serviceConfig.id)
    ) {
      setWalkInError(
        "You can only register services assigned to your staff account."
      );
      return;
    }

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

  // Register a walk-in using the same staff-service assignment
  // and Firestore structure as regular appointments.
  const handleRegisterWalkIn = async (event) => {
    event.preventDefault();

    if (walkInSaving) return;

    const name = walkInName.trim();
    const email = walkInEmail.trim().toLowerCase();

    const selectedServiceNames = [
      ...new Set(
        walkInServices.filter(
          (service) =>
            typeof service === "string" &&
            service !== OTHER_SERVICE
        )
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

      selectedServiceNames.push(OTHER_SERVICE);
    }

    const reason = walkInReason.trim();

    if (!name || !email || selectedServiceNames.length === 0) {
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
      selectedServiceNames.some(
        (service) =>
          (service === OTHER_SERVICE
            ? customService
            : service
          ).length > 150
      ) ||
      reason.length > 500
    ) {
      setWalkInError(
        "Please shorten the information entered. Each service must not exceed 150 characters."
      );
      return;
    }

    const currentStaff = auth.currentUser;

    if (!currentStaff) {
      setWalkInError(
        "Your session has expired. Please log in again."
      );
      return;
    }

    if (assignmentsLoading) {
      setWalkInError(
        "Please wait while your staff-service assignments load."
      );
      return;
    }

    if (assignmentError) {
      setWalkInError(assignmentError);
      return;
    }

    // Resolve every selected service to its current staff assignment.
    const selectedServices = selectedServiceNames.map(
      (serviceName) => {
        const config = SWDS_SERVICES.find(
          (item) => item.name === serviceName
        );

        if (!config) {
          throw new Error(
            `Invalid SWDS service selected: ${serviceName}`
          );
        }

        const assignment = getServiceAssignment(config.id);

        if (
          !assignment ||
          !isAssignmentForStaff(assignment, currentStaff)
        ) {
          throw new Error(
            `You are not assigned to ${serviceName}. Please select only your assigned services.`
          );
        }

        return {
          serviceId: config.id,
          serviceName:
            config.id === "others"
              ? `Others: ${customService}`
              : config.name,
          assignedStaffId: assignment.staffId || currentStaff.uid,
          assignedStaffEmail:
            assignment.staffEmail || currentStaff.email || "",
          assignedStaffName:
            assignment.staffName ||
            currentStaff.displayName ||
            currentStaff.email ||
            "SWDS Staff",
        };
      }
    );

    // All selected services must belong to the same staff member.
    const assignedStaffIds = [
      ...new Set(
        selectedServices.map((service) =>
          String(service.assignedStaffId || "")
        )
      ),
    ];

    const assignedStaffEmails = [
      ...new Set(
        selectedServices.map((service) =>
          normalizeEmail(service.assignedStaffEmail)
        )
      ),
    ];

    if (
      assignedStaffIds.length > 1 ||
      assignedStaffEmails.length > 1
    ) {
      setWalkInError(
        "Selected services must belong to the same assigned staff member. Register services assigned to another staff member separately."
      );
      return;
    }

    setWalkInSaving(true);
    clearWalkInMessages();

    try {
      const assignmentRef = doc(
        db,
        STAFF_ASSIGNMENTS_COLLECTION,
        "current"
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

      // Each selected service gets its own appointment and task.
      // This gives every separate service its own queue number.
      const appointmentRefs = selectedServices.map(() =>
        doc(collection(db, "appointments"))
      );

      const serviceTaskRefs = selectedServices.map(() =>
        doc(collection(db, SERVICE_TASKS_COLLECTION))
      );

      const feedbackReferences = selectedServices.map(() =>
        generateFeedbackReference()
      );

      const queueNumbers = await runTransaction(
        db,
        async (transaction) => {
          // Read all documents before performing transaction writes.
          const assignmentSnapshot =
            await transaction.get(assignmentRef);

          const counterSnapshot =
            await transaction.get(counterRef);

          const publicSnapshot =
            await transaction.get(publicQueueRef);

          if (!assignmentSnapshot.exists()) {
            throw new Error(
              "SWDS staff-service assignments are unavailable."
            );
          }

          const currentAssignments =
            assignmentSnapshot.data()?.assignments || {};

          // Revalidate every service assignment inside the transaction.
          const verifiedServices = selectedServices.map(
            (service) => {
              const assignment =
                currentAssignments[service.serviceId];

              if (
                !assignment ||
                !isAssignmentForStaff(
                  assignment,
                  currentStaff
                )
              ) {
                throw new Error(
                  `The assignment for ${service.serviceName} has changed. Refresh the page and try again.`
                );
              }

              return {
                ...service,
                assignedStaffId:
                  assignment.staffId || currentStaff.uid,
                assignedStaffEmail:
                  assignment.staffEmail ||
                  currentStaff.email ||
                  "",
                assignedStaffName:
                  assignment.staffName ||
                  currentStaff.displayName ||
                  currentStaff.email ||
                  "SWDS Staff",
              };
            }
          );

          const dateTime = getManilaDateTime();
          const dateKey = dateTime.dateKey;
          const queueHour = dateTime.hour;

          const counterData = counterSnapshot.exists()
            ? counterSnapshot.data()
            : {};

          const publicData = publicSnapshot.exists()
            ? publicSnapshot.data()
            : {};

          const sameHour =
            counterData.queueDate === dateKey &&
            Number(counterData.queueHour) === queueHour;

          const lastCounterNumber = sameHour
            ? Number(counterData.lastNumber || 0)
            : 0;

          const samePublicHour =
            publicData.queueDate === dateKey &&
            Number(publicData.queueHour) === queueHour;

          const existingTickets = samePublicHour
            ? readTickets(publicData)
            : [];

          const highestAppointmentNumber = Math.max(
            0,
            ...appointments
              .filter(
                (item) =>
                  String(item?.office || "")
                    .trim()
                    .toLowerCase() === officeName.toLowerCase()
              )
              .filter((item) =>
                isTicketForCurrentHour(
                  item,
                  dateKey,
                  queueHour
                )
              )
              .map((item) =>
                getQueueNumberValue(item.queueNumber)
              )
          );

          const highestPublicTicketNumber = Math.max(
            0,
            ...existingTickets.map((ticket) =>
              getQueueNumberValue(ticket.queueNumber)
            )
          );

          let nextNumber = Math.max(
            lastCounterNumber,
            highestAppointmentNumber,
            highestPublicTicketNumber
          );

          const createdTickets = [];
          const assignedQueueNumbers = [];

          verifiedServices.forEach((service, index) => {
            nextNumber += 1;

            const queueNumber = `SWDS-${String(
              nextNumber
            ).padStart(3, "0")}`;

            const appointmentRef = appointmentRefs[index];
            const serviceTaskRef = serviceTaskRefs[index];
            const feedbackReference =
              feedbackReferences[index];

            const serviceEntry = {
              serviceId: service.serviceId,
              serviceName: service.serviceName,
              serviceTaskId: serviceTaskRef.id,
              assignedStaffId: service.assignedStaffId,
              assignedStaffEmail:
                service.assignedStaffEmail,
              assignedStaffName:
                service.assignedStaffName,
              queueNumber,
              status: "approved",
            };

            const appointment = {
              office: officeName,

              userName: name,
              userEmail: email,

              userId: null,
              userPhoto: "",

              appointmentDate: dateKey,
              appointmentTime: dateTime.appointmentTime,

              service: service.serviceName,
              services: [serviceEntry],
              reason: reason || service.serviceName,

              serviceTaskIds: [serviceTaskRef.id],

              assignedStaffId: service.assignedStaffId,
              assignedStaffEmail:
                service.assignedStaffEmail,
              assignedStaffName:
                service.assignedStaffName,

              totalServices: 1,
              pendingServices: 1,
              completedServices: 0,

              status: "approved",

              source: "walk-in",
              bookingType: "walk-in",
              isWalkIn: true,

              feedbackReference,

              isPriority: walkInPriority,
              priorityImageUrl: null,

              queueNumber,
              queuePosition: nextNumber,
              queueDate: dateKey,
              queueHour,

              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              approvedAt: serverTimestamp(),

              approvedBy: currentStaff.uid,
              approvedByEmail: currentStaff.email || "",

              registeredBy: currentStaff.uid,
              registeredByEmail:
                currentStaff.email || "",
            };

            const serviceTask = {
              appointmentId: appointmentRef.id,
              parentAppointmentId: appointmentRef.id,

              office: officeName,

              userId: null,
              userName: name,
              userEmail: email,
              userPhoto: "",

              appointmentDate: dateKey,
              appointmentTime: dateTime.appointmentTime,

              serviceId: service.serviceId,
              serviceName: service.serviceName,

              assignedStaffId: service.assignedStaffId,
              assignedStaffEmail:
                service.assignedStaffEmail,
              assignedStaffName:
                service.assignedStaffName,

              bookingSlotId: null,

              reason: reason || service.serviceName,

              isPriority: walkInPriority,
              priorityImageUrl: null,

              queueNumber,
              queuePosition: nextNumber,
              queueDate: dateKey,
              queueHour,

              serviceTaskIndex: 0,
              status: "approved",

              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };

            transaction.set(
              appointmentRef,
              appointment
            );

            transaction.set(
              serviceTaskRef,
              serviceTask
            );

            createdTickets.push(
              publicTicket({
                id: appointmentRef.id,
                serviceTaskId: serviceTaskRef.id,
                serviceId: service.serviceId,
                serviceName: service.serviceName,
                assignedStaffId:
                  service.assignedStaffId,
                assignedStaffEmail:
                  service.assignedStaffEmail,
                assignedStaffName:
                  service.assignedStaffName,
                queueNumber,
                status: "approved",
                isPriority: walkInPriority,
                queuePosition: nextNumber,
                queueDate: dateKey,
                queueHour,
                services: [serviceEntry],
              })
            );

            assignedQueueNumbers.push(queueNumber);
          });

          transaction.set(
            counterRef,
            {
              office: officeName,
              queueDate: dateKey,
              queueHour,
              lastNumber: nextNumber,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          transaction.set(
            publicQueueRef,
            {
              office: officeName,
              queueDate: dateKey,
              queueHour,

              nowServing: samePublicHour
                ? publicData.nowServing || ""
                : "",

              tickets: [
                ...existingTickets,
                ...createdTickets,
              ],

              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          return assignedQueueNumbers;
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
        queueNumbers.length === 1
          ? `Walk-in registered successfully. Queue number ${queueNumbers[0]} assigned.`
          : `Walk-in registered successfully. Queue numbers ${queueNumbers.join(", ")} assigned. Each service has its own appointment.`
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
                  Only services assigned to your staff account are available. Services assigned to another staff member cannot be selected.
                </p>

                {assignmentsLoading && (
                  <div className="mb-3 flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs font-medium text-blue-700">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading your assigned SWDS services...
                  </div>
                )}

                {assignmentError && (
                  <p
                    role="alert"
                    className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700"
                  >
                    {assignmentError}
                  </p>
                )}

                {!assignmentsLoading &&
                  !assignmentError &&
                  getAvailableServices().length === 0 && (
                    <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800">
                      No SWDS services are currently assigned to your staff account.
                    </p>
                  )}

                <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                  {SWDS_SERVICES.map((serviceConfig) => {
                    const service = serviceConfig.name;
                    const selected =
                      walkInServices.includes(service);

                    const assigned =
                      isServiceAssignedToCurrentStaff(
                        serviceConfig.id
                      );

                    const disabled =
                      walkInSaving ||
                      assignmentsLoading ||
                      !assigned;

                    return (
                      <label
                        key={serviceConfig.id}
                        className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                          disabled
                            ? "cursor-not-allowed border-slate-200 bg-slate-100 opacity-50"
                            : selected
                              ? "cursor-pointer border-blue-300 bg-blue-50"
                              : "cursor-pointer border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() =>
                            handleWalkInServiceToggle(service)
                          }
                          disabled={disabled}
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

                        <span className="flex-1">
                          <span
                            className={`block text-sm leading-relaxed ${
                              selected
                                ? "font-semibold text-blue-800"
                                : "text-slate-700"
                            }`}
                          >
                            {service}
                          </span>

                          {!assigned &&
                            !assignmentsLoading && (
                              <span className="mt-1 block text-[11px] text-slate-400">
                                Assigned to another staff member
                              </span>
                            )}
                        </span>
                      </label>
                    );
                  })}
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
                  assignmentsLoading ||
                  !!assignmentError ||
                  !walkInName.trim() ||
                  !walkInEmail.trim() ||
                  walkInServices.length === 0 ||
                  walkInServices.some((service) => {
                    const config = SWDS_SERVICES.find(
                      (item) => item.name === service
                    );

                    return (
                      !config ||
                      !isServiceAssignedToCurrentStaff(
                        config.id
                      )
                    );
                  }) ||
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