
import {
  XCircle,
  AlertTriangle,
  Loader2,
  Play,
} from "lucide-react";

import { useEffect, useMemo, useState } from "react";

import {
  getAuth,
  onAuthStateChanged,
} from "firebase/auth";

import {
  doc,
  getFirestore,
  onSnapshot,
} from "firebase/firestore";

import WalkIn from "./walk-in";
import Future from "./future";
import Later from "./later";
import Serving from "./serving";

import Pending, {
  ReasonForVisit,
  ViewPriorityImage,
} from "./pending";

import Priority from "./priority";

import useSWDS from "./hooks/useSWDS";

// Firestore document containing the current SWDS service assignments.
const ASSIGNMENT_DOC = "swds_service_assignments";
const ASSIGNMENT_DOC_ID = "current";

// The specific service that controls visibility of the Pending UI.
const GUIDANCE_COUNSELING_SERVICE_ID = "guidance_counseling";

const GUIDANCE_COUNSELING_SERVICE_NAMES = [
  "guidance_counseling",
  "Guidance and Counseling Services",
  "Guidance & Counseling Services",
];

// SWDS services.
// The IDs and names must match the Staff Management component.
const SWDS_SERVICES = [
  {
    id: "admission_recruitment",
    name: "Admission and Recruitment Services",
  },
  {
    id: "psychological_wellness",
    name: "Psychological and Wellness Services",
  },
  {
    id: "guidance_counseling",
    name: "Guidance and Counseling Services",
  },
  {
    id: "information_orientation",
    name: "Orientation and Information Services",
  },
  {
    id: "career_placement_peso",
    name: "Career and Placement Services and PESO",
  },
  {
    id: "student_organizations",
    name: "Student Organizations",
  },
  {
    id: "special_needs_pwd",
    name: "Services for Students with Special Needs & PWDs",
  },
  {
    id: "economic_enterprise",
    name: "Economic Enterprise Development",
  },
  {
    id: "university_student_council",
    name: "University Student Council",
  },
  {
    id: "multi_faith",
    name: "Multi-Faith Services",
  },
];

