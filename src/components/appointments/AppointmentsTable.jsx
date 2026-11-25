
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
  ExternalLink,
  Footprints,
  Globe,
  ArrowUpDown,
  Trash2,
  ChevronDown
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc
} from 'firebase/firestore';
import { auth, db } from '../../services/firebase.js';

const ADMIN_EMAIL = 'qsystemssu123@gmail.com';

// Parse Firestore Timestamp, Date, ISO string, or date/time fields into milliseconds.
const getAppointmentMillis = (appointment) => {
  if (!appointment || typeof appointment !== 'object') {
    return 0;
  }

  const parseTimestampField = (val) => {
    if (!val) return 0;
    if (typeof val.toMillis === 'function') return val.toMillis();
    if (typeof val.toDate === 'function') return val.toDate().getTime();
    if (typeof val.seconds === 'number') return val.seconds * 1000;
    if (typeof val === 'number') return Number.isFinite(val) ? val : 0;

    const parsed = new Date(val).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const rawDate = String(
    appointment.appointmentDate || appointment.queueDate || ''
  ).trim();

  const rawTime = String(appointment.appointmentTime || '').trim();

  if (rawDate) {
    const combined = rawTime ? `${rawDate} ${rawTime}` : rawDate;
    const parsedCombined = new Date(combined).getTime();

    if (Number.isFinite(parsedCombined) && parsedCombined > 0) {
      return parsedCombined;
    }

    const parsedDateOnly = new Date(rawDate).getTime();

    if (Number.isFinite(parsedDateOnly) && parsedDateOnly > 0) {
      return parsedDateOnly;
    }
  }

  const createdMs = parseTimestampField(appointment.createdAt);
  if (createdMs > 0) return createdMs;

  const approvedMs = parseTimestampField(appointment.approvedAt);
  if (approvedMs > 0) return approvedMs;

  return 0;
};

// Determine whether an appointment is walk-in or online.
const getBookingMode = (appointment) => {
  if (!appointment || typeof appointment !== 'object') {
    return 'online';
  }

  if (appointment.isWalkIn === true) {
    return 'walk-in';
  }

  const rawType = String(
    appointment.bookingType ||
      appointment.source ||
      appointment.channel ||
      appointment.type ||
      ''
  )
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');

  if (
    rawType === 'walk-in' ||
    rawType === 'walkin' ||
    rawType.includes('walk')
  ) {
    return 'walk-in';
  }

  if (
    rawType === 'online' ||
    rawType === 'web' ||
    rawType === 'mobile' ||
    rawType === 'app' ||
    rawType.includes('online')
  ) {
    return 'online';
  }

  if (
    appointment.registeredBy ||
    appointment.registeredByEmail
  ) {
    return 'walk-in';
  }

  return 'online';
};

export default function AppointmentsTable({
  filteredAppointments = [],
  searchTerm,
  setSearchTerm,
  ...tableOptions
}) {
  const [currentUser, setCurrentUser] = useState(null);
  const [staffOffice, setStaffOffice] = useState(null);
  const [accessLoading, setAccessLoading] = useState(true);

  // Internal search state.
  const [internalSearchState, setInternalSearchState] = useState(() => ({
    previousSearchTerm: searchTerm,
    value: searchTerm || ''
  }));

  // Synchronize internal search state only when the incoming prop changes.
  if (
    typeof setSearchTerm !== 'function' &&
    internalSearchState.previousSearchTerm !== searchTerm
  ) {
    setInternalSearchState({
      previousSearchTerm: searchTerm,
      value: searchTerm || ''
    });
  }

  // Use the parent's search state when available; otherwise use internal state.
  const activeSearchTerm =
    typeof setSearchTerm === 'function'
      ? searchTerm || ''
      : internalSearchState.value;

  // Sort order.
  const [sortOrder, setSortOrder] = useState('asc');

  // Delete state.
  const [deletingId, setDeletingId] = useState(null);

  // Feedback button states.
  const [copiedAction, setCopiedAction] = useState(null);
  const [actionError, setActionError] = useState('');

  // QR code modal state.
  const [qrAppointment, setQrAppointment] = useState(null);

  // Dropdown menu state.
  const [openActionMenuId, setOpenActionMenuId] = useState(null);

  // Existing feedback props and optional custom delete handler.
  const {
    getAppointmentFeedbackLink,
    copyFeedbackReference,
    copyFeedbackLink,
    copyingFeedbackId,
    feedbackCopyError,
    onDeleteAppointment
  } = tableOptions;

  const isAdmin =
    currentUser?.email?.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();

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

      if (user.email?.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
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

          const assignedOffice = String(staffData.office || '')
            .trim()
            .toUpperCase();

          if (assignedOffice) {
            setStaffOffice(assignedOffice);
          }
        }
      } catch (error) {
        console.error('Failed to load staff access:', error);
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
        console.error('Authentication error:', error);

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
  // Staff can only view appointments from their assigned office.
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
      const appointmentOffice = String(appointment?.office || '')
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

  // Search and sorting.
  const displayedAppointments = useMemo(() => {
    const normalizedSearch = String(activeSearchTerm || '')
      .trim()
      .toLowerCase();

    const filtered = accessibleAppointments.filter((appointment) => {
      if (!normalizedSearch) {
        return true;
      }

      const mode = getBookingMode(appointment);

      const modeLabel =
        mode === 'walk-in' ? 'walk in walk-in walkin' : 'online';

      const searchableText = [
        appointment?.userName,
        appointment?.userEmail,
        appointment?.service,
        appointment?.reason,
        appointment?.queueNumber,
        appointment?.office,
        appointment?.status,
        appointment?.bookingType,
        appointment?.source,
        appointment?.appointmentDate,
        appointment?.appointmentTime,
        appointment?.queueDate,
        mode,
        modeLabel
      ]
        .filter(Boolean)
        .map((value) => String(value))
        .join(' ')
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });

    return [...filtered].sort((a, b) => {
      const timeA = getAppointmentMillis(a);
      const timeB = getAppointmentMillis(b);

      if (timeA === timeB) {
        return String(a?.queueNumber || '').localeCompare(
          String(b?.queueNumber || ''),
          undefined,
          { numeric: true, sensitivity: 'base' }
        );
      }

      return sortOrder === 'asc'
        ? timeA - timeB
        : timeB - timeA;
    });
  }, [
    accessibleAppointments,
    activeSearchTerm,
    sortOrder
  ]);

  // Toggle individual appointment action dropdown.
  const handleToggleActionMenu = (appointmentId) => {
    setOpenActionMenuId((currentId) =>
      currentId === appointmentId ? null : appointmentId
    );
  };

  // Delete an appointment.
  // Only the administrator account is allowed to execute this action.
  const handleDeleteAppointment = async (appointment) => {
    setOpenActionMenuId(null);

    if (
      !currentUser ||
      currentUser.email?.trim().toLowerCase() !== ADMIN_EMAIL.toLowerCase()
    ) {
      setActionError('Access denied. Only the administrator can delete appointments.');
      return;
    }

    if (!appointment?.id) {
      setActionError('Unable to delete appointment: missing document ID.');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete appointment ${
        appointment.queueNumber || appointment.id
      } for ${appointment.userName || 'this student'}?`
    );

    if (!confirmed) {
      return;
    }

    setActionError('');
    setDeletingId(appointment.id);

    try {
      if (typeof onDeleteAppointment === 'function') {
        await onDeleteAppointment(appointment);
      } else {
        await deleteDoc(doc(db, 'appointments', appointment.id));
      }
    } catch (error) {
      console.error('Failed to delete appointment:', error);

      setActionError(
        error?.message || 'Unable to delete appointment.'
      );
    } finally {
      setDeletingId(null);
    }
  };

  // Copy a personalized feedback link or reference.
  const handleCopyFeedback = async (appointment, action) => {
    setOpenActionMenuId(null);
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
    setOpenActionMenuId(null);
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

    if (typeof getAppointmentFeedbackLink !== 'function') {
      setActionError('Feedback link generation is unavailable.');
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

  // Close dropdown when clicking outside or pressing Escape.
  useEffect(() => {
    if (!openActionMenuId) {
      return;
    }

    const handleOutsideClick = (event) => {
      if (!event.target.closest('[data-appointment-actions]')) {
        setOpenActionMenuId(null);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpenActionMenuId(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [openActionMenuId]);

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
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
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

            {/* Sort + Search Controls */}
            <div className="flex flex-wrap items-center gap-2.5">

              {/* Sort Order Dropdown */}
              <div className="relative inline-flex items-center">
                <ArrowUpDown className="w-3.5 h-3.5 text-sky-600 absolute left-3 pointer-events-none" />

                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  aria-label="Sort appointments order"
                  className="pl-8 pr-7 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all cursor-pointer"
                >
                  <option value="asc">Oldest → Newest</option>
                  <option value="desc">Newest → Oldest</option>
                </select>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-56">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

                <input
                  type="text"
                  placeholder="Search user, service, type..."
                  value={activeSearchTerm || ''}
                  onChange={(e) => {
                    if (typeof setSearchTerm === 'function') {
                      setSearchTerm(e.target.value);
                    } else {
                      setInternalSearchState((previous) => ({
                        ...previous,
                        value: e.target.value
                      }));
                    }
                  }}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Feedback copy / action error */}
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
                <th className="px-6 py-3.5">Queue #</th>
                <th className="px-6 py-3.5">Student / User</th>
                <th className="px-6 py-3.5">Booking Type</th>
                <th className="px-6 py-3.5">Requested Service</th>
                <th className="px-6 py-3.5">Date & Time</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {displayedAppointments.length > 0 ? (
                displayedAppointments.map((appt) => {
                  const statusLower = String(appt.status || '')
                    .trim()
                    .toLowerCase();

                  const isCompleted = statusLower === 'completed';
                  const isApproved = statusLower === 'approved';
                  const isRejected = statusLower === 'rejected';

                  const isServing =
                    statusLower === 'serving' ||
                    statusLower === 'in-progress';

                  const bookingMode = getBookingMode(appt);
                  const isWalkInAppointment = bookingMode === 'walk-in';

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

                  const isCopying = copyingFeedbackId === appt.id;
                  const isDeleting = deletingId === appt.id;

                  const linkCopied =
                    copiedAction === `${appt.id}-link`;

                  const referenceCopied =
                    copiedAction === `${appt.id}-reference`;

                  const isMenuOpen = openActionMenuId === appt.id;

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
                              {appt.userEmail ||
                                (isWalkInAppointment
                                  ? 'Walk-In Registration'
                                  : '')}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Walk-In or Online Type */}
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                            isWalkInAppointment
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          }`}
                        >
                          {isWalkInAppointment ? (
                            <>
                              <Footprints className="h-3 w-3 text-amber-700" />
                              Walk-In
                            </>
                          ) : (
                            <>
                              <Globe className="h-3 w-3 text-indigo-600" />
                              Online
                            </>
                          )}
                        </span>
                      </td>

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
                                : 'bg-amber-500'
                            }`}
                          ></span>

                          {appt.status
                            ? String(appt.status).toUpperCase()
                            : 'WAITING'}
                        </span>
                      </td>

                      {/* Selectable Actions Dropdown */}
                      <td className="px-6 py-4">
                        <div
                          className="relative inline-block min-w-[130px]"
                          data-appointment-actions
                        >
                          {/* Dropdown Toggle */}
                          <button
                            type="button"
                            onClick={() => handleToggleActionMenu(appt.id)}
                            aria-haspopup="menu"
                            aria-expanded={isMenuOpen}
                            disabled={isDeleting}
                            className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold transition-all focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                              isMenuOpen
                                ? 'border-sky-300 bg-sky-50 text-sky-700'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                            } disabled:opacity-60`}
                          >
                            {isDeleting ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Deleting...
                              </>
                            ) : (
                              <>
                                Actions
                                <ChevronDown
                                  className={`h-3.5 w-3.5 transition-transform ${
                                    isMenuOpen ? 'rotate-180' : ''
                                  }`}
                                />
                              </>
                            )}
                          </button>

                          {/* Dropdown Menu */}
                          {isMenuOpen && (
                            <div
                              role="menu"
                              className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10 animate-in fade-in slide-in-from-top-1 duration-150"
                            >
                              {/* Feedback Actions */}
                              {isCompleted &&
                              hasFeedbackReference &&
                              feedbackLink ? (
                                <>
                                  {/* Show Feedback QR */}
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() =>
                                      handleShowFeedbackQR(appt)
                                    }
                                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors"
                                  >
                                    <QrCode className="h-4 w-4 shrink-0" />
                                    Show Feedback QR
                                  </button>

                                  {/* Copy Feedback Link */}
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() =>
                                      handleCopyFeedback(appt, 'link')
                                    }
                                    disabled={isCopying}
                                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-blue-700 hover:bg-blue-50 transition-colors disabled:opacity-60"
                                  >
                                    {isCopying ? (
                                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                                    ) : linkCopied ? (
                                      <Check className="h-4 w-4 shrink-0" />
                                    ) : (
                                      <Link2 className="h-4 w-4 shrink-0" />
                                    )}

                                    {linkCopied
                                      ? 'Link Copied!'
                                      : 'Copy Feedback Link'}
                                  </button>

                                  {/* Copy Reference */}
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() =>
                                      handleCopyFeedback(appt, 'reference')
                                    }
                                    disabled={isCopying}
                                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-60"
                                  >
                                    {referenceCopied ? (
                                      <Check className="h-4 w-4 shrink-0" />
                                    ) : (
                                      <Copy className="h-4 w-4 shrink-0" />
                                    )}

                                    {referenceCopied
                                      ? 'Reference Copied!'
                                      : 'Copy Reference'}
                                  </button>
                                </>
                              ) : (
                                isCompleted && (
                                  <div className="px-3 py-2.5 text-[11px] font-medium text-amber-600">
                                    Feedback reference unavailable
                                  </div>
                                )
                              )}

                              {/* Divider */}
                              {isAdmin && isCompleted && (
                                <div className="my-1 border-t border-slate-100"></div>
                              )}

                              {/* Delete Appointment - ADMIN ONLY */}
                              {isAdmin && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() =>
                                    handleDeleteAppointment(appt)
                                  }
                                  disabled={isDeleting}
                                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-bold text-rose-700 hover:bg-rose-50 transition-colors disabled:opacity-60"
                                >
                                  {isDeleting ? (
                                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4 shrink-0" />
                                  )}

                                  {isDeleting ? 'Deleting...' : 'Delete'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-10 text-slate-400"
                  >
                    {isAdmin
                      ? 'No appointments match your search.'
                      : `No ${staffOffice} appointments match your search.`}
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
                {copyingFeedbackId === qrAppointment.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}

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
