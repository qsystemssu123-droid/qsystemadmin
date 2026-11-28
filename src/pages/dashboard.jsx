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

import DashboardHeader from '../components/dashboard/DashboardHeader.jsx';
import MetricCards from '../components/dashboard/MetricCards.jsx';
import BookingTrendsChart from '../components/dashboard/BookingTrendsChart.jsx';
import OfficeDistribution from '../components/dashboard/OfficeDistribution.jsx';
import ThreeOfficesPieChart from '../components/dashboard/ThreeOfficesPieChart.jsx';
import RegisteredUsersList from '../components/dashboard/RegisteredUsersList.jsx';
import DashboardLoading from '../components/dashboard/DashboardLoading.jsx';

const PHILIPPINE_TIME_ZONE = 'Asia/Manila';

const SWDS_STAFF = [
  {
    id: 'ZV3oQjx0sEUXxSgoTPasttBR8mj2',
    email: 'staff.ssu.glenn@gmail.com',
    name: 'Sir Glenn',
    label: 'Staff 1'
  },
  {
    id: 'PZ8FXHKb96M3iLr2CqG28QnPmXf1',
    email: 'staff.ssu.chenyl@gmail.com',
    name: 'Chenyl M. Maasin',
    label: 'Staff 2'
  },
  {
    id: 'xjOMBJQiQBc2Skk2d1iAdchxOOi2',
    email: 'staff.ssu.patricia@gmail.com',
    name: 'Patricia Paula G. Gonzales',
    label: 'Staff 3'
  }
];

// Normalize appointment status values.
const normalizeStatus = (status) =>
  String(status || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');

// Normalize queue number strings consistently.
const normalizeQueueNumber = (value) =>
  String(value || '').trim();

// Normalize staff identifiers and names.
const normalizeStaffValue = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();

// Get the current Philippine date and time.
const getManilaDateTime = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PHILIPPINE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date());

  const value = (type) =>
    parts.find((part) => part.type === type)?.value || '';

  const hour = Number(value('hour'));
  const minute = Number(value('minute'));

  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    hour,
    minutes: hour * 60 + minute
  };
};

// Get the Philippine date key from a Date.
const getManilaDateKey = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PHILIPPINE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);

  const value = (type) =>
    parts.find((part) => part.type === type)?.value || '';

  return `${value('year')}-${value('month')}-${value('day')}`;
};

// Get the effective appointment date.
// Rescheduled date takes priority over the original date.
const getScheduledDate = (item) => {
  const value =
    item?.rescheduledToDate ||
    item?.appointmentDate ||
    '';

  if (!value) return '';

  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : value;
  }

  const date =
    typeof value?.toDate === 'function'
      ? value.toDate()
      : value instanceof Date
        ? value
        : null;

  return date ? getManilaDateKey(date) : '';
};

// Get the effective appointment time.
const getScheduledTime = (item) =>
  item?.rescheduledToTime ||
  item?.appointmentTime ||
  '';

// Convert 12-hour or 24-hour time into minutes.
const convertTimeToMinutes = (time) => {
  if (typeof time !== 'string' || !time.trim()) {
    return null;
  }

  const normalized = time.trim().toUpperCase();

  const twelveHourMatch = normalized.match(
    /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/
  );

  if (twelveHourMatch) {
    let hours = Number(twelveHourMatch[1]);
    const minutes = Number(twelveHourMatch[2]);
    const period = twelveHourMatch[3];

    if (
      hours < 1 ||
      hours > 12 ||
      minutes < 0 ||
      minutes > 59
    ) {
      return null;
    }

    if (period === 'AM') {
      if (hours === 12) hours = 0;
    } else if (hours !== 12) {
      hours += 12;
    }

    return hours * 60 + minutes;
  }

  const twentyFourHourMatch = normalized.match(
    /^(\d{1,2}):(\d{2})(?::\d{2})?$/
  );

  if (twentyFourHourMatch) {
    const hours = Number(twentyFourHourMatch[1]);
    const minutes = Number(twentyFourHourMatch[2]);

    if (
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      return null;
    }

    return hours * 60 + minutes;
  }

  return null;
};

// Check whether an appointment has a valid schedule.
const hasValidAppointmentSchedule = (item) => {
  const date = getScheduledDate(item);
  const time = getScheduledTime(item);

  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    convertTimeToMinutes(time) !== null
  );
};