const normalizeServiceName = (value = "") => {
  return String(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

// Extract service names and IDs from an appointment.
// Supports the different service field formats used in Firestore.
const getAppointmentServiceNames = (appointment = {}) => {
  const services = [];

  const addService = (value) => {
    if (!value) return;

    if (typeof value === "string") {
      services.push(value);
      return;
    }

    if (typeof value === "object" && !Array.isArray(value)) {
      const possibleValues = [
        value.serviceId,
        value.service_id,
        value.id,
        value.serviceName,
        value.service,
        value.name,
        value.label,
        value.title,
        value.value,
      ];

      possibleValues.forEach((item) => {
        if (
          item &&
          typeof item === "string" &&
          !services.includes(item)
        ) {
          services.push(item);
        }
      });
    }
  };

  if (Array.isArray(appointment.services)) {
    appointment.services.forEach(addService);
  } else {
    addService(appointment.services);
  }

  if (Array.isArray(appointment.selectedServices)) {
    appointment.selectedServices.forEach(addService);
  } else {
    addService(appointment.selectedServices);
  }

  if (Array.isArray(appointment.serviceNames)) {
    appointment.serviceNames.forEach(addService);
  } else {
    addService(appointment.serviceNames);
  }

  if (Array.isArray(appointment.serviceIds)) {
    appointment.serviceIds.forEach(addService);
  } else {
    addService(appointment.serviceIds);
  }

  if (Array.isArray(appointment.selectedServiceIds)) {
    appointment.selectedServiceIds.forEach(addService);
  } else {
    addService(appointment.selectedServiceIds);
  }

  addService(appointment.service);
  addService(appointment.serviceName);
  addService(appointment.selectedService);
  addService(appointment.serviceId);
  addService(appointment.service_id);

  return [...new Set(services)];
};

// Determine whether an appointment belongs to one of the
// specified services.
const isAppointmentForAssignedServices = (
  appointment = {},
  assignedServiceNames = []
) => {
  if (!assignedServiceNames.length) {
    return false;
  }

  const appointmentServices =
    getAppointmentServiceNames(appointment);

  if (!appointmentServices.length) {
    return false;
  }

  const normalizedAppointmentServices =
    appointmentServices.map(normalizeServiceName);

  return normalizedAppointmentServices.some((appointmentService) =>
    assignedServiceNames.some(
      (assignedService) =>
        normalizeServiceName(assignedService) ===
        appointmentService
    )
  );
};

// Check whether an appointment specifically belongs to
// Guidance and Counseling Services.
const isGuidanceCounselingAppointment = (appointment = {}) => {
  return isAppointmentForAssignedServices(
    appointment,
    GUIDANCE_COUNSELING_SERVICE_NAMES
  );
};

// Check whether the currently authenticated staff member
// owns the current Guidance and Counseling assignment.
//
// Matches by UID first, and falls back to matching by email.
const isStaffAssignedToService = (
  assignment,
  staff
) => {
  if (!assignment || !staff) {
    return false;
  }

  const assignedStaffId = String(
    assignment.staffId || ""
  ).trim();

  const currentUid = String(
    staff.uid || ""
  ).trim();

  if (assignedStaffId && currentUid && assignedStaffId === currentUid) {
    return true;
  }

  const assignedStaffEmail = String(
    assignment.staffEmail || ""
  )
    .trim()
    .toLowerCase();

  const currentEmail = String(
    staff.email || ""
  )
    .trim()
    .toLowerCase();

  if (
    assignedStaffEmail &&
    currentEmail &&
    assignedStaffEmail === currentEmail
  ) {
    return true;
  }

  return false;
};

export default function Swds({
  appointments = [],
  completeAppointment,
  setSelectedImage,
}) {
  const [currentStaff, setCurrentStaff] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  /*
   * Assignment listener state.
   */
  const [assignmentState, setAssignmentState] = useState({
    assignments: {},
    ready: false,
    error: "",
  });

  // Listen for the currently authenticated staff member.
  useEffect(() => {
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setCurrentStaff(user || null);
        setAuthReady(true);
      },
      (error) => {
        console.error(
          "SWDS authentication listener error:",
          error
        );

        setCurrentStaff(null);
        setAuthReady(true);
      }
    );

    return () => unsubscribe();
  }, []);

  // Derive the current assignment data.
  const serviceAssignments = useMemo(
    () => assignmentState.assignments || {},
    [assignmentState.assignments]
  );

  const assignmentsReady = Boolean(
    authReady &&
      currentStaff &&
      assignmentState.ready
  );

  const assignmentError = assignmentState.error || "";

  // Listen for service assignment changes in real time.
  // Changes made in Staff Management automatically reflect
  // on the staff dashboard.
  useEffect(() => {
    if (!authReady || !currentStaff) {
      return;
    }

    const db = getFirestore();

    const assignmentRef = doc(
      db,
      ASSIGNMENT_DOC,
      ASSIGNMENT_DOC_ID
    );

    const unsubscribe = onSnapshot(
      assignmentRef,
      (snapshot) => {
        const savedAssignments = snapshot.exists()
          ? snapshot.data()?.assignments || {}
          : {};

        setAssignmentState({
          assignments: savedAssignments,
          ready: true,
          error: "",
        });
      },
      (error) => {
        console.error(
          "Error listening to SWDS service assignments:",
          error
        );

        setAssignmentState({
          assignments: {},
          ready: true,
          error:
            "Unable to load your SWDS service assignments. Please contact the administrator.",
        });
      }
    );

    return () => unsubscribe();
  }, [currentStaff, authReady]);

  // Get the service IDs assigned to the currently logged-in staff member.
  //
  // The Staff Management component saves assignments using:
  // {
  //   staffId,
  //   staffName,
  //   staffEmail
  // }
  //
  // UID is authoritative when staffId is available.
  // Email is only used as a fallback.
  const currentStaffAssignedServiceIds = useMemo(() => {
    if (!currentStaff || !assignmentsReady) return [];

    return Object.entries(serviceAssignments)
      .filter(([serviceId, assignment]) => {
        if (!assignment) return false;

        const isValidService = SWDS_SERVICES.some(
          (service) => service.id === serviceId
        );

        if (!isValidService) {
          return false;
        }

        return isStaffAssignedToService(
          assignment,
          currentStaff
        );
      })
      .map(([serviceId]) => serviceId);
  }, [
    currentStaff,
    serviceAssignments,
    assignmentsReady,
  ]);

  // Convert the assigned service IDs into both their IDs and names.
  //
  // This supports appointments that store either:
  // - guidance_counseling
  // - Guidance and Counseling Services
  const currentStaffAssignedServiceNames = useMemo(() => {
    if (!currentStaffAssignedServiceIds.length) {
      return [];
    }

    const assignedServices = SWDS_SERVICES.filter(
      (service) =>
        currentStaffAssignedServiceIds.includes(service.id)
    );

    return assignedServices.flatMap((service) => [
      service.id,
      service.name,
    ]);
  }, [currentStaffAssignedServiceIds]);

  /*
   * GUIDANCE COUNSELING ASSIGNMENT CHECK.
   *
   * Checks whether the current staff member matches the
   * saved assignment for guidance_counseling.
   */
  const isCurrentStaffAssignedToGuidanceCounseling =
    useMemo(() => {
      if (
        !authReady ||
        !assignmentsReady ||
        !currentStaff
      ) {
        return false;
      }

      const guidanceAssignment =
        serviceAssignments[GUIDANCE_COUNSELING_SERVICE_ID];

      if (!guidanceAssignment) {
        return false;
      }

      const isAssigned = isStaffAssignedToService(
        guidanceAssignment,
        currentStaff
      );

      console.log("SWDS Guidance Assignment Check:", {
        currentStaffUid: currentStaff.uid || "",
        currentStaffEmail: currentStaff.email || "",
        assignedStaffId: guidanceAssignment.staffId || "",
        assignedStaffEmail:
          guidanceAssignment.staffEmail || "",
        assignedServiceNames: currentStaffAssignedServiceNames,
        isAssigned,
      });

      return isAssigned;
    }, [
      authReady,
      assignmentsReady,
      currentStaff,
      serviceAssignments,
      currentStaffAssignedServiceNames,
    ]);

  const {
    officeName,
    todayKey,
    currentQueueHour,

    officeAppointments,
    validAppointments,
    completedCount,

    pendingAppointments,
    priorityLaneQueue,
    normalPendingAppointments,

    currentServing,
    upcomingQueue,
    laterDisplayAppointments,

    appointmentToReject,
    rejectionReason,
    isRejecting,
    rejectionError,

    processingId,
    actionError,
    actionSuccess,

    setActionError,
    setActionSuccess,
    setRejectionReason,

    handleAcceptAppointment,
    handleStartServing,
    handleCompleteAppointment,

    openRejectModal,
    closeRejectModal,
    handleConfirmRejection,

    getServiceLabel,
    getQueueNumber,
    getStatus,
  } = useSWDS({
    appointments,
    completeAppointment,
  });

  // PRIORITY LANE:
  //
  // All SWDS staff can see all pending priority appointments.
  // Do not filter this list according to service assignment.
  const allPriorityLaneAppointments = useMemo(() => {
    return Array.isArray(priorityLaneQueue)
      ? priorityLaneQueue
      : [];
  }, [priorityLaneQueue]);

  // NORMAL PENDING APPOINTMENTS:
  //
  // The Pending UI is exclusively for Guidance and Counseling.
  //
  // Only the staff member assigned to guidance_counseling
  // receives Guidance and Counseling pending appointments.
  const currentStaffNormalPendingAppointments = useMemo(() => {
    if (
      !authReady ||
      !assignmentsReady ||
      !currentStaff ||
      !isCurrentStaffAssignedToGuidanceCounseling
    ) {
      return [];
    }

    const pendingList = Array.isArray(normalPendingAppointments)
      ? normalPendingAppointments
      : [];

    return pendingList.filter(
      isGuidanceCounselingAppointment
    );
  }, [
    authReady,
    assignmentsReady,
    currentStaff,
    isCurrentStaffAssignedToGuidanceCounseling,
    normalPendingAppointments,
  ]);

  // Pending Approval metric:
  // Only count Guidance and Counseling pending appointments
  // when the current staff member owns that service assignment.
  const currentStaffPendingCount = useMemo(() => {
    if (
      !authReady ||
      !assignmentsReady ||
      !currentStaff ||
      !isCurrentStaffAssignedToGuidanceCounseling
    ) {
      return 0;
    }

    const pendingList = Array.isArray(pendingAppointments)
      ? pendingAppointments
      : [];

    return pendingList.filter(
      isGuidanceCounselingAppointment
    ).length;
  }, [
    authReady,
    assignmentsReady,
    currentStaff,
    isCurrentStaffAssignedToGuidanceCounseling,
    pendingAppointments,
  ]);

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

      {/* Service assignment loading/error feedback */}
      {authReady && currentStaff && !assignmentsReady && (
        <div
          role="status"
          className="mb-4 flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-700"
        >
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          Loading your assigned SWDS services...
        </div>
      )}

      {assignmentError && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{assignmentError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 w-full">
        {/* Left Column */}
        <div className="flex flex-col gap-4 sm:gap-6">
          {/* Reusable Now Serving Component */}
          <Serving
            currentServing={currentServing}
            officeName={officeName}
            getServiceLabel={getServiceLabel}
            processingId={processingId}
            handleCompleteAppointment={handleCompleteAppointment}
            setSelectedImage={setSelectedImage}
          />

          {/* Reusable Priority Lane Component */}
          {/* Visible to ALL SWDS staff, regardless of assignment. */}
          <Priority
            officeName={officeName}
            priorityLaneQueue={allPriorityLaneAppointments}
            processingId={processingId}
            onAccept={handleAcceptAppointment}
            onReject={openRejectModal}
            setSelectedImage={setSelectedImage}
          />

          {/*
            Reusable Normal Pending Appointments Component.

            IMPORTANT:
            The entire Pending component is rendered ONLY when
            the currently authenticated staff member matches
            the current Firestore assignment for guidance_counseling.

            UID is authoritative when staffId exists.
            Email is only used as a fallback when staffId is unavailable.

            The assigned service names are also checked to ensure
            the current staff member owns guidance_counseling.

            If the administrator changes the assigned staff member,
            the real-time Firestore listener updates this condition.
          */}
          {authReady &&
            assignmentsReady &&
            currentStaff &&
            isCurrentStaffAssignedToGuidanceCounseling && (
              <Pending
                officeName={officeName}
                normalPendingAppointments={
                  currentStaffNormalPendingAppointments
                }
                processingId={processingId}
                onAccept={handleAcceptAppointment}
                onReject={openRejectModal}
                setSelectedImage={setSelectedImage}
              />
            )}

          <Later
            appointments={laterDisplayAppointments}
            officeName={officeName}
          />

          {/* Future Appointments now use the same Postpone workflow as Upcoming Queue. */}
          <Future
            appointments={validAppointments}
            officeName={officeName}
            todayKey={todayKey}
            onReject={openRejectModal}
            processingId={processingId}
          />
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
              Automatically approved appointments, accepted
              counseling appointments, and registered walk-ins
              with assigned queue numbers appear here.
            </p>

            <p className="text-xs text-slate-500 mb-4">
              Current hourly queue:{" "}
              <span className="font-semibold text-slate-700">
                {String(currentQueueHour).padStart(2, "0")}:00 -{" "}
                {String((currentQueueHour + 1) % 24).padStart(
                  2,
                  "0"
                )}
                :00
              </span>
            </p>

            {upcomingQueue.length === 0 ? (
              <div className="py-8 sm:py-12 text-center">
                <p className="text-slate-500 text-sm font-medium px-2">
                  No accepted appointments in the current hourly
                  queue for {officeName}.
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
                          onClick={() => handleStartServing(item)}
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
                          onClick={() => openRejectModal(item)}
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
                  {authReady && assignmentsReady
                    ? currentStaffPendingCount
                    : 0}
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
                    {appointmentToReject.userName ||
                      "Unknown Student"}
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
                  This reason will be saved in both appointments
                  and rejected-appointments.
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
