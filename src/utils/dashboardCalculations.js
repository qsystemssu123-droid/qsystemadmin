import { getLocalDateString } from './dateUtils.js';

export function calculateDashboardMetrics(appointments, todayDateStr, chartTimeframe) {
  const bookedTodayCount = appointments.filter(a => {
    const apptDateStr = getLocalDateString(a.appointmentDate);
    if (apptDateStr && apptDateStr === todayDateStr) return true;

    if (a.createdAt) {
      const createdDateStr = getLocalDateString(a.createdAt);
      if (createdDateStr && createdDateStr === todayDateStr) return true;
    }
    return false;
  }).length;

  const totalBookings = appointments.length || 1;
  const completedCount = appointments.filter(a => a.status === 'completed').length;
  const completionRate = Math.round((completedCount / totalBookings) * 100);

  const officeCounts = appointments.reduce((acc, curr) => {
    const off = curr.office || 'General';
    acc[off] = (acc[off] || 0) + 1;
    return acc;
  }, {});

  const osasCount = appointments.filter(a => (a.office || '').trim().toUpperCase() === 'OSAS').length;
  const clinicCount = appointments.filter(a => (a.office || '').trim().toUpperCase() === 'CLINIC').length;
  const swdsCount = appointments.filter(a => (a.office || '').trim().toUpperCase() === 'SWDS').length;
  const total3OfficesBookings = osasCount + clinicCount + swdsCount;

  const osasPercent = total3OfficesBookings > 0 ? Math.round((osasCount / total3OfficesBookings) * 100) : 0;
  const clinicPercent = total3OfficesBookings > 0 ? Math.round((clinicCount / total3OfficesBookings) * 100) : 0;
  const swdsPercent = total3OfficesBookings > 0 ? Math.round((swdsCount / total3OfficesBookings) * 100) : 0;

  const CIRCUMFERENCE = 2 * Math.PI * 40;
  const osasDash = (osasCount / (total3OfficesBookings || 1)) * CIRCUMFERENCE;
  const clinicDash = (clinicCount / (total3OfficesBookings || 1)) * CIRCUMFERENCE;
  const swdsDash = (swdsCount / (total3OfficesBookings || 1)) * CIRCUMFERENCE;

  const osasOffset = 0;
  const clinicOffset = -osasDash;
  const swdsOffset = -(osasDash + clinicDash);

  const getLineChartData = () => {
    const today = todayDateStr ? new Date(todayDateStr + 'T00:00:00') : new Date();

    if (chartTimeframe === 'WEEK') {
      const dayOfWeek = today.getDay();
      const distToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(today);
      monday.setDate(today.getDate() - distToMon);

      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      return days.map((dayName, idx) => {
        const targetDate = new Date(monday);
        targetDate.setDate(monday.getDate() + idx);
        const dateStr = getLocalDateString(targetDate);
        const count = appointments.filter(a => {
          const apptStr = getLocalDateString(a.appointmentDate || a.createdAt);
          return apptStr === dateStr;
        }).length;
        return { label: dayName, subLabel: dateStr.slice(5), count };
      });
    }

    if (chartTimeframe === 'MONTH') {
      const year = today.getFullYear();
      const month = today.getMonth();
      const monthName = today.toLocaleDateString('en-US', { month: 'short' });

      const buckets = [
        { label: 'W1 (1-7)', start: 1, end: 7 },
        { label: 'W2 (8-14)', start: 8, end: 14 },
        { label: 'W3 (15-21)', start: 15, end: 21 },
        { label: 'W4 (22-28)', start: 22, end: 28 },
        { label: 'W5 (29+)', start: 29, end: 31 },
      ];

      return buckets.map(b => {
        const count = appointments.filter(a => {
          const apptStr = getLocalDateString(a.appointmentDate || a.createdAt);
          if (!apptStr) return false;
          const [y, m, day] = apptStr.split('-').map(Number);
          return y === year && (m - 1) === month && day >= b.start && day <= b.end;
        }).length;
        return { label: b.label, subLabel: monthName, count };
      });
    }

    if (chartTimeframe === 'YEAR') {
      const year = today.getFullYear();
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return months.map((mName, idx) => {
        const count = appointments.filter(a => {
          const apptStr = getLocalDateString(a.appointmentDate || a.createdAt);
          if (!apptStr) return false;
          const [y, m] = apptStr.split('-').map(Number);
          return y === year && (m - 1) === idx;
        }).length;
        return { label: mName, subLabel: `${year}`, count };
      });
    }

    return [];
  };

  const lineChartPoints = getLineChartData();
  const totalInTimeframe = lineChartPoints.reduce((sum, p) => sum + p.count, 0);

  return {
    bookedTodayCount,
    totalBookings,
    completedCount,
    completionRate,
    officeCounts,
    osasCount,
    clinicCount,
    swdsCount,
    total3OfficesBookings,
    osasPercent,
    clinicPercent,
    swdsPercent,
    CIRCUMFERENCE,
    osasDash,
    clinicDash,
    swdsDash,
    osasOffset,
    clinicOffset,
    swdsOffset,
    lineChartPoints,
    totalInTimeframe
  };
}