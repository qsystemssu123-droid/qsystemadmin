
import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Users,
  ClipboardList,
  CalendarDays,
  Trophy,
  Search,
  Filter,
  BriefcaseBusiness,
  RefreshCw,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Clock,
  Activity,
  Globe,
  Footprints,
} from 'lucide-react';
import {
  collection,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../services/firebase';

const OFFICE_NAME = 'SWDS';

const SWDS_SERVICES = [
  'Guidance & Counseling Services',
  'Services for Students with Special Needs & PWDs',
  'Psychological & Wellness Services',
  'Information & Orientation Services',
  'Economic Enterprise Development',
  'Career & Placement Services / PESO',
  'Admission & Recruitment Services',
  'University Student Council',
  'Student Organizations',
  'Multi-Faith Services'
];

// Normalize service names for accurate counting.
const normalizeService = (service) => {
  return String(service || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/\band\b/g, '&')
    .replace(/\s*&\s*/g, ' & ');
};

// Match variations of service names to the official directory names.
const getCanonicalServiceName = (service) => {
  const normalized = normalizeService(service);

  const matchingService = SWDS_SERVICES.find(
    (serviceName) => normalizeService(serviceName) === normalized
  );

  return matchingService || String(service || '').trim();
};

// Extract individual requested services from an appointment.
// Supports arrays, comma-separated values, and pipe-separated values.
const getRequestedServices = (appointment) => {
  const serviceValue = appointment?.service;

  if (Array.isArray(serviceValue)) {
    return serviceValue
      .flatMap((value) =>
        String(value || '').split(/\s*[|,]\s*/)
      )
      .map((value) => getCanonicalServiceName(value))
      .filter(Boolean);
  }

  if (typeof serviceValue === 'string') {
    return serviceValue
      .split(/\s*[|,]\s*/)
      .map((value) => getCanonicalServiceName(value))
      .filter(Boolean);
  }

  return [];
};

// Identify whether an appointment is Online or Walk-In.
const getBookingChannel = (appointment) => {
  if (!appointment || typeof appointment !== 'object') {
    return 'online';
  }

  const normalize = (value) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, '-');

  const bookingType = normalize(
    appointment.bookingType ||
    appointment.bookingMode ||
    appointment.source ||
    appointment.channel ||
    appointment.type ||
    appointment.appointmentType ||
    appointment.registrationType
  );

  const isWalkIn =
    appointment.isWalkIn === true ||
    bookingType.includes('walk-in') ||
    bookingType.includes('walkin') ||
    Boolean(
      appointment.registeredBy ||
      appointment.registeredByEmail
    );

  return isWalkIn ? 'walk-in' : 'online';
};

// Convert Firestore Timestamp, Date, number, or string to milliseconds.
const parseDateValue = (value) => {
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

  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : 0;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = new Date(value).getTime();

  return Number.isFinite(parsed) ? parsed : 0;
};

// Get the appointment date.
// Prioritizes the actual appointment date over record creation date.
const getAppointmentDate = (appointment) => {
  if (!appointment || typeof appointment !== 'object') {
    return 0;
  }

  const appointmentDate = appointment.appointmentDate;
  const queueDate = appointment.queueDate;

  const parseAppointmentDate = (value) => {
    if (!value) return 0;

    const directTimestamp = parseDateValue(value);

    if (directTimestamp > 0) {
      return directTimestamp;
    }

    const rawDate = String(value).trim();

    if (!rawDate) return 0;

    const rawTime = String(
      appointment.appointmentTime || ''
    ).trim();

    const combinedDate = rawTime
      ? `${rawDate} ${rawTime}`
      : rawDate;

    const combinedTimestamp = new Date(combinedDate).getTime();

    if (
      Number.isFinite(combinedTimestamp) &&
      combinedTimestamp > 0
    ) {
      return combinedTimestamp;
    }

    const dateOnlyTimestamp = new Date(rawDate).getTime();

    return Number.isFinite(dateOnlyTimestamp) &&
      dateOnlyTimestamp > 0
      ? dateOnlyTimestamp
      : 0;
  };

  return (
    parseAppointmentDate(appointmentDate) ||
    parseAppointmentDate(queueDate) ||
    parseDateValue(appointment.createdAt) ||
    parseDateValue(appointment.approvedAt) ||
    0
  );
};

