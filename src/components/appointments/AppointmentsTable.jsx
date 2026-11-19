
import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
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
  setSearchTerm
}) {
  const [currentUser, setCurrentUser] = useState(null);
  const [staffOffice, setStaffOffice] = useState(null);
  const [accessLoading, setAccessLoading] = useState(true);

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

              <th className="px-6 py-3.5">
                Office
              </th>

              <th className="px-6 py-3.5">
                Requested Service
              </th>

              <th className="px-6 py-3.5">
                Date & Time
              </th>

              <th className="px-6 py-3.5">
                Status
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

                    {/* Office */}
                    <td className="px-6 py-4 font-medium text-slate-700">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-800">
                        {appt.office}
                      </span>
                    </td>

                    {/* Requested Service */}
                    <td className="px-6 py-4 font-medium text-slate-800">
                      {appt.service}
                    </td>

                    {/* Appointment Date and Time */}
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-700">
                        {appt.appointmentDate}
                      </p>

                      <p className="text-[11px] text-slate-400">
                        {appt.appointmentTime}
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
  );
}
