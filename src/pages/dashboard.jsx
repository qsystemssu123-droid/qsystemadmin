import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase.js';

import { getLocalDateString } from '../utils/dateUtils.js';
import { INITIAL_MOCK_APPOINTMENTS, REGISTERED_USERS } from '../data/mockData.js';

import DashboardHeader from '../components/dashboard/DashboardHeader.jsx';
import MetricCards from '../components/dashboard/MetricCards.jsx';
import BookingTrendsChart from '../components/dashboard/BookingTrendsChart.jsx';
import OfficeDistribution from '../components/dashboard/OfficeDistribution.jsx';
import ThreeOfficesPieChart from '../components/dashboard/ThreeOfficesPieChart.jsx';
import RegisteredUsersList from '../components/dashboard/RegisteredUsersList.jsx';


export default function Dashboard() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartTimeframe, setChartTimeframe] = useState('WEEK');

  // Track local today date string dynamically in state
  const [todayDateStr, setTodayDateStr] = useState(() => getLocalDateString());

  // Keep local today's date fresh live
  useEffect(() => {
    const interval = setInterval(() => {
      const currentLocal = getLocalDateString();
      setTodayDateStr((prev) => (prev !== currentLocal ? currentLocal : prev));
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Real-time listener using onSnapshot for instant UI updates
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'appointments'), (querySnapshot) => {
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      if (data.length === 0) {
        setAppointments(INITIAL_MOCK_APPOINTMENTS);
      } else {
        setAppointments(data);
      }
      setLoading(false);
    }, (error) => {
      console.error('Error listening to dashboard data:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Analytics Metrics Calculations
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

  // Office breakdown for analytics distribution
  const officeCounts = appointments.reduce((acc, curr) => {
    const off = curr.office || 'General';
    acc[off] = (acc[off] || 0) + 1;
    return acc;
  }, {});

  // Dedicated Counts for target offices: OSAS, CLINIC, SWDS
  const osasCount = appointments.filter(a => (a.office || '').trim().toUpperCase() === 'OSAS').length;
  const clinicCount = appointments.filter(a => (a.office || '').trim().toUpperCase() === 'CLINIC').length;
  const swdsCount = appointments.filter(a => (a.office || '').trim().toUpperCase() === 'SWDS').length;
  const total3OfficesBookings = osasCount + clinicCount + swdsCount;

  // Percentages for OSAS, CLINIC, SWDS
  const osasPercent = total3OfficesBookings > 0 ? Math.round((osasCount / total3OfficesBookings) * 100) : 0;
  const clinicPercent = total3OfficesBookings > 0 ? Math.round((clinicCount / total3OfficesBookings) * 100) : 0;
  const swdsPercent = total3OfficesBookings > 0 ? Math.round((swdsCount / total3OfficesBookings) * 100) : 0;

  // SVG Pie Chart calculations
  const CIRCUMFERENCE = 2 * Math.PI * 40;
  const osasDash = (osasCount / (total3OfficesBookings || 1)) * CIRCUMFERENCE;
  const clinicDash = (clinicCount / (total3OfficesBookings || 1)) * CIRCUMFERENCE;
  const swdsDash = (swdsCount / (total3OfficesBookings || 1)) * CIRCUMFERENCE;

  const osasOffset = 0;
  const clinicOffset = -osasDash;
  const swdsOffset = -(osasDash + clinicDash);

  // Line Chart Data Generator
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

  // Filtered appointments list

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-500 animate-pulse">Loading SSU Queue Analytics...</p>
        </div>
      </div>
    );
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
        .animate-slide-right-1 { animation: slideInRightToLeft 3s cubic-bezier(0.16, 1, 0.3, 1) 0.05s both; }
        .animate-slide-right-2 { animation: slideInRightToLeft 3s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both; }
        .animate-slide-right-3 { animation: slideInRightToLeft 3s cubic-bezier(0.16, 1, 0.3, 1) 0.25s both; }
        .animate-slide-right-4 { animation: slideInRightToLeft 3s cubic-bezier(0.16, 1, 0.3, 1) 0.35s both; }
        .animate-slide-right-5 { animation: slideInRightToLeft 3s cubic-bezier(0.16, 1, 0.3, 1) 0.45s both; }
      `}</style>

      <div className="space-y-6 pb-12 transition-all duration-300">
        <DashboardHeader />

        <MetricCards
          bookedTodayCount={bookedTodayCount}
          registeredUsersCount={REGISTERED_USERS.length}
          activeOfficesCount={Object.keys(officeCounts).length || 3}
          completionRate={completionRate}
          completedCount={completedCount}
          totalBookings={totalBookings}
        />

        <BookingTrendsChart
          chartTimeframe={chartTimeframe}
          setChartTimeframe={setChartTimeframe}
          lineChartPoints={lineChartPoints}
          totalInTimeframe={totalInTimeframe}
        />

        <div className="animate-slide-right-3 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <OfficeDistribution
            officeCounts={officeCounts}
            totalBookings={totalBookings}
          />

          <ThreeOfficesPieChart
            osasCount={osasCount}
            clinicCount={clinicCount}
            swdsCount={swdsCount}
            osasPercent={osasPercent}
            clinicPercent={clinicPercent}
            swdsPercent={swdsPercent}
            total3OfficesBookings={total3OfficesBookings}
            osasDash={osasDash}
            clinicDash={clinicDash}
            swdsDash={swdsDash}
            osasOffset={osasOffset}
            clinicOffset={clinicOffset}
            swdsOffset={swdsOffset}
            CIRCUMFERENCE={CIRCUMFERENCE}
          />

          <RegisteredUsersList registeredUsers={REGISTERED_USERS} />
        </div>

        
      </div>
    </>
  );
}