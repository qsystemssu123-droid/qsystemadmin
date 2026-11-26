
import {
  XCircle,
  AlertTriangle,
  Loader2,
  Play,
} from "lucide-react";

import WalkIn from "./walk-in";
import Future from "./future";
import Later from "./later";
import Serving from "./serving";

import Pending, {
  ReasonForVisit,
  ViewPriorityImage,
} from "./pending";

import useSWDS from "./hooks/useSWDS";

export default function Swds({
  appointments = [],
  completeAppointment,
  setSelectedImage,
}) {
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
          {/* Reusable Now Serving Component */}
          <Serving
            currentServing={currentServing}
            officeName={officeName}
            getServiceLabel={getServiceLabel}
            processingId={processingId}
            handleCompleteAppointment={handleCompleteAppointment}
            setSelectedImage={setSelectedImage}
          />

          {/* Reusable Pending Component */}
          <Pending
            officeName={officeName}
            priorityLaneQueue={priorityLaneQueue}
            normalPendingAppointments={normalPendingAppointments}
            processingId={processingId}
            onAccept={handleAcceptAppointment}
            onReject={openRejectModal}
            setSelectedImage={setSelectedImage}
          />

          <Later
            appointments={laterDisplayAppointments}
            officeName={officeName}
          />

          <Future
            appointments={validAppointments}
            officeName={officeName}
            todayKey={todayKey}
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
                    // The hook owns the rejection error state.
                    // Clear it through the returned setter.
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