// Get a date key using Philippine time.
const getManilaDateKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return `${year}-${month}-${day}`;
};

const getManilaMonth = (date = new Date()) => {
  return getManilaDateKey(date).slice(0, 7);
};

const formatNumber = (number) => {
  return new Intl.NumberFormat('en-PH').format(number || 0);
};

const formatPercentage = (value) => {
  return `${Number(value || 0).toFixed(1)}%`;
};

export default function PerformanceReport({
  appointments,
  filteredAppointments
}) {
  const [firestoreAppointments, setFirestoreAppointments] = useState([]);

  const [firestoreState, setFirestoreState] = useState({
    status: 'loading',
    error: ''
  });

  const [period, setPeriod] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  /*
   * Backward compatibility:
   * If the parent provides appointments or filteredAppointments,
   * use that data.
   *
   * Otherwise, retrieve appointments directly from Firestore.
   */
  const hasProvidedAppointments =
    Array.isArray(appointments) ||
    Array.isArray(filteredAppointments);

  const providedAppointments = Array.isArray(appointments)
    ? appointments
    : Array.isArray(filteredAppointments)
      ? filteredAppointments
      : null;

  const loading =
    !hasProvidedAppointments &&
    firestoreState.status === 'loading';

  const loadError =
    !hasProvidedAppointments &&
    firestoreState.status === 'error'
      ? firestoreState.error
      : '';

  // Subscribe to Firestore only when no appointment prop is provided.
  useEffect(() => {
    if (hasProvidedAppointments) {
      return undefined;
    }

    const unsubscribe = onSnapshot(
      collection(db, 'appointments'),
      (snapshot) => {
        const records = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data()
        }));

        setFirestoreAppointments(records);

        setFirestoreState({
          status: 'success',
          error: ''
        });
      },
      (error) => {
        console.error(
          'Failed to load performance report appointments:',
          error
        );

        setFirestoreState({
          status: 'error',
          error:
            error?.message ||
            'Unable to load appointment records. Please try again.'
        });
      }
    );

    return () => unsubscribe();
  }, [hasProvidedAppointments]);

  // Use the supplied records or the live Firestore records.
  const sourceAppointments = hasProvidedAppointments
    ? providedAppointments
    : firestoreAppointments;

  // Only include SWDS appointments with an actual requested service.
  const swdsAppointments = useMemo(() => {
    if (!Array.isArray(sourceAppointments)) {
      return [];
    }

    return sourceAppointments.filter((appointment) => {
      const office = String(appointment?.office || '')
        .trim()
        .toUpperCase();

      const requestedServices = getRequestedServices(appointment);

      return (
        office === OFFICE_NAME &&
        requestedServices.length > 0
      );
    });
  }, [sourceAppointments]);

  // Apply the selected date period.
  const periodAppointments = useMemo(() => {
    const now = new Date();
    const todayKey = getManilaDateKey(now);
    const currentMonth = getManilaMonth(now);
    const nowMillis = now.getTime();

    return swdsAppointments.filter((appointment) => {
      if (period === 'all') {
        return true;
      }

      const appointmentMillis = getAppointmentDate(appointment);

      if (!appointmentMillis) {
        return false;
      }

      const appointmentDate = new Date(appointmentMillis);
      const appointmentDateKey = getManilaDateKey(appointmentDate);

      if (period === 'today') {
        return appointmentDateKey === todayKey;
      }

      if (period === '7days') {
        const sevenDaysAgo = nowMillis - 7 * 24 * 60 * 60 * 1000;

        return (
          appointmentMillis >= sevenDaysAgo &&
          appointmentMillis <= nowMillis
        );
      }

      if (period === '30days') {
        const thirtyDaysAgo = nowMillis - 30 * 24 * 60 * 60 * 1000;

        return (
          appointmentMillis >= thirtyDaysAgo &&
          appointmentMillis <= nowMillis
        );
      }

      if (period === 'month') {
        return getManilaMonth(appointmentDate) === currentMonth;
      }

      return true;
    });
  }, [swdsAppointments, period]);

  // Count each individual requested service.
  // An appointment requesting three services adds one request to each service.
  const serviceStatistics = useMemo(() => {
    const serviceMap = new Map();

    periodAppointments.forEach((appointment) => {
      const requestedServices = getRequestedServices(appointment);

      requestedServices.forEach((originalService) => {
        const normalized = normalizeService(originalService);

        if (!normalized) return;

        if (!serviceMap.has(normalized)) {
          serviceMap.set(normalized, {
            name: originalService,
            count: 0
          });
        }

        serviceMap.get(normalized).count += 1;
      });
    });

    return Array.from(serviceMap.values()).sort((a, b) => {
      return (
        b.count - a.count ||
        a.name.localeCompare(b.name)
      );
    });
  }, [periodAppointments]);

  // Total individual service requests.
  const totalIndividualServiceRequests = useMemo(() => {
    return serviceStatistics.reduce(
      (total, service) => total + service.count,
      0
    );
  }, [serviceStatistics]);

  // Determine the most requested service.
  const mostRequestedServices = useMemo(() => {
    if (serviceStatistics.length === 0) {
      return [];
    }

    const highestCount = serviceStatistics[0].count;

    return serviceStatistics.filter(
      (service) => service.count === highestCount
    );
  }, [serviceStatistics]);

  const mostRequestedCount =
    mostRequestedServices.length > 0
      ? mostRequestedServices[0].count
      : 0;

  // Summary statistics.
  const summary = useMemo(() => {
    const totalRequests = periodAppointments.length;

    const completed = periodAppointments.filter((appointment) => {
      return String(appointment?.status || '')
        .trim()
        .toLowerCase() === 'completed';
    }).length;

    const pending = periodAppointments.filter((appointment) => {
      const status = String(appointment?.status || '')
        .trim()
        .toLowerCase();

      return (
        status === 'pending' ||
        status === 'waiting' ||
        status === ''
      );
    }).length;

    const uniqueServices = serviceStatistics.length;

    const onlineBookings = periodAppointments.filter(
      (appointment) => getBookingChannel(appointment) === 'online'
    ).length;

    const walkInBookings = periodAppointments.filter(
      (appointment) => getBookingChannel(appointment) === 'walk-in'
    ).length;

    return {
      totalRequests,
      completed,
      pending,
      uniqueServices,
      onlineBookings,
      walkInBookings
    };
  }, [periodAppointments, serviceStatistics]);

  // Search the service ranking without changing the total percentage base.
  const displayedServices = useMemo(() => {
    const normalizedSearch = String(searchTerm || '')
      .trim()
      .toLowerCase();

    if (!normalizedSearch) {
      return serviceStatistics;
    }

    return serviceStatistics.filter((service) =>
      service.name.toLowerCase().includes(normalizedSearch)
    );
  }, [serviceStatistics, searchTerm]);

  const maxServiceCount = serviceStatistics[0]?.count || 1;

  const getServicePercentage = (count) => {
    if (totalIndividualServiceRequests === 0) return 0;

    return (
      (count / totalIndividualServiceRequests) * 100
    );
  };

  // Numeric-leading object keys must be quoted.
  const getPeriodLabel = () => {
    const labels = {
      all: 'All Time',
      today: 'Today',
      '7days': 'Last 7 Days',
      '30days': 'Last 30 Days',
      month: 'This Month'
    };

    return labels[period] || 'All Time';
  };

  // Loading state.
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-20 shadow-sm">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-sky-600" />

            <p className="text-sm font-semibold text-slate-500">
              Loading SWDS performance report...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error state.
  if (loadError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <AlertCircle className="h-6 w-6" />
          </div>

          <h2 className="text-lg font-black text-slate-900">
            Unable to Load Performance Report
          </h2>

          <p className="mt-2 max-w-lg text-sm text-slate-500">
            {loadError}
          </p>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-sky-700"
          >
            <RefreshCw className="h-4 w-4" />
            Reload Report
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
              <BarChart3 className="h-5 w-5" />
            </div>

            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">
                Performance Report
              </h1>

              <p className="mt-0.5 text-xs font-medium text-slate-500">
                Requested service analytics for {OFFICE_NAME}
              </p>
            </div>
          </div>
        </div>

        {/* Period Filter */}
        <div className="flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm sm:self-auto">
          <Filter className="h-4 w-4 text-sky-600" />

          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            aria-label="Filter report period"
            className="cursor-pointer bg-transparent text-xs font-bold text-slate-700 outline-none"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="month">This Month</option>
          </select>
        </div>
      </div>

      {/* Report Information */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-100 bg-sky-50/70 px-4 py-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-sky-800">
          <Activity className="h-4 w-4" />

          <span>
            Showing {OFFICE_NAME} requested services
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-medium text-sky-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
          Live appointment data
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">

        {/* Total Requests */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Total Bookings
              </p>

              <h2 className="mt-3 text-3xl font-black text-slate-900">
                {formatNumber(summary.totalRequests)}
              </h2>

              <p className="mt-1 text-[11px] text-slate-400">
                {getPeriodLabel()}
              </p>
            </div>

            <div className="rounded-xl bg-sky-50 p-3 text-sky-600">
              <ClipboardList className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Online Bookings */}
        <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Online Bookings
              </p>

              <h2 className="mt-3 text-3xl font-black text-sky-700">
                {formatNumber(summary.onlineBookings)}
              </h2>

              <p className="mt-1 text-[11px] text-slate-400">
                Online appointment records
              </p>
            </div>

            <div className="rounded-xl bg-sky-50 p-3 text-sky-600">
              <Globe className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Walk-In Bookings */}
        <div className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Walk-In Bookings
              </p>

              <h2 className="mt-3 text-3xl font-black text-violet-700">
                {formatNumber(summary.walkInBookings)}
              </h2>

              <p className="mt-1 text-[11px] text-slate-400">
                Walk-in registration records
              </p>
            </div>

            <div className="rounded-xl bg-violet-50 p-3 text-violet-600">
              <Footprints className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Unique Services */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Services Requested
              </p>

              <h2 className="mt-3 text-3xl font-black text-slate-900">
                {formatNumber(summary.uniqueServices)}
              </h2>

              <p className="mt-1 text-[11px] text-slate-400">
                Different service types
              </p>
            </div>

            <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600">
              <BriefcaseBusiness className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Completed */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Completed
              </p>

              <h2 className="mt-3 text-3xl font-black text-emerald-600">
                {formatNumber(summary.completed)}
              </h2>

              <p className="mt-1 text-[11px] text-slate-400">
                Completed appointments
              </p>
            </div>

            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Pending */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Pending
              </p>

              <h2 className="mt-3 text-3xl font-black text-amber-600">
                {formatNumber(summary.pending)}
              </h2>

              <p className="mt-1 text-[11px] text-slate-400">
                Awaiting processing
              </p>
            </div>

            <div className="rounded-xl bg-amber-50 p-3 text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Most Requested Service */}
      <div className="overflow-hidden rounded-2xl border border-sky-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-gradient-to-r from-sky-50 to-indigo-50 px-6 py-5">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />

            <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
              Most Requested Service
            </h2>
          </div>

          <p className="mt-1 text-xs text-slate-500">
            Based on individual services requested across SWDS appointments
          </p>
        </div>

        <div className="p-6">
          {mostRequestedServices.length > 0 ? (
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 flex-1">
                {mostRequestedServices.length === 1 ? (
                  <>
                    <p className="text-xs font-bold uppercase tracking-wider text-sky-600">
                      Highest Number of Requests
                    </p>

                    <h3 className="mt-2 break-words text-2xl font-black leading-tight text-slate-900 sm:text-3xl">
                      {mostRequestedServices[0].name}
                    </h3>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-bold uppercase tracking-wider text-sky-600">
                      Multiple Services Tied for First
                    </p>

                    <div className="mt-3 space-y-2">
                      {mostRequestedServices.map((service) => (
                        <h3
                          key={normalizeService(service.name)}
                          className="break-words text-lg font-black leading-tight text-slate-900 sm:text-xl"
                        >
                          {service.name}
                        </h3>
                      ))}
                    </div>
                  </>
                )}

                <p className="mt-3 text-sm text-slate-500">
                  {mostRequestedServices.length === 1
                    ? 'This is the most frequently requested service during the selected period.'
                    : 'These services have the same highest number of requests during the selected period.'}
                </p>
              </div>

              <div className="flex min-w-[150px] flex-col items-center justify-center rounded-2xl bg-sky-50 px-8 py-6 text-center">
                <span className="text-4xl font-black tabular-nums text-sky-700">
                  {formatNumber(mostRequestedCount)}
                </span>

                <span className="mt-1 text-xs font-bold uppercase tracking-wider text-sky-600">
                  {mostRequestedCount === 1 ? 'Request' : 'Requests'}
                </span>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <BarChart3 className="h-6 w-6" />
              </div>

              <h3 className="font-bold text-slate-700">
                No Requested Services Yet
              </h3>

              <p className="mt-1 text-xs text-slate-400">
                There are no SWDS appointment requests for {getPeriodLabel().toLowerCase()}.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Service Ranking */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
              <TrendingUp className="h-5 w-5 text-sky-600" />
              Requested Service Ranking
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Individual requested services ranked by appointment count
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search requested service..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-xs outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
            />
          </div>
        </div>

        <div className="p-6">
          {displayedServices.length > 0 ? (
            <div className="space-y-5">
              {displayedServices.map((service, index) => {
                const percentage = getServicePercentage(service.count);

                const isTopService =
                  service.count === mostRequestedCount;

                const barWidth =
                  (service.count / maxServiceCount) * 100;

                return (
                  <div
                    key={normalizeService(service.name)}
                    className="space-y-2"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black ${
                            isTopService
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {index + 1}
                        </span>

                        <div className="min-w-0">
                          <p className="break-words text-sm font-bold text-slate-800">
                            {service.name}
                          </p>

                          {isTopService && (
                            <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-600">
                              <Trophy className="h-3 w-3" />
                              Most Requested
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-3 pl-11 sm:pl-0">
                        <span className="text-xs font-semibold text-slate-400">
                          {formatPercentage(percentage)}
                        </span>

                        <span className="min-w-[75px] text-right text-sm font-black tabular-nums text-slate-900">
                          {formatNumber(service.count)}{' '}
                          {service.count === 1 ? 'request' : 'requests'}
                        </span>
                      </div>
                    </div>

                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isTopService
                            ? 'bg-sky-600'
                            : 'bg-indigo-400'
                        }`}
                        style={{
                          width: `${barWidth}%`
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-10 text-center">
              <Search className="mx-auto mb-3 h-8 w-8 text-slate-300" />

              <p className="text-sm font-bold text-slate-600">
                No matching services found
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Try another service name.
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 bg-slate-50/70 px-6 py-3">
          <p className="text-[11px] text-slate-400">
            Percentages are calculated using all individual service requests in the selected period. One appointment may contribute to multiple services.
          </p>
        </div>
      </div>

      {/* Report Footer */}
      <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <CalendarDays className="h-4 w-4 text-sky-600" />

          <span>
            Report Period: {getPeriodLabel()}
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <Users className="h-3.5 w-3.5" />

          <span>
            {formatNumber(summary.totalRequests)} SWDS appointment records analyzed
          </span>
        </div>
      </div>
    </div>
  );
}
