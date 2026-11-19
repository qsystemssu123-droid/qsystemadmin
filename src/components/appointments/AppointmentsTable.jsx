
import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Link2,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  QrCode,
  X,
  Smartphone,
  ExternalLink
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { auth, db } from '../../services/firebase.js';

const ADMIN_EMAIL = 'qsystemssu123@gmail.com';

export default function AppointmentsTable({
  filteredAppointments = [],
  searchTerm = '',
  setSearchTerm,

  // Preserve existing props and feedback functionality.
  ...tableOptions
}) {
  const [currentUser, setCurrentUser] = useState(null);
  const [staffOffice, setStaffOffice] = useState(null);
  const [accessLoading, setAccessLoading] = useState(true);

  // Existing feedback button states.
  const [copiedAction, setCopiedAction] = useState(null);
  const [actionError, setActionError] = useState('');

  // QR code modal state.
  const [qrAppointment, setQrAppointment] = useState(null);

  // Existing feedback props.
  const {
    getAppointmentFeedbackLink,
    copyFeedbackReference,
    copyFeedbackLink,
    copyingFeedbackId,
    feedbackCopyError
  } = tableOptions;

  const isAdmin =
    currentUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  // Load administrator or staff access from Firebase.
  useEffect(() => {
    let active = true;
    let requestId = 0;

    const loadUserAccess = async (user) => {
      const currentRequest = ++requestId;

      if (!active) return;

      setCurrentUser(user);
      setStaffOffice(null);
      setAccessLoading(true);

      if (!user) {
        setAccessLoading(false);
        return;
      }

      if (
        user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
      ) {
        setAccessLoading(false);
        return;
      }

      try {
        const staffQuery = query(
          collection(db, 'staff'),
          where('email', '==', user.email)
        );

        const staffSnapshot = await getDocs(staffQuery);

        if (!active || currentRequest !== requestId) {
          return;
        }

        if (!staffSnapshot.empty) {
          const staffData = staffSnapshot.docs[0].data();

          const assignedOffice = String(
            staffData.office || ''
          )
            .trim()
            .toUpperCase();

          if (assignedOffice) {
            setStaffOffice(assignedOffice);
          }
        }
      } catch (error) {
        console.error(
          'Failed to load staff access:',
          error
        );
      } finally {
        if (active && currentRequest === requestId) {
          setAccessLoading(false);
        }
      }
    };

    const unsubscribe = onAuthStateChanged(
      auth,
      loadUserAccess,
      (error) => {
        console.error(
          'Authentication error:',
          error
        );

        if (active) {
          setAccessLoading(false);
        }
      }
    );

    return () => {
      active = false;
      requestId++;
      unsubscribe();
    };
  }, []);

  // Administrator can view all appointments.
  // Staff can only view appointments from their office.
  // Office filtering remains active even though the Office column is hidden.
  const accessibleAppointments = useMemo(() => {
    if (!currentUser) {
      return [];
    }

    const appointments = Array.isArray(filteredAppointments)
      ? filteredAppointments
      : [];

    if (isAdmin) {
      return appointments;
    }

    if (!staffOffice) {
      return [];
    }

    return appointments.filter((appointment) => {
      const appointmentOffice = String(
        appointment?.office || ''
      )
        .trim()
        .toUpperCase();

      return appointmentOffice === staffOffice;
    });
  }, [
    currentUser,
    isAdmin,
    staffOffice,
    filteredAppointments
  ]);

  // Search functionality.
  const displayedAppointments = useMemo(() => {
    const normalizedSearch = String(searchTerm || '')
      .trim()
      .toLowerCase();

    if (!normalizedSearch) {
      return accessibleAppointments;
    }

    return accessibleAppointments.filter((appointment) => {
      const searchableText = [
        appointment?.userName,
        appointment?.userEmail,
        appointment?.service,
        appointment?.reason,
        appointment?.queueNumber,
        appointment?.office,
        appointment?.status
      ]
        .filter(Boolean)
        .map((value) => String(value))
        .join(' ')
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });
  }, [
    accessibleAppointments,
    searchTerm
  ]);

  // Copy a personalized feedback link or reference.
  const handleCopyFeedback = async (appointment, action) => {
    setActionError('');
    setCopiedAction(null);

    try {
      if (action === 'link') {
        if (typeof copyFeedbackLink !== 'function') {
          throw new Error(
            'Copy feedback link functionality is unavailable.'
          );
        }

        await copyFeedbackLink(appointment);
      } else {
        if (typeof copyFeedbackReference !== 'function') {
          throw new Error(
            'Copy feedback reference functionality is unavailable.'
          );
        }

        await copyFeedbackReference(appointment);
      }

      setCopiedAction(`${appointment.id}-${action}`);
    } catch (error) {
      console.error('Feedback copy failed:', error);

      setActionError(
        error.message || 'Unable to copy feedback information.'
      );
    }
  };

  // Open QR code modal.
  const handleShowFeedbackQR = (appointment) => {
    setActionError('');

    if (
      String(appointment?.status || '')
        .trim()
        .toLowerCase() !== 'completed'
    ) {
      setActionError(
        'Feedback QR codes are only available for completed appointments.'
      );
      return;
    }

    if (
      typeof getAppointmentFeedbackLink !== 'function'
    ) {
      setActionError(
        'Feedback link generation is unavailable.'
      );
      return;
    }

    const link = getAppointmentFeedbackLink(appointment);

    if (!link) {
      setActionError(
        'This appointment does not have a valid feedback reference yet.'
      );
      return;
    }

    setQrAppointment({
      ...appointment,
      feedbackLink: link
    });
  };

  // Close QR code modal.
  const handleCloseFeedbackQR = () => {
    setQrAppointment(null);
  };

  // Close modal with Escape key.
  useEffect(() => {
    if (!qrAppointment) {
      return;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setQrAppointment(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [qrAppointment]);

  // Loading state.
  if (accessLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-3 text-sm font-semibold text-slate-500">
            <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"></div>
            Loading appointment access...
          </div>
        </div>
      </div>
    );
  }

  // Authentication required.
  if (!currentUser) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="text-center py-16 text-slate-400">
          You must be logged in to view appointments.
        </div>
      </div>
    );
  }

  // Staff must have an assigned office.
  if (!isAdmin && !staffOffice) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="text-center py-16 px-6">
          <p className="font-bold text-slate-700">
            Staff access is not configured.
          </p>

          <p className="text-sm text-slate-400 mt-1">
            Your account does not have a valid office assignment in the
            staff collection.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Appointment Table Header */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">
                Live Appointment Queue
              </h2>

              <p className="text-xs text-slate-500 mt-1">
                {isAdmin
                  ? 'View and manage student queues across all offices in real-time.'
                  : `Showing appointments for ${staffOffice} only.`}
              </p>
            </div>

            {/* Search Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

                <input
                  type="text"
                  placeholder="Search user or service..."
                  value={searchTerm}
                  onChange={(e) => {
                    if (typeof setSearchTerm === 'function') {
                      setSearchTerm(e.target.value);
                    }
                  }}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Feedback copy error */}
        {(actionError || feedbackCopyError) && (
          <div className="mx-6 mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{actionError || feedbackCopyError}</span>
          </div>
        )}

        {/* Appointments Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100">
              <tr>
                <th className="px-6 py-3.5">
                  Queue #
                </th>

                <th className="px-6 py-3.5">
                  Student / User
                </th>

                {/* Office column removed from the table display. */}

                <th className="px-6 py-3.5">
                  Requested Service
                </th>

                <th className="px-6 py-3.5">
                  Date & Time
                </th>

                <th className="px-6 py-3.5">
                  Status
                </th>

                {/* Feedback actions */}
                <th className="px-6 py-3.5">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {displayedAppointments.length > 0 ? (
                displayedAppointments.map((appt) => {
                  const statusLower = String(
                    appt.status || ''
                  )
                    .trim()
                    .toLowerCase();

                  const isCompleted =
                    statusLower === 'completed';

                  const isApproved =
                    statusLower === 'approved';

                  const isRejected =
                    statusLower === 'rejected';

                  const isServing =
                    statusLower === 'serving' ||
                    statusLower === 'in-progress';

                  const hasFeedbackReference =
                    typeof appt.feedbackReference === 'string' &&
                    /^[a-f0-9]{48}$/i.test(
                      appt.feedbackReference.trim()
                    );

                  const feedbackLink =
                    isCompleted &&
                    hasFeedbackReference &&
                    typeof getAppointmentFeedbackLink === 'function'
                      ? getAppointmentFeedbackLink(appt)
                      : '';

                  const isCopying =
                    copyingFeedbackId === appt.id;

                  const linkCopied =
                    copiedAction === `${appt.id}-link`;

                  const referenceCopied =
                    copiedAction === `${appt.id}-reference`;

                  return (
                    <tr
                      key={appt.id}
                      className="hover:bg-sky-50/40 transition-colors"
                    >
                      {/* Queue Number */}
                      <td className="px-6 py-4 font-bold text-sky-700">
                        {appt.queueNumber || '#---'}
                      </td>

                      {/* Student Information */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {appt.userPhoto ? (
                            <img
                              src={appt.userPhoto}
                              alt={appt.userName || 'User'}
                              className="w-8 h-8 rounded-full border border-slate-200 object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs">
                              {appt.userName?.charAt(0) || 'U'}
                            </div>
                          )}

                          <div>
                            <p className="font-bold text-slate-800">
                              {appt.userName || 'Anonymous User'}
                            </p>

                            <p className="text-[11px] text-slate-400">
                              {appt.userEmail}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Office table cell removed. Office data remains
                          available for filtering and the feedback QR modal. */}

                      {/* Requested Service */}
                      <td className="px-6 py-4 font-medium text-slate-800">
                        {appt.service}
                      </td>

                      {/* Appointment Date and Time */}
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-700">
                          {appt.appointmentDate || appt.queueDate || 'N/A'}
                        </p>

                        <p className="text-[11px] text-slate-400">
                          {appt.appointmentTime || ''}
                        </p>
                      </td>

                      {/* Appointment Status */}
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                            isCompleted
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : isApproved
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : isRejected
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : isServing
                              ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isCompleted
                                ? 'bg-emerald-500'
                                : isApproved
                                ? 'bg-blue-500'
                                : isRejected
                                ? 'bg-rose-500'
                                : isServing
                                ? 'bg-amber-500'
                                : 'bg-amber-500'
                            }`}
                          ></span>

                          {appt.status
                            ? String(appt.status).toUpperCase()
                            : 'WAITING'}
                        </span>
                      </td>

                      {/* Feedback Actions */}
                      <td className="px-6 py-4">
                        {isCompleted ? (
                          hasFeedbackReference && feedbackLink ? (
                            <div className="flex flex-col gap-2 min-w-[150px]">
                              {/* Show Feedback QR */}
                              <button
                                type="button"
                                onClick={() =>
                                  handleShowFeedbackQR(appt)
                                }
                                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-emerald-700 transition-colors"
                              >
                                <QrCode className="h-3.5 w-3.5" />
                                Show Feedback QR
                              </button>

                              {/* Copy Feedback Link */}
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopyFeedback(appt, 'link')
                                }
                                disabled={isCopying}
                                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
                              >
                                {isCopying ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : linkCopied ? (
                                  <Check className="h-3.5 w-3.5" />
                                ) : (
                                  <Link2 className="h-3.5 w-3.5" />
                                )}

                                {linkCopied
                                  ? 'Link Copied!'
                                  : 'Copy Feedback Link'}
                              </button>

                              {/* Copy Reference */}
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopyFeedback(appt, 'reference')
                                }
                                disabled={isCopying}
                                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60"
                              >
                                {referenceCopied ? (
                                  <Check className="h-3.5 w-3.5" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}

                                {referenceCopied
                                  ? 'Reference Copied!'
                                  : 'Copy Reference'}
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-amber-600 font-medium">
                              Reference unavailable
                            </span>
                          )
                        ) : (
                          <span className="text-[11px] text-slate-400">
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-10 text-slate-400"
                  >
                    {isAdmin
                      ? 'No appointments match the selected search criteria.'
                      : `No ${staffOffice} appointments match the selected search criteria.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Feedback QR Code Modal */}
      {qrAppointment && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              handleCloseFeedbackQR();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-qr-title"
            className="relative w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-2xl"
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={handleCloseFeedbackQR}
              aria-label="Close feedback QR code"
              className="absolute right-4 top-4 rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Modal Header */}
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <QrCode className="h-7 w-7" />
              </div>

              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-700">
                QueueMatrix Feedback
              </p>

              <h2
                id="feedback-qr-title"
                className="mt-2 text-2xl font-black text-slate-900"
              >
                Rate Your Experience
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Scan this QR code to submit your rating and review.
              </p>
            </div>

            {/* Appointment Details */}
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
              <p className="text-xs font-bold text-sky-700">
                {qrAppointment.queueNumber || 'Completed Appointment'}
              </p>

              <p className="mt-1 text-sm font-semibold text-slate-800">
                {qrAppointment.office || 'Student Services'}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {qrAppointment.service || ''}
              </p>
            </div>

            {/* Actual QR Code */}
            <div className="mt-6 flex justify-center">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <QRCodeSVG
                  value={qrAppointment.feedbackLink}
                  size={240}
                  level="M"
                  marginSize={4}
                  bgColor="#FFFFFF"
                  fgColor="#000000"
                  title="QueueMatrix Appointment Feedback QR Code"
                />
              </div>
            </div>

            {/* Scan Instructions */}
            <div className="mt-5 flex items-center justify-center gap-2 text-slate-600">
              <Smartphone className="h-4 w-4 text-sky-600" />
              <span className="text-xs font-medium">
                Open your phone camera and scan the QR code
              </span>
            </div>

            <p className="mt-3 text-center text-xs text-slate-400">
              No login required. One feedback submission per appointment.
            </p>

            {/* Modal Actions */}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() =>
                  handleCopyFeedback(qrAppointment, 'link')
                }
                disabled={copyingFeedbackId === qrAppointment.id}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60"
              >
                <Copy className="h-4 w-4" />
                Copy Link
              </button>

              <a
                href={qrAppointment.feedbackLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-3 py-3 text-xs font-bold text-white hover:bg-sky-700 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Open Link
              </a>
            </div>

            {/* Website URL Notice */}
            {qrAppointment.feedbackLink.includes('localhost') && (
              <p className="mt-4 text-center text-xs font-semibold text-amber-600">
                Testing mode: this QR code uses localhost.
                Deploy your website and configure
                VITE_FEEDBACK_SITE_URL before students scan it.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
