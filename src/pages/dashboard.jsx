import { useState } from 'react';
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

export default function Dashboard() {
  const [chartTimeframe, setChartTimeframe] = useState('WEEK');
  const { appointments, loading, todayDateStr } = useDashboardData();

  const metrics = calculateDashboardMetrics(appointments, todayDateStr, chartTimeframe);

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
        .animate-slide-right-1 { animation: slideInRightToLeft 3s cubic-bezier(0.16, 1, 0.3, 1) 0.05s both; }
        .animate-slide-right-2 { animation: slideInRightToLeft 3s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both; }
        .animate-slide-right-3 { animation: slideInRightToLeft 3s cubic-bezier(0.16, 1, 0.3, 1) 0.25s both; }
        .animate-slide-right-4 { animation: slideInRightToLeft 3s cubic-bezier(0.16, 1, 0.3, 1) 0.35s both; }
        .animate-slide-right-5 { animation: slideInRightToLeft 3s cubic-bezier(0.16, 1, 0.3, 1) 0.45s both; }
      `}</style>

      <div className="space-y-6 pb-12 transition-all duration-300">
        <DashboardHeader />

        <MetricCards
          bookedTodayCount={metrics.bookedTodayCount}
          registeredUsersCount={REGISTERED_USERS.length}
          activeOfficesCount={Object.keys(metrics.officeCounts).length || 3}
          completionRate={metrics.completionRate}
          completedCount={metrics.completedCount}
          totalBookings={metrics.totalBookings}
        />

        <BookingTrendsChart
          chartTimeframe={chartTimeframe}
          setChartTimeframe={setChartTimeframe}
          lineChartPoints={metrics.lineChartPoints}
          totalInTimeframe={metrics.totalInTimeframe}
        />

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

          <RegisteredUsersList registeredUsers={REGISTERED_USERS} />
        </div>
      </div>
    </>
  );
}