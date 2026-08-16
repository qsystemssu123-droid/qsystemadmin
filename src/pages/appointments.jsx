import { useState } from 'react';
import { useAppointments } from '../hooks/useAppointments';
import AppointmentsTable from '../components/appointments/AppointmentsTable.jsx';

export default function Appointments() {
  const { appointments = [], loading } = useAppointments();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOffice, setFilterOffice] = useState('ALL');

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm font-medium text-slate-500 animate-pulse">
          Loading appointments from database...
        </p>
      </div>
    );
  }

  // Calculate total counts per office for the filter controls
  const officeCounts = appointments.reduce((acc, item) => {
    if (item.office) {
      acc[item.office] = (acc[item.office] || 0) + 1;
    }
    return acc;
  }, {});

  // Filter appointments based on search term and selected office
  const filteredAppointments = appointments.filter((item) => {
    const matchesSearch =
      item.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.service?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesOffice = filterOffice === 'ALL' || item.office === filterOffice;
    return matchesSearch && matchesOffice;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <style>{`
        @keyframes fadeIn {
          0% {
            opacity: 0;
            transform: translateY(4px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fadeIn 3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Header Box */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Student Bookings & Appointments
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage serving, waiting, priority, and completed student bookings in real-time.
            </p>
          </div>
        </div>
      </div>

      {/* Reusable Appointments Table Component */}
      <AppointmentsTable
        filteredAppointments={filteredAppointments}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filterOffice={filterOffice}
        setFilterOffice={setFilterOffice}
        officeCounts={officeCounts}
      />
    </div>
  );
}