// Check whether an appointment is scheduled for a later time.
const isAheadOfTimeAppointment = (item, currentDateTime) => {
  if (!hasValidAppointmentSchedule(item)) {
    return false;
  }

  const scheduledDate = getScheduledDate(item);

  const scheduledMinutes = convertTimeToMinutes(
    getScheduledTime(item)
  );

  if (scheduledDate > currentDateTime.date) {
    return true;
  }

  if (scheduledDate < currentDateTime.date) {
    return false;
  }

  return scheduledMinutes > currentDateTime.minutes;
};

// Check whether an appointment is currently being served.
const isServing = (status) =>
  [
    'serving',
    'nowserving',
    'inservice',
    'inprogress'
  ].includes(normalizeStatus(status));

// Check whether an appointment is approved and waiting.
const isWaiting = (status) =>
  [
    'accepted',
    'approved',
    'approvedwaiting',
    'waiting',
    'queued'
  ].includes(normalizeStatus(status));

// Check whether a status represents a completed or inactive ticket.
const isInactiveTicket = (status) =>
  [
    'completed',
    'complete',
    'done',
    'cancelled',
    'canceled',
    'rejected',
    'declined',
    'noshow',
    'served'
  ].includes(normalizeStatus(status));

// Get queue date using the same fields written by useSWDS.
const getAppointmentQueueDate = (item) => {
  if (
    typeof item?.queueDate === 'string' &&
    item.queueDate
  ) {
    return item.queueDate;
  }

  const possibleTimestamps = [
    item?.approvedAt,
    item?.createdAt,
    item?.queueCreatedAt
  ];

  for (const value of possibleTimestamps) {
    const date =
      typeof value?.toDate === 'function'
        ? value.toDate()
        : typeof value?.seconds === 'number'
          ? new Date(value.seconds * 1000)
          : value instanceof Date
            ? value
            : value
              ? new Date(value)
              : null;

    if (date && !Number.isNaN(date.getTime())) {
      return getManilaDateKey(date);
    }
  }

  return '';
};

// Check whether an appointment belongs to the current queue date.
// Queue hour is retained as metadata; the public queue is date-based.
const isTicketForCurrentHour = (
  item,
  currentDateTime
) =>
  getAppointmentQueueDate(item) === currentDateTime.date;

// Check whether an appointment belongs to SWDS.
const belongsToSWDS = (item) => {
  const office = String(
    item?.office ||
      item?.officeName ||
      item?.department ||
      ''
  )
    .trim()
    .toLowerCase();

  return (
    office === 'swds' ||
    office.startsWith('swds -') ||
    office.startsWith('swds ') ||
    office.includes('swds')
  );
};

// Sort queue numbers naturally.
const compareQueueNumbers = (a, b) =>
  normalizeQueueNumber(a?.queueNumber).localeCompare(
    normalizeQueueNumber(b?.queueNumber),
    undefined,
    {
      numeric: true,
      sensitivity: 'base'
    }
  );

// Normalize public queue tickets.
// The public ticket's status is authoritative.
const normalizePublicTicket = (ticket) => {
  if (!ticket || typeof ticket !== 'object') {
    return null;
  }

  const normalizedQueueNumber = normalizeQueueNumber(
    ticket.queueNumber ||
      ticket.ticketNumber ||
      ''
  );

  const nestedServiceStatus =
    Array.isArray(ticket.services)
      ? ticket.services.find(
          (service) =>
            service?.status &&
            (
              isServing(service.status) ||
              isWaiting(service.status) ||
              isInactiveTicket(service.status)
            )
        )?.status
      : '';

  return {
    ...ticket,
    id:
      ticket.appointmentId ||
      ticket.id ||
      normalizedQueueNumber ||
      '',
    appointmentId:
      ticket.appointmentId ||
      ticket.id ||
      '',
    queueNumber: normalizedQueueNumber,
    status:
      ticket.status ||
      nestedServiceStatus ||
      'waiting',
    queuePosition: Number(ticket.queuePosition || 0)
  };
};

// Get the parent appointment ID from a service task.
const getServiceTaskAppointmentId = (task) =>
  task?.appointmentId ||
  task?.parentAppointmentId ||
  task?.parentId ||
  '';

