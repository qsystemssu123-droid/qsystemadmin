
import { useState, useEffect } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where
} from 'firebase/firestore';

import {
  Activity,
  Building2,
  Hash,
  Radio,
  UserRound,
  Clock3,
  ListOrdered
} from 'lucide-react';

import { db } from '../services/firebase.js';
import { useDashboardData } from '../hooks/useDashboardData.js';
import { calculateDashboardMetrics } from '../utils/dashboardCalculations.js';
import { REGISTERED_USERS } from '../data/mockData.js';

import DashboardHeader from '../components/dashboard/DashboardHeader.jsx';
import MetricCards from '../components/dashboard/MetricCards.jsx';
import BookingTrendsChart from '../components/dashboard/BookingTrendsChart.jsx';
import OfficeDistribution from '../components/dashboard/OfficeDistribution.jsx';
import ThreeOfficesPieChart from '../components/dashboard/ThreeOfficesPieChart.jsx';
import RegisteredUsersList from '../components/dashboard/RegisteredUsersList.jsx';
import DashboardLoading from '../components/dashboard/DashboardLoading.jsx';

// Normalize appointment status values.
const normalizeStatus = (status) =>
  String(status || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');

// Check whether an appointment is currently being served.
// UPDATED: SWDS staff uses "in-progress".
const isServing = (status) =>
  [
    'serving',
    'nowserving',
    'inservice',
    'inprogress'
  ].includes(normalizeStatus(status));

// Check whether an appointment is waiting in the queue.
// Pending appointments are intentionally excluded because
// staff must accept them before assigning a queue number.
const isWaiting = (status) =>
  [
    'accepted',
    'approved',
    'waiting',
    'queued'
  ].includes(normalizeStatus(status));

// Convert Firestore timestamps into milliseconds.
const getTimestamp = (value) => {
  if (!value) return 0;

  if (typeof value.toMillis === 'function') {
    return value.toMillis();
  }

  if (typeof value.toDate === 'function') {
    return value.toDate().getTime();
  }

  if (typeof value.seconds === 'number') {
    return value.seconds * 1000;
  }

  const parsed = new Date(value).getTime();

  return Number.isFinite(parsed) ? parsed : 0;
};

// Sort queue numbers naturally.
const compareQueueNumbers = (a, b) =>
  String(a.queueNumber || '').localeCompare(
    String(b.queueNumber || ''),
    undefined,
    {
      numeric: true,
      sensitivity: 'base'
    }
  );

// Normalize public queue tickets.
const normalizePublicTicket = (ticket) => {
  if (!ticket || typeof ticket !== 'object') {
    return null;
  }

  return {
    ...ticket,
    id: ticket.appointmentId || ticket.id || '',
    queueNumber: String(
      ticket.queueNumber || ticket.ticketNumber || ''
    ).trim(),
    status: ticket.status || '',
    queuePosition: Number(ticket.queuePosition || 0)
  };
};

// Live SWDS Queue Monitor Component.
function SWDSQueueMonitor() {
  const [queueAppointments, setQueueAppointments] = useState([]);
  const [publicQueue, setPublicQueue] = useState(null);

  const [appointmentsLoading, setAppointmentsLoading] =
    useState(true);

  const [publicQueueLoading, setPublicQueueLoading] =
    useState(true);

  const [appointmentsError, setAppointmentsError] =
    useState('');

  const [publicQueueError, setPublicQueueError] =
    useState('');

  useEffect(() => {
    // Existing appointments listener.
    const appointmentsRef = query(
      collection(db, 'appointments'),
      where('office', '==', 'SWDS')
    );

    const unsubscribeAppointments = onSnapshot(
      appointmentsRef,
      (snapshot) => {
        const appointments = snapshot.docs.map(
          (document) => ({
            ...document.data(),
            id: document.id
          })
        );

        setQueueAppointments(appointments);
        setAppointmentsError('');
        setAppointmentsLoading(false);
      },
      (error) => {
        console.error(
          'SWDS Appointments Monitor Error:',
          error
        );

        setAppointmentsError(
          `Unable to load SWDS appointments: ${
            error?.message || 'Unknown Firestore error'
          }`
        );

        setAppointmentsLoading(false);
      }
    );

    // NEW: Listen directly to the public SWDS queue.
    // This is the same document updated by the staff
    // when accepting, serving, or completing tickets.
    const publicQueueRef = doc(
      db,
      'queues',
      'SWDS'
    );

    const unsubscribePublicQueue = onSnapshot(
      publicQueueRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setPublicQueue(snapshot.data());
        } else {
          setPublicQueue(null);
        }

        setPublicQueueError('');
        setPublicQueueLoading(false);
      },
      (error) => {
        console.error(
          'SWDS Public Queue Monitor Error:',
          error
        );

        setPublicQueueError(
          `Unable to load the public SWDS queue: ${
            error?.message || 'Unknown Firestore error'
          }`
        );

        setPublicQueueLoading(false);
      }
    );

    return () => {
      unsubscribeAppointments();
      unsubscribePublicQueue();
    };
  }, []);

  const queueLoading =
    appointmentsLoading || publicQueueLoading;

  const queueError =
    appointmentsError || publicQueueError;

  // Read the public tickets written by the staff dashboard.
  const publicTickets = Array.isArray(publicQueue?.tickets)
    ? publicQueue.tickets
        .map(normalizePublicTicket)
        .filter(Boolean)
    : [];

  // Match a public ticket to its appointment so that
  // the admin can also see student and service details.
  const findAppointmentForTicket = (ticket) => {
    if (!ticket) return null;

    return (
      queueAppointments.find(
        (appointment) =>
          appointment.id === ticket.appointmentId ||
          appointment.id === ticket.id
      ) ||
      queueAppointments.find(
        (appointment) =>
          String(appointment.queueNumber || '').trim() ===
          ticket.queueNumber
      ) ||
      null
    );
  };

  // Combine ticket information with its appointment.
  const enrichTicket = (ticket) => {
    const appointment = findAppointmentForTicket(ticket);

    return {
      ...(appointment || {}),
      ...ticket,
      userName:
        appointment?.userName ||
        ticket.userName ||
        '',
      service:
        appointment?.service ||
        ticket.service ||
        '',
      reason:
        appointment?.reason ||
        ticket.reason ||
        '',
      queueNumber:
        ticket.queueNumber ||
        appointment?.queueNumber ||
        ''
    };
  };

  // Find appointments whose status is "in-progress".
  const servingAppointments = queueAppointments
    .filter(
      (appointment) =>
        isServing(appointment.status) &&
        String(
          appointment.queueNumber || ''
        ).trim() !== ''
    )
    .sort((a, b) => {
      const aTime = getTimestamp(
        a.servingAt || a.startedAt || a.updatedAt
      );

      const bTime = getTimestamp(
        b.servingAt || b.startedAt || b.updatedAt
      );

      return bTime - aTime;
    });

  // Read the authoritative nowServing value from queues/SWDS.
  const publicNowServing = String(
    publicQueue?.nowServing || ''
  ).trim();

  // Find the corresponding appointment or public ticket.
  const publicServingTicket = publicNowServing
    ? publicTickets.find(
        (ticket) =>
          ticket.queueNumber === publicNowServing
      )
    : null;

  const publicServingAppointment = publicNowServing
    ? queueAppointments.find(
        (appointment) =>
          String(appointment.queueNumber || '').trim() ===
          publicNowServing
      )
    : null;

  // Prefer the public queue when available.
  // Fall back to appointment status for compatibility.
  const currentServing = publicNowServing
    ? {
        ...(publicServingAppointment || {}),
        ...(publicServingTicket || {}),
        userName:
          publicServingAppointment?.userName ||
          publicServingTicket?.userName ||
          '',
        service:
          publicServingAppointment?.service ||
          publicServingTicket?.service ||
          '',
        reason:
          publicServingAppointment?.reason ||
          publicServingTicket?.reason ||
          '',
        queueNumber: publicNowServing
      }
    : servingAppointments[0] || null;

  // Approved appointments with assigned queue numbers.
  const appointmentWaiting = queueAppointments
    .filter(
      (appointment) =>
        isWaiting(appointment.status) &&
        String(
          appointment.queueNumber || ''
        ).trim() !== '' &&
        !isServing(appointment.status)
    )
    .sort(compareQueueNumbers);

  // Public tickets which are waiting to be served.
  const publicWaiting = publicTickets
    .filter(
      (ticket) =>
        isWaiting(ticket.status) &&
        ticket.queueNumber !== '' &&
        ticket.queueNumber !== currentServing?.queueNumber
    )
    .map(enrichTicket);

  // Merge both sources without duplicating queue numbers.
  // The public queue takes priority when it has a ticket.
  const waitingMap = new Map();

  appointmentWaiting.forEach((appointment) => {
    if (
      appointment.queueNumber !==
      currentServing?.queueNumber
    ) {
      waitingMap.set(
        appointment.queueNumber,
        appointment
      );
    }
  });

  publicWaiting.forEach((ticket) => {
    const previous = waitingMap.get(ticket.queueNumber);

    waitingMap.set(ticket.queueNumber, {
      ...(previous || {}),
      ...ticket,
      userName:
        ticket.userName ||
        previous?.userName ||
        '',
      service:
        ticket.service ||
        previous?.service ||
        '',
      reason:
        ticket.reason ||
        previous?.reason ||
        ''
    });
  });

  // Priority appointments are served before normal ones.
  // Queue position determines order within each group.
  const waitingAppointments = Array.from(
    waitingMap.values()
  ).sort((a, b) => {
    const aPriority = a.isPriority === true;
    const bPriority = b.isPriority === true;

    if (aPriority !== bPriority) {
      return aPriority ? -1 : 1;
    }

    const aPosition = Number(a.queuePosition || 0);
    const bPosition = Number(b.queuePosition || 0);

    if (aPosition > 0 && bPosition > 0) {
      return aPosition - bPosition;
    }

    return compareQueueNumbers(a, b);
  });

  const waitingCount = waitingAppointments.length;

  const nextAppointment =
    waitingAppointments[0] || null;

  const servingCount = currentServing ? 1 : 0;

  return (
    <div className="animate-slide-right-3 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8">

      {/* Queue Monitor Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-600" />
            Live Queue Monitor
          </h2>

          <p className="text-sm text-slate-500 mt-1">
            Real-time queue monitoring for the SWDS office.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-xl self-start sm:self-auto">
          <Radio className="w-4 h-4 text-blue-600" />

          <span className="text-xs font-bold text-blue-700">
            {queueError
              ? 'CONNECTION ERROR'
              : queueLoading
                ? 'CONNECTING'
                : 'LIVE MONITORING'}
          </span>

          {!queueError && !queueLoading && (
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
            </span>
          )}
        </div>
      </div>

      {/* Office Information */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 font-bold text-sm">
          <Building2 className="w-4 h-4" />
          SWDS
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Clock3 className="w-4 h-4" />
          Automatically synced with Firestore
        </div>
      </div>

      {queueLoading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>

          <p className="text-sm text-slate-500">
            Loading live queue...
          </p>
        </div>
      ) : (
        <>
          {/* Firestore Error Feedback */}
          {queueError && (
            <div
              role="alert"
              className="mb-5 p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm font-medium text-rose-700"
            >
              {appointmentsError && (
                <p>{appointmentsError}</p>
              )}

              {publicQueueError && (
                <p>{publicQueueError}</p>
              )}
            </div>
          )}

          {/* Now Serving and Next Queue */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">

            {/* Now Serving */}
            <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 p-6 text-center">
              <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
                <Radio className="w-4 h-4 text-blue-600" />
                Now Serving
              </div>

              <div className="text-3xl sm:text-4xl lg:text-5xl font-black text-blue-700 tracking-tight break-all">
                {currentServing?.queueNumber || '---'}
              </div>

              {currentServing ? (
                <>
                  <div className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold text-slate-800">
                    <UserRound className="w-4 h-4 text-slate-500" />

                    <span>
                      {currentServing.userName || 'Student'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 mt-2">
                    {currentServing.service || 'General Inquiry'}
                  </p>

                  {currentServing.reason && (
                    <div className="mt-4 rounded-lg border border-blue-100 bg-white/70 p-3 text-left">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-blue-700 mb-1">
                        Reason for Visit
                      </p>

                      <p className="text-xs text-slate-700 whitespace-pre-wrap break-words">
                        {currentServing.reason}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-500 mt-4">
                  No appointment is currently being served.
                </p>
              )}
            </div>

            {/* Next Queue */}
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-6 text-center">
              <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
                <Hash className="w-4 h-4 text-slate-500" />
                Next in Queue
              </div>

              <div className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-700 tracking-tight break-all">
                {nextAppointment?.queueNumber || '---'}
              </div>

              {nextAppointment ? (
                <>
                  <div className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold text-slate-800">
                    <UserRound className="w-4 h-4 text-slate-500" />

                    <span>
                      {nextAppointment.userName || 'Student'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 mt-2">
                    {nextAppointment.service || 'General Inquiry'}
                  </p>

                  {nextAppointment.reason && (
                    <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 text-left">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600 mb-1">
                        Reason for Visit
                      </p>

                      <p className="text-xs text-slate-700 whitespace-pre-wrap break-words">
                        {nextAppointment.reason}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-500 mt-4">
                  No upcoming accepted appointments.
                </p>
              )}
            </div>
          </div>

          {/* Queue Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <Activity className="w-4 h-4 text-blue-600" />
                Currently Serving
              </div>

              <p className="text-2xl font-bold text-slate-900 mt-2">
                {servingCount}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <ListOrdered className="w-4 h-4 text-amber-600" />
                Waiting in Queue
              </div>

              <p className="text-2xl font-bold text-slate-900 mt-2">
                {waitingCount}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <Building2 className="w-4 h-4 text-emerald-600" />
                Office
              </div>

              <p className="text-2xl font-bold text-slate-900 mt-2">
                SWDS
              </p>
            </div>
          </div>

          {/* Upcoming Queue Details */}
          {waitingAppointments.length > 0 && (
            <div className="mt-6 rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <ListOrdered className="w-4 h-4 text-blue-600" />
                Upcoming Queue
              </h3>

              <div className="space-y-2 max-h-72 overflow-y-auto">
                {waitingAppointments.map((appointment) => (
                  <div
                    key={
                      appointment.id ||
                      appointment.queueNumber
                    }
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1.5 rounded-md shrink-0">
                        {appointment.queueNumber}
                      </span>

                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {appointment.userName || 'Student'}
                        </p>

                        <p className="text-xs text-slate-500 truncate">
                          {appointment.service || 'Appointment'}
                        </p>
                      </div>
                    </div>

                    <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-md self-start sm:self-auto">
                      {appointment.isPriority
                        ? 'Priority - Waiting'
                        : 'Waiting'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [chartTimeframe, setChartTimeframe] = useState('WEEK');

  const {
    appointments,
    loading,
    todayDateStr
  } = useDashboardData();

  const metrics = calculateDashboardMetrics(
    appointments,
    todayDateStr,
    chartTimeframe
  );

  if (loading) {
    return <DashboardLoading />;
  }

  return (
    <>
      <style>{`
        @keyframes slideInRightToLeft {
          0% {
            opacity: 0;
            transform: translateX(80px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .animate-slide-right-1 {
          animation: slideInRightToLeft 3s cubic-bezier(0.16, 1, 0.3, 1) 0.05s both;
        }

        .animate-slide-right-2 {
          animation: slideInRightToLeft 3s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both;
        }

        .animate-slide-right-3 {
          animation: slideInRightToLeft 3s cubic-bezier(0.16, 1, 0.3, 1) 0.25s both;
        }

        .animate-slide-right-4 {
          animation: slideInRightToLeft 3s cubic-bezier(0.16, 1, 0.3, 1) 0.35s both;
        }

        .animate-slide-right-5 {
          animation: slideInRightToLeft 3s cubic-bezier(0.16, 1, 0.3, 1) 0.45s both;
        }
      `}</style>

      <div className="space-y-6 pb-12 transition-all duration-300">

        {/* Existing Dashboard Header */}
        <DashboardHeader />

        {/* Existing Metric Cards */}
        <MetricCards
          bookedTodayCount={metrics.bookedTodayCount}
          registeredUsersCount={REGISTERED_USERS.length}
          completionRate={metrics.completionRate}
          completedCount={metrics.completedCount}
          totalBookings={metrics.totalBookings}
        />

        {/* UPDATED: Real-Time SWDS Queue Monitor */}
        <SWDSQueueMonitor />

        {/* Existing Booking Trends Chart */}
        <BookingTrendsChart
          chartTimeframe={chartTimeframe}
          setChartTimeframe={setChartTimeframe}
          lineChartPoints={metrics.lineChartPoints}
          totalInTimeframe={metrics.totalInTimeframe}
        />

        {/* Existing Analytics Section */}
        <div className="animate-slide-right-3 grid grid-cols-1 lg:grid-cols-3 gap-6">

          <OfficeDistribution
            officeCounts={metrics.officeCounts}
            totalBookings={metrics.totalBookings}
          />

          <ThreeOfficesPieChart
            osasCount={metrics.osasCount}
            clinicCount={metrics.clinicCount}
            swdsCount={metrics.swdsCount}
            osasPercent={metrics.osasPercent}
            clinicPercent={metrics.clinicPercent}
            swdsPercent={metrics.swdsPercent}
            total3OfficesBookings={metrics.total3OfficesBookings}
            osasDash={metrics.osasDash}
            clinicDash={metrics.clinicDash}
            swdsDash={metrics.swdsDash}
            osasOffset={metrics.osasOffset}
            clinicOffset={metrics.clinicOffset}
            swdsOffset={metrics.swdsOffset}
            CIRCUMFERENCE={metrics.CIRCUMFERENCE}
          />

          <RegisteredUsersList
            registeredUsers={REGISTERED_USERS}
          />
        </div>
      </div>
    </>
  );
}
