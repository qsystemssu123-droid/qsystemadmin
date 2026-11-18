
import { useState } from "react";
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

const OFFICE_NAME = "SWDS";
const PUBLIC_QUEUE_COLLECTION = "queues";

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
  tickets.filter((ticket) => ticket.appointmentId !== appointmentId);


const getStatus = (item) =>
  String(item?.status || "pending").trim().toLowerCase();

const isPending = (item) =>
  ["pending", "waiting"].includes(getStatus(item));

const isApproved = (item) =>
  getStatus(item) === "approved";

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

// Declared outside Swds to satisfy react-hooks/static-components.
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

// Also declared outside Swds. All callbacks arrive as props.
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
            <p className="text-xs text-slate-500 truncate">
              {item.office} -{" "}
              {item.service || item.reason || "Appointment"}
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
            Reject
          </button>
        </div>
      </div>

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

  const pendingAppointments = validAppointments
    .filter(isPending)
    .sort((a, b) => getTimestamp(a) - getTimestamp(b));

  const priorityLaneQueue = pendingAppointments.filter(
    (item) => item.isPriority
  );

  const normalPendingAppointments =
    pendingAppointments.filter((item) => !item.isPriority);

  const approvedPriority = validAppointments
    .filter(
      (item) =>
        item.isPriority &&
        isApproved(item) &&
        item.queueNumber
    )
    .sort((a, b) => getTimestamp(a) - getTimestamp(b));

  const normalAppointments = validAppointments
    .filter(
      (item) =>
        !item.isPriority &&
        isApproved(item) &&
        item.queueNumber
    )
    .sort((a, b) => getTimestamp(a) - getTimestamp(b));

  const currentServing =
    validAppointments.find(isServing) || null;

  const upcomingQueue = [
    ...approvedPriority,
    ...normalAppointments,
  ];

  const clearMessages = () => {
    setActionError("");
    setActionSuccess("");
  };

  // Staff accepts booking. Only now is a queue number created.
  const handleAcceptAppointment = async (item) => {
    if (processingId) return;

    const currentStaff = auth.currentUser;
    if (!currentStaff) {
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

      const publicQueueRef = doc(db, PUBLIC_QUEUE_COLLECTION, officeName);

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
            throw new Error("The appointment could not be found.");
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

          if (!["pending", "waiting"].includes(currentStatus)) {
            throw new Error(
              "Only pending appointments can be accepted."
            );
          }

          const existingNumbers = officeAppointments
            .filter((appointment) => appointment.id !== item.id)
            .map((appointment) => {
              const raw = String(
                appointment.queueNumber || ""
              );
              const match = raw.match(/(\d+)$/);
              return match ? Number(match[1]) : 0;
            });

          const highestExisting = Math.max(
            0,
            ...existingNumbers
          );

          const storedCounter = Number(
            counterSnapshot.exists()
              ? counterSnapshot.data().lastNumber || 0
              : 0
          );

          const nextNumber =
            Math.max(storedCounter, highestExisting) + 1;

          const queueNumber = `SWDS-${String(
            nextNumber
          ).padStart(3, "0")}`;

          transaction.set(
            counterRef,
            {
              office: officeName,
              lastNumber: nextNumber,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          const tickets = readTickets(publicSnapshot.data());
          transaction.set(publicQueueRef, {
            office: officeName,
            tickets: [
              ...withoutTicket(tickets, item.id),
              publicTicket({ ...appointmentData, id: item.id, queuePosition: nextNumber }, "approved", queueNumber),
            ],
            updatedAt: serverTimestamp(),
          }, { merge: true });

          transaction.update(appointmentRef, {
            status: "approved",
            queueNumber,
            queuePosition: nextNumber,
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
      console.error("Failed to accept appointment:", error);
      setActionError(
        error?.message || "Failed to accept appointment."
      );
    } finally {
      setProcessingId(null);
    }
  };

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

      const publicQueueRef = doc(db, PUBLIC_QUEUE_COLLECTION, officeName);

      await runTransaction(db, async (transaction) => {
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
            "Only approved appointments can be served."
          );
        }

        if (!data.queueNumber) {
          throw new Error(
            "This appointment has no assigned queue number."
          );
        }

        const publicData = publicSnapshot.data() || {};
        if (publicData.nowServing && publicData.nowServing !== data.queueNumber) {
          throw new Error("Another ticket is currently being served.");
        }
        const tickets = readTickets(publicData);
        transaction.set(publicQueueRef, {
          office: officeName,
          nowServing: data.queueNumber,
          tickets: [
            ...withoutTicket(tickets, item.id),
            publicTicket({ ...data, id: item.id }, "in-progress"),
          ],
          updatedAt: serverTimestamp(),
        }, { merge: true });

        transaction.update(appointmentRef, {
          status: "in-progress",
          servingAt: serverTimestamp(),
          servingBy: currentStaff.uid,
          servingByEmail: currentStaff.email || "",
        });
      });

      setActionSuccess(
        `Now serving ${item.queueNumber}.`
      );
    } catch (error) {
      console.error("Failed to start serving:", error);
      setActionError(
        error?.message || "Failed to start serving."
      );
    } finally {
      setProcessingId(null);
    }
  };

  // Existing completion callback is preserved.
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

      await completeAppointment(item.id);
      const publicQueueRef = doc(db, PUBLIC_QUEUE_COLLECTION, officeName);
      await runTransaction(db, async (transaction) => {
        const publicSnapshot = await transaction.get(publicQueueRef);
        const publicData = publicSnapshot.data() || {};
        transaction.set(publicQueueRef, {
          office: officeName,
          nowServing: publicData.nowServing === item.queueNumber ? "" : (publicData.nowServing || ""),
          tickets: withoutTicket(readTickets(publicData), item.id),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      });
      setActionSuccess(
        `Appointment ${item.queueNumber || ""} completed successfully.`
      );
    } catch (error) {
      console.error("Failed to complete appointment:", error);
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
      const publicQueueRef = doc(db, PUBLIC_QUEUE_COLLECTION, officeName);

      await runTransaction(db, async (transaction) => {
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

        const currentStatus = getStatus(appointmentData);

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

        transaction.set(rejectedAppointmentRef, {
          ...appointmentData,
          id: appointmentId,
          appointmentId,
          ...rejectionDetails,
        });

        const publicData = publicSnapshot.data() || {};
        transaction.set(publicQueueRef, {
          office: officeName,
          nowServing: publicData.nowServing === appointmentData.queueNumber ? "" : (publicData.nowServing || ""),
          tickets: withoutTicket(readTickets(publicData), appointmentId),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      });

      setAppointmentToReject(null);
      setRejectionReason("");
      setRejectionError("");
      setActionSuccess(
        "Appointment rejected successfully."
      );
    } catch (error) {
      console.error("Failed to reject appointment:", error);
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
                    {currentServing.userName ||
                      "Unknown Student"}
                  </p>

                  <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100 my-1 max-w-full truncate">
                    {currentServing.office} -{" "}
                    {currentServing.service ||
                      currentServing.reason}
                  </span>

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
                    No active ticket being served for{" "}
                    {officeName}.
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
                Priority bookings remain pending until staff
                accepts them and assigns a queue number.
              </p>

              {priorityLaneQueue.length === 0 ? (
                <div className="py-8 sm:py-12 text-center">
                  <p className="text-slate-500 text-sm font-medium px-2">
                    No pending priority bookings for{" "}
                    {officeName}.
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
              Regular bookings are pending until accepted
              by staff. No queue number is assigned yet.
            </p>

            {normalPendingAppointments.length === 0 ? (
              <div className="py-8 sm:py-12 text-center">
                <p className="text-slate-500 text-sm font-medium">
                  No pending regular appointments for{" "}
                  {officeName}.
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
              Only accepted appointments with assigned queue
              numbers appear here.
            </p>

            {upcomingQueue.length === 0 ? (
              <div className="py-8 sm:py-12 text-center">
                <p className="text-slate-500 text-sm font-medium px-2">
                  No accepted appointments in the upcoming
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
                            {item.userName ||
                              "Unknown Student"}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {item.office} -{" "}
                            {item.service ||
                              item.reason ||
                              "Appointment"}
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
                          title="Reject with reason"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </div>
                    </div>

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
                    Service
                  </span>
                  <span className="text-right text-xs font-semibold text-slate-900">
                    {appointmentToReject.service ||
                      appointmentToReject.reason ||
                      "N/A"}
                  </span>
                </div>
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
                  if (rejectionError) setRejectionError("");
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
                  This reason will be saved in both
                  appointments and rejected-appointments.
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