// Find the service task belonging to a public queue ticket.
const findServiceTaskForTicket = (
  ticket,
  serviceTasks,
  appointment
) => {
  if (!ticket) return null;

  const taskId =
    ticket.serviceTaskId ||
    ticket.taskId ||
    ticket.appointmentServiceId ||
    '';

  if (taskId) {
    const exactTask = serviceTasks.find(
      (task) => task.id === taskId
    );

    if (exactTask) return exactTask;
  }

  const ticketQueueNumber = normalizeQueueNumber(
    ticket.queueNumber
  );

  if (ticketQueueNumber) {
    const queueTask = serviceTasks.find(
      (task) =>
        normalizeQueueNumber(task.queueNumber) ===
          ticketQueueNumber ||
        normalizeQueueNumber(task.ticketNumber) ===
          ticketQueueNumber
    );

    if (queueTask) return queueTask;
  }

  const appointmentId =
    ticket.appointmentId ||
    ticket.id ||
    appointment?.id ||
    '';

  if (!appointmentId) return null;

  const appointmentTasks = serviceTasks.filter(
    (task) =>
      getServiceTaskAppointmentId(task) === appointmentId
  );

  // Only use appointment-level matching when the appointment
  // has exactly one service task. Never guess between multiple tasks.
  if (appointmentTasks.length === 1) {
    return appointmentTasks[0];
  }

  return null;
};

// Check whether a ticket belongs to the selected staff member.
const belongsToStaff = (ticket, staff) => {
  if (!ticket || !staff) return false;

  const assignedStaffId = normalizeStaffValue(
    ticket.assignedStaffId ||
      ticket.staffId ||
      ''
  );

  const assignedStaffEmail = normalizeStaffValue(
    ticket.assignedStaffEmail ||
      ticket.staffEmail ||
      ''
  );

  const assignedStaffName = normalizeStaffValue(
    ticket.assignedStaffName ||
      ticket.staffName ||
      ''
  );

  return (
    assignedStaffId === normalizeStaffValue(staff.id) ||
    assignedStaffEmail === normalizeStaffValue(staff.email) ||
    (
      assignedStaffName !== '' &&
      (
        assignedStaffName === normalizeStaffValue(staff.name) ||
        assignedStaffName === normalizeStaffValue('Glenn') &&
          staff.id === SWDS_STAFF[0].id
      )
    )
  );
};

