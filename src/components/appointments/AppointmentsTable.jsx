import { useEffect, useMemo, useState } from 'react';
import { Search, Building2 } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../../services/firebase.js';

const ADMIN_EMAIL = 'qsystemssu123@gmail.com';

export default function AppointmentsTable({
  filteredAppointments = [],
  searchTerm,
  setSearchTerm,
  filterOffice,
  setFilterOffice,
  officeCounts
}) {
  const [currentUser, setCurrentUser] = useState(null);
  const [staffOffice, setStaffOffice] = useState(null);
  const [accessLoading, setAccessLoading] = useState(true);

  const isAdmin =
    currentUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  useEffect(() => {
    let unsubscribe;

    const loadUserAccess = async (user) => {
      setCurrentUser(user);
      setStaffOffice(null);

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
                const isCompleted = appt.status === 'completed';
                const isServing = appt.status === 'serving';

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
                            : isServing
                            ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                            : 'bg-sky-50 text-sky-700 border-sky-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isCompleted
                              ? 'bg-emerald-500'
                              : isServing
                              ? 'bg-amber-500'
                              : 'bg-sky-500'
                          }`}
                        ></span>

                        {appt.status
                          ? appt.status.toUpperCase()
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
  );
}