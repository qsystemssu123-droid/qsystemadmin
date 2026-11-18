
import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Building2,
  Trash2,
  AlertTriangle,
  X,
  Loader2,
  CheckCircle2
} from 'lucide-react';
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
  searchTerm,
  setSearchTerm,
  filterOffice,
  setFilterOffice,
  officeCounts,
  totalAppointments = 0,
  clearingAppointments = false,
  clearAllAppointments
}) {
  const [currentUser, setCurrentUser] = useState(null);
  const [staffOffice, setStaffOffice] = useState(null);
  const [accessLoading, setAccessLoading] = useState(true);

  // Clear All Appointments confirmation states
  const [showClearModal, setShowClearModal] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [deleteMessage, setDeleteMessage] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const isAdmin =
    currentUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  useEffect(() => {
    let unsubscribe;

    const loadUserAccess = async (user) => {
      setCurrentUser(user);
      setStaffOffice(null);
      setAccessLoading(true);

      if (!user) {
        setAccessLoading(false);
        return;
      }

      if (user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        setAccessLoading(false);
        return;
      }

      try {
        const staffQuery = query(
          collection(db, 'staff'),
          where('email', '==', user.email)
        );

        const staffSnapshot = await getDocs(staffQuery);

        if (!staffSnapshot.empty) {
          const staffData = staffSnapshot.docs[0].data();

          const assignedOffice = String(
            staffData.office || ''
          ).trim().toUpperCase();

          if (assignedOffice) {
            setStaffOffice(assignedOffice);
          }
        }
      } catch (error) {
        console.error('Failed to load staff access:', error);
      } finally {
        setAccessLoading(false);
      }
    };

    unsubscribe = onAuthStateChanged(auth, loadUserAccess);

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const accessibleAppointments = useMemo(() => {
    if (!currentUser) {
      return [];
    }

    if (isAdmin) {
      return filteredAppointments;
    }

    if (!staffOffice) {
      return [];
    }

    return filteredAppointments.filter(
      (appointment) =>
        String(appointment.office || '').trim().toUpperCase() ===
        staffOffice
    );
  }, [
    currentUser,
    isAdmin,
    staffOffice,
    filteredAppointments
  ]);

  const officesList = useMemo(() => {
    if (isAdmin) {
      return ['ALL', ...Object.keys(officeCounts || {})];
    }

    if (staffOffice) {
      return [staffOffice];
    }

    return [];
  }, [isAdmin, staffOffice, officeCounts]);

  useEffect(() => {
    if (!isAdmin && staffOffice && filterOffice !== staffOffice) {
      setFilterOffice(staffOffice);
    }

    if (isAdmin && !filterOffice) {
      setFilterOffice('ALL');
    }
  }, [
    isAdmin,
    staffOffice,
    filterOffice,
    setFilterOffice
  ]);

  const displayedAppointments = useMemo(() => {
    const normalizedSearch = String(searchTerm || '')
      .trim()
      .toLowerCase();

    const selectedOffice = String(filterOffice || 'ALL')
      .trim()
      .toUpperCase();

    return accessibleAppointments.filter((appointment) => {
      const appointmentOffice = String(
        appointment.office || ''
      )
        .trim()
        .toUpperCase();

      const matchesOffice =
        isAdmin && selectedOffice === 'ALL'
          ? true
          : appointmentOffice ===
            (isAdmin ? selectedOffice : staffOffice);

      if (!matchesOffice) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchableText = [
        appointment.userName,
        appointment.userEmail,
        appointment.service,
        appointment.reason,
        appointment.queueNumber,
        appointment.office,
        appointment.status
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });
  }, [
    accessibleAppointments,
    searchTerm,
    filterOffice,
    isAdmin,
    staffOffice
  ]);

  // Open the deletion confirmation dialog
  const handleOpenClearModal = () => {
    if (!isAdmin || clearingAppointments) {
      return;
    }

    setConfirmationText('');
    setDeleteError('');
    setDeleteMessage('');
    setShowClearModal(true);
  };

  // Close the confirmation dialog
  const handleCloseClearModal = () => {
    if (clearingAppointments) {
      return;
    }

    setShowClearModal(false);
    setConfirmationText('');
    setDeleteError('');
  };

  // Permanently delete every appointment in Firestore
  const handleConfirmClearAll = async () => {
    if (!isAdmin) {
      setDeleteError(
        'Access denied. Only the administrator can delete appointments.'
      );
      return;
    }

    if (confirmationText.trim() !== 'DELETE ALL') {
      setDeleteError(
        'Please type DELETE ALL to confirm this action.'
      );
      return;
    }

    if (typeof clearAllAppointments !== 'function') {
      setDeleteError(
        'The delete function is not available.'
      );
      return;
    }

    setDeleteError('');
    setDeleteMessage('');

    try {
      const result = await clearAllAppointments();

      setShowClearModal(false);
      setConfirmationText('');

      setDeleteMessage(
        result?.message ||
          'All appointments have been deleted successfully.'
      );
    } catch (error) {
      console.error('Failed to clear appointments:', error);

      setDeleteError(
        error?.message ||
          'Failed to delete appointments. Please try again.'
      );
    }
  };

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

  if (!currentUser) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="text-center py-16 text-slate-400">
          You must be logged in to view appointments.
        </div>
      </div>
    );
  }

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
        <div className="p-6 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">
                Live Appointment Queue
              </h2>

              <p className="text-xs text-slate-500 mt-1">
                {isAdmin
                  ? 'Filter and manage student queues across all offices in real-time.'
                  : `Showing appointments for ${staffOffice} only.`}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

                <input
                  type="text"
                  placeholder="Search user or service..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all"
                />
              </div>

              <div className="relative w-full sm:w-auto flex items-center gap-1.5 bg-slate-50 px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-700">
                <Building2 className="w-4 h-4 text-slate-400" />

                {isAdmin ? (
                  <select
                    value={filterOffice}
                    onChange={(e) => setFilterOffice(e.target.value)}
                    className="bg-transparent focus:outline-none cursor-pointer pr-2"
                  >
                    {officesList.map((off) => (
                      <option key={off} value={off}>
                        {off === 'ALL' ? 'All Offices' : off}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="pr-2">{staffOffice}</span>
                )}
              </div>
            </div>
          </div>

          {/* ADMIN ONLY: Clear All Appointments */}
          {isAdmin && (
            <div className="mt-5 pt-4 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-slate-700">
                    Appointment Management
                  </p>

                  <p className="text-[11px] text-slate-400 mt-1">
                    Total appointments in database: {totalAppointments}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleOpenClearModal}
                  disabled={clearingAppointments}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {clearingAppointments ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Clearing Appointments...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Clear All Appointments
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Success Message */}
          {isAdmin && deleteMessage && (
            <div
              role="status"
              className="mt-4 flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-xs font-semibold"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{deleteMessage}</span>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100">
              <tr>
                <th className="px-6 py-3.5">Queue #</th>
                <th className="px-6 py-3.5">Student / User</th>
                <th className="px-6 py-3.5">Office</th>
                <th className="px-6 py-3.5">Requested Service</th>
                <th className="px-6 py-3.5">Date & Time</th>
                <th className="px-6 py-3.5">Status</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {displayedAppointments.length > 0 ? (
                displayedAppointments.map((appt) => {
                  const statusLower = String(
                    appt.status || ''
                  ).trim().toLowerCase();

                  const isCompleted = statusLower === 'completed';
                  const isApproved = statusLower === 'approved';
                  const isRejected = statusLower === 'rejected';
                  const isServing =
                    statusLower === 'serving' ||
                    statusLower === 'in-progress';

                  return (
                    <tr
                      key={appt.id}
                      className="hover:bg-sky-50/40 transition-colors"
                    >
                      <td className="px-6 py-4 font-bold text-sky-700">
                        {appt.queueNumber || '#---'}
                      </td>

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

                      <td className="px-6 py-4 font-medium text-slate-700">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-800">
                          {appt.office}
                        </span>
                      </td>

                      <td className="px-6 py-4 font-medium text-slate-800">
                        {appt.service}
                      </td>

                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-700">
                          {appt.appointmentDate}
                        </p>

                        <p className="text-[11px] text-slate-400">
                          {appt.appointmentTime}
                        </p>
                      </td>

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
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan="6"
                    className="text-center py-10 text-slate-400"
                  >
                    {isAdmin
                      ? 'No appointments match the selected search criteria or filter.'
                      : `No ${staffOffice} appointments match the selected search criteria.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADMIN ONLY: Confirmation Modal */}
      {isAdmin && showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-appointments-title"
            className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-rose-600" />
                </div>

                <button
                  type="button"
                  onClick={handleCloseClearModal}
                  disabled={clearingAppointments}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                  aria-label="Close confirmation"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <h3
                id="clear-appointments-title"
                className="text-xl font-extrabold text-slate-900 mt-5"
              >
                Clear All Appointments?
              </h3>

              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                You are about to permanently delete every document
                in the Firestore appointments collection.
              </p>

              <div className="mt-4 bg-rose-50 border border-rose-200 rounded-xl p-4">
                <p className="text-xs font-bold text-rose-700">
                  Warning: This action cannot be undone.
                </p>

                <p className="text-xs text-rose-600 mt-1.5">
                  All pending, approved, serving, rejected,
                  and completed appointments will be deleted,
                  regardless of office.
                </p>

                <p className="text-xs font-bold text-rose-700 mt-3">
                  Currently loaded appointments: {totalAppointments}
                </p>
              </div>

              <div className="mt-5">
                <label
                  htmlFor="delete-all-confirmation"
                  className="block text-xs font-bold text-slate-700 mb-2"
                >
                  Type DELETE ALL to confirm:
                </label>

                <input
                  id="delete-all-confirmation"
                  type="text"
                  value={confirmationText}
                  onChange={(e) => {
                    setConfirmationText(e.target.value);
                    setDeleteError('');
                  }}
                  placeholder="DELETE ALL"
                  disabled={clearingAppointments}
                  autoComplete="off"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all disabled:opacity-50"
                />
              </div>

              {deleteError && (
                <div
                  role="alert"
                  className="mt-4 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-xs font-semibold text-rose-700"
                >
                  {deleteError}
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row gap-3 mt-6">
                <button
                  type="button"
                  onClick={handleCloseClearModal}
                  disabled={clearingAppointments}
                  className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleConfirmClearAll}
                  disabled={
                    clearingAppointments ||
                    confirmationText.trim() !== 'DELETE ALL'
                  }
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {clearingAppointments ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete All
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