// Live SWDS Queue Monitor Component.
function SWDSQueueMonitor() {
  const [queueAppointments, setQueueAppointments] = useState([]);
  const [serviceTasks, setServiceTasks] = useState([]);
  const [publicQueue, setPublicQueue] = useState(null);

  const [selectedStaffId, setSelectedStaffId] = useState(
    SWDS_STAFF[0].id
  );

  const [appointmentsLoading, setAppointmentsLoading] =
    useState(true);

  const [serviceTasksLoading, setServiceTasksLoading] =
    useState(true);

  const [publicQueueLoading, setPublicQueueLoading] =
    useState(true);

  const [appointmentsError, setAppointmentsError] =
    useState('');

  const [serviceTasksError, setServiceTasksError] =
    useState('');

  const [publicQueueError, setPublicQueueError] =
    useState('');

  const [currentDateTime, setCurrentDateTime] = useState(
    () => getManilaDateTime()
  );

  const selectedStaff =
    SWDS_STAFF.find(
      (staff) => staff.id === selectedStaffId
    ) || SWDS_STAFF[0];

  // Keep the monitor synchronized with Philippine time.
  // This only refreshes the display; it does not approve appointments.
  useEffect(() => {
    const updateTime = () => {
      setCurrentDateTime(getManilaDateTime());
    };

    updateTime();

    const interval = setInterval(updateTime, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Listen to SWDS appointments.
    // This listener is strictly read-only.
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
            id: document.id,
            queueNumber: normalizeQueueNumber(
              document.data()?.queueNumber ||
                document.data()?.ticketNumber ||
                ''
            )
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

    // Listen to SWDS appointment service tasks.
    // These contain the individual staff assignments.
    const serviceTasksRef = collection(
      db,
      'appointment_services'
    );

    const unsubscribeServiceTasks = onSnapshot(
      serviceTasksRef,
      (snapshot) => {
        const tasks = snapshot.docs.map(
          (document) => ({
            ...document.data(),
            id: document.id
          })
        );

        setServiceTasks(tasks);
        setServiceTasksError('');
        setServiceTasksLoading(false);
      },
      (error) => {
        console.error(
          'SWDS Service Tasks Monitor Error:',
          error
        );

        setServiceTasksError(
          `Unable to load staff service assignments: ${
            error?.message || 'Unknown Firestore error'
          }`
        );

        setServiceTasksLoading(false);
      }
    );

    // Listen to the authoritative public SWDS queue.
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
      unsubscribeServiceTasks();
      unsubscribePublicQueue();
    };
  }, []);

  const queueLoading =
    appointmentsLoading ||
    serviceTasksLoading ||
    publicQueueLoading;

  const queueError =
    appointmentsError ||
    serviceTasksError ||
    publicQueueError;

  // The public queue is valid for the current Philippine date.
  // queueHour is metadata and must not hide already allocated tickets.
  const hasPublicTicketsArray = Array.isArray(
    publicQueue?.tickets
  );

  const publicQueueIsCurrentHour =
    publicQueue?.queueDate === currentDateTime.date;

  // Only read tickets from today's public SWDS queue.
  const allPublicTickets =
    hasPublicTicketsArray && publicQueueIsCurrentHour
      ? publicQueue.tickets
          .map(normalizePublicTicket)
          .filter(
            (ticket) =>
              ticket &&
              normalizeQueueNumber(ticket.queueNumber) !== ''
          )
      : [];

  // Match a public ticket to its appointment.
  const findAppointmentForTicket = (ticket) => {
    if (!ticket) return null;

    const ticketQueueNum = normalizeQueueNumber(
      ticket.queueNumber
    );

    return (
      queueAppointments.find(
        (appointment) =>
          (ticket.appointmentId &&
            appointment.id === ticket.appointmentId) ||
          (ticket.id &&
            appointment.id === ticket.id)
      ) ||
      queueAppointments.find(
        (appointment) =>
          ticketQueueNum !== '' &&
          normalizeQueueNumber(appointment.queueNumber) ===
            ticketQueueNum
      ) ||
      null
    );
  };

  // Combine ticket, service task, and appointment information.
  // Public ticket fields override stale appointment fields.
  const enrichTicket = (ticket) => {
    const appointment = findAppointmentForTicket(ticket);

    const serviceTask = findServiceTaskForTicket(
      ticket,
      serviceTasks,
      appointment
    );

    return {
      ...(appointment || {}),
      ...(serviceTask || {}),
      ...ticket,

      userName:
        ticket.userName ||
        ticket.studentName ||
        serviceTask?.userName ||
        serviceTask?.studentName ||
        appointment?.userName ||
        appointment?.studentName ||
        '',

      service:
        ticket.service ||
        ticket.serviceName ||
        serviceTask?.service ||
        serviceTask?.serviceName ||
        appointment?.service ||
        appointment?.serviceName ||
        '',

      reason:
        ticket.reason ||
        ticket.visitReason ||
        serviceTask?.reason ||
        serviceTask?.visitReason ||
        appointment?.reason ||
        appointment?.visitReason ||
        '',

      assignedStaffId:
        ticket.assignedStaffId ||
        ticket.staffId ||
        serviceTask?.assignedStaffId ||
        serviceTask?.staffId ||
        appointment?.assignedStaffId ||
        appointment?.staffId ||
        '',

      assignedStaffName:
        ticket.assignedStaffName ||
        ticket.staffName ||
        serviceTask?.assignedStaffName ||
        serviceTask?.staffName ||
        appointment?.assignedStaffName ||
        appointment?.staffName ||
        '',

      assignedStaffEmail:
        ticket.assignedStaffEmail ||
        ticket.staffEmail ||
        serviceTask?.assignedStaffEmail ||
        serviceTask?.staffEmail ||
        appointment?.assignedStaffEmail ||
        appointment?.staffEmail ||
        '',

      serviceTaskId:
        ticket.serviceTaskId ||
        ticket.taskId ||
        serviceTask?.id ||
        '',

      serviceId:
        ticket.serviceId ||
        serviceTask?.serviceId ||
        appointment?.serviceId ||
        '',

      queueNumber: normalizeQueueNumber(
        ticket.queueNumber
      ),

      isPriority:
        typeof ticket.isPriority === 'boolean'
          ? ticket.isPriority
          : typeof serviceTask?.isPriority === 'boolean'
            ? serviceTask.isPriority
            : Boolean(appointment?.isPriority)
    };
  };

  // Appointment records are retained for matching ticket details.
  // They cannot independently create queue entries.
  const eligibleCurrentHourAppointments =
    queueAppointments.filter((appointment) => {
      return (
        belongsToSWDS(appointment) &&
        isTicketForCurrentHour(
          appointment,
          currentDateTime
        ) &&
        !isAheadOfTimeAppointment(
          appointment,
          currentDateTime
        )
      );
    });

  // Enrich all public tickets with their individual service assignments.
  const enrichedPublicTickets = allPublicTickets.map(
    enrichTicket
  );

  // Only show tickets assigned to the selected staff member.
  const publicTickets = enrichedPublicTickets.filter(
    (ticket) =>
      belongsToStaff(ticket, selectedStaff)
  );

  // Read the authoritative nowServing value from queues/SWDS.
  const publicNowServing =
    publicQueueIsCurrentHour
      ? normalizeQueueNumber(
          publicQueue?.nowServing || ''
        )
      : '';

  // Find the corresponding public ticket for this staff member.
  const publicServingTicket = publicNowServing
    ? publicTickets.find(
        (ticket) =>
          normalizeQueueNumber(ticket.queueNumber) ===
            publicNowServing &&
          !isInactiveTicket(ticket.status)
      )
    : null;

  // Find the corresponding appointment for additional details.
  // Appointment records only enrich the public ticket.
  const publicServingAppointment = publicServingTicket
    ? eligibleCurrentHourAppointments.find(
        (appointment) =>
          normalizeQueueNumber(appointment.queueNumber) ===
            publicNowServing
      ) ||
      findAppointmentForTicket(publicServingTicket)
    : null;

  // queues/SWDS.nowServing remains the office-wide authority.
  // A staff tab only displays it when the serving ticket belongs
  // to the currently selected staff member.
  const currentServing = publicServingTicket
    ? {
        ...(publicServingAppointment || {}),
        ...publicServingTicket,

        userName:
          publicServingTicket.userName ||
          publicServingTicket.studentName ||
          publicServingAppointment?.userName ||
          publicServingAppointment?.studentName ||
          '',

        service:
          publicServingTicket.service ||
          publicServingTicket.serviceName ||
          publicServingAppointment?.service ||
          publicServingAppointment?.serviceName ||
          '',

        reason:
          publicServingTicket.reason ||
          publicServingTicket.visitReason ||
          publicServingAppointment?.reason ||
          publicServingAppointment?.visitReason ||
          '',

        isPriority:
          typeof publicServingTicket.isPriority === 'boolean'
            ? publicServingTicket.isPriority
            : Boolean(publicServingAppointment?.isPriority),

        queueNumber: publicNowServing
      }
    : null;

  const currentServingQueueNumber = normalizeQueueNumber(
    currentServing?.queueNumber || ''
  );

  // Only public tickets assigned to this staff member can become
  // waiting queue entries.
  const publicWaiting = publicTickets
    .filter((ticket) => {
      const ticketQueueNum = normalizeQueueNumber(
        ticket.queueNumber
      );

      return (
        ticketQueueNum !== '' &&
        ticketQueueNum !== currentServingQueueNumber &&
        isWaiting(ticket.status) &&
        !isServing(ticket.status) &&
        !isInactiveTicket(ticket.status)
      );
    });

  // The public queue is the source of truth for allocated tickets.
  // Never create a queue entry from an appointment alone.
  const waitingMap = new Map();

  publicWaiting.forEach((ticket) => {
    const queueNumber = normalizeQueueNumber(
      ticket.queueNumber
    );

    if (!queueNumber) return;

    const previous = waitingMap.get(queueNumber);

    waitingMap.set(queueNumber, {
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

  // Priority appointments are displayed before normal appointments.
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

    if (aPosition > 0) return -1;
    if (bPosition > 0) return 1;

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

      {/* Staff Navigation */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
        {SWDS_STAFF.map((staff, index) => {
          const isActive = selectedStaffId === staff.id;

          const staffTicketCount = enrichedPublicTickets.filter(
            (ticket) => belongsToStaff(ticket, staff)
          ).length;

          return (
            <button
              key={staff.id}
              type="button"
              onClick={() => setSelectedStaffId(staff.id)}
              aria-pressed={isActive}
              className={`relative min-w-0 rounded-xl border px-2 py-3 sm:px-4 sm:py-4 text-center transition-all duration-200 ${
                isActive
                  ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700'
              }`}
            >
              <span
                className={`block text-[10px] sm:text-xs font-bold uppercase tracking-wider ${
                  isActive ? 'text-blue-100' : 'text-slate-400'
                }`}
              >
                Staff {index + 1}
              </span>

              <span className="block mt-1 text-xs sm:text-sm font-bold truncate">
                {staff.name}
              </span>

              <span
                className={`inline-flex items-center justify-center mt-2 min-w-6 h-5 px-2 rounded-full text-[10px] font-bold ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {staffTicketCount}
              </span>

              {isActive && (
                <span className="absolute -bottom-px left-1/2 -translate-x-1/2 w-8 h-1 rounded-t-full bg-white"></span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Staff Information */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6 p-4 rounded-xl border border-blue-100 bg-blue-50/70">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
            Selected Staff
          </p>

          <p className="text-sm font-bold text-slate-800 mt-1">
            {selectedStaff.name}
          </p>

          <p className="text-xs text-slate-500 mt-1 break-all">
            {selectedStaff.email}
          </p>
        </div>

        <div className="self-start sm:self-auto px-3 py-1.5 rounded-lg bg-white border border-blue-100 text-xs font-bold text-blue-700">
          {selectedStaff.label}
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

              {serviceTasksError && (
                <p>{serviceTasksError}</p>
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
                  No appointment is currently being served by this staff member.
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
                  No upcoming accepted appointments for this staff member.
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
                Upcoming Queue - {selectedStaff.label}
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

          {waitingAppointments.length === 0 && !currentServing && (
            <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
              <ListOrdered className="w-7 h-7 text-slate-300 mx-auto mb-2" />

              <p className="text-sm font-semibold text-slate-600">
                No queue activity for {selectedStaff.label}.
              </p>

              <p className="text-xs text-slate-400 mt-1">
                New tickets assigned to this staff member will appear here.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [chartTimeframe, setChartTimeframe] = useState('WEEK');

  // Actual registered users count from Firestore.
  const [registeredUsersCount, setRegisteredUsersCount] = useState(0);

  const [registeredUsersLoading, setRegisteredUsersLoading] =
    useState(true);

  const [registeredUsersError, setRegisteredUsersError] =
    useState('');

  const {
    appointments,
    loading,
    todayDateStr
  } = useDashboardData();

  // Listen to ALL documents in the Firestore users collection.
  // Automatically updates whenever users are added or removed.
  useEffect(() => {
    const usersRef = collection(db, 'users');

    const unsubscribeUsers = onSnapshot(
      usersRef,
      (snapshot) => {
        setRegisteredUsersCount(snapshot.size);
        setRegisteredUsersError('');
        setRegisteredUsersLoading(false);
      },
      (error) => {
        console.error(
          'Registered Users Count Error:',
          error
        );

        setRegisteredUsersError(
          error?.message || 'Unable to load registered users.'
        );

        setRegisteredUsersLoading(false);
      }
    );

    return () => {
      unsubscribeUsers();
    };
  }, []);

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

        {/* Updated Metric Cards - Actual Firestore Users Count */}
        <MetricCards
          bookedTodayCount={metrics.bookedTodayCount}
          registeredUsersCount={
            registeredUsersLoading
              ? 0
              : registeredUsersCount
          }
          completionRate={metrics.completionRate}
          completedCount={metrics.completedCount}
          totalBookings={metrics.totalBookings}
        />

        {/* Registered Users Count Error */}
        {registeredUsersError && (
          <div
            role="alert"
            className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-700"
          >
            Unable to load registered users count: {registeredUsersError}
          </div>
        )}

        {/* Read-Only Real-Time SWDS Queue Monitor */}
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

          {/* Updated: Fetches actual users directly from Firestore */}
          <RegisteredUsersList />
        </div>
      </div>
    </>
  );
}