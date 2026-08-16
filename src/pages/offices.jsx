import { useState, useEffect } from 'react';
import { 
  getFirestore, 
  collection, 
  onSnapshot 
} from 'firebase/firestore';

export default function Offices() {
  const [offices, setOffices] = useState([
    { 
      name: 'OSAS (Office of Student Affairs and Services)', 
      dbKey: 'OSAS', 
      currentLoad: 'Low', 
      appointmentCount: 0,
      location: '1st Floor, Student Center Building',
      head: 'Dr. Maria Santos'
    },
    { 
      name: 'University Clinic', 
      dbKey: 'CLINIC', 
      currentLoad: 'Low', 
      appointmentCount: 0,
      location: 'Ground Floor, Medical Building',
      head: 'Dr. Juan Dela Cruz'
    },
    { 
      name: 'SWDS (Social Welfare & Development Services)', 
      dbKey: 'SWDS', 
      currentLoad: 'None', 
      appointmentCount: 0,
      location: '2nd Floor, Administration Building',
      head: 'Prof. Ana Reyes'
    },
  ]);

  // Determine if today is Monday to Friday (1 to 5)
  const today = new Date().getDay();
  const isOpenDay = today >= 1 && today <= 5;
  const currentStatus = isOpenDay ? 'Open' : 'Closed';

  // Real-time listener to count "waiting" appointments from the "appointments" collection
  useEffect(() => {
    const db = getFirestore();
    const unsubscribe = onSnapshot(collection(db, 'appointments'), (snapshot) => {
      const docs = snapshot.docs.map(doc => doc.data());
      
      setOffices(prev => prev.map(office => {
        const officeDocs = docs.filter(d => 
          d.office === office.dbKey || d.office === office.name
        );
        
        const waitingCount = officeDocs.filter(d => d.status === 'waiting').length;

        let calculatedLoad = 'None';
        if (waitingCount >= 30) {
          calculatedLoad = 'High';
        } else if (waitingCount >= 10 && waitingCount <= 15) {
          calculatedLoad = 'Moderate';
        } else if (waitingCount > 0) {
          calculatedLoad = 'Low';
        }

        return {
          ...office,
          appointmentCount: waitingCount,
          currentLoad: currentStatus === 'Closed' ? 'None' : calculatedLoad
        };
      }));
    });

    return () => unsubscribe();
  }, [currentStatus]);

  const totalWaiting = offices.reduce((acc, curr) => acc + curr.appointmentCount, 0);
  const activeOfficesCount = offices.length;

  const getLoadBadgeStyle = (load) => {
    switch (load) {
      case 'High':
        return 'bg-rose-50 text-rose-700 border-rose-200/80 ring-1 ring-rose-500/10';
      case 'Moderate':
        return 'bg-amber-50 text-amber-700 border-amber-200/80 ring-1 ring-amber-500/10';
      case 'Low':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/80 ring-1 ring-emerald-500/10';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200/80';
    }
  };

  return (
    <div className="font-sans space-y-6 antialiased text-slate-800 animate-fade-in">
      <style>{`
        @keyframes fadeIn {
          0% {
            opacity: 0;
            transform: translateY(6px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fadeIn 4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Header & Status Banner */}
      <div className="relative overflow-hidden bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100/80 text-indigo-700 text-xs font-semibold tracking-wide uppercase">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
              </span>
              Live Queue Tracking
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Department & Office Status
            </h1>
            <p className="text-sm text-slate-500 max-w-2xl leading-relaxed">
              Monitor real-time queue traffic, location details, and headcount across all campus units.
            </p>
          </div>

          <div className="flex items-center shrink-0">
            <div className="flex items-center gap-3 text-xs font-medium text-slate-600 bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <svg className="w-4 h-4 text-indigo-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Schedule: <strong className="text-slate-900 font-semibold">Mon – Fri (Open) | Sat – Sun (Closed)</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Metrics Overview Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Metric 1 */}
        <div className="group relative bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-300 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Monitored Offices</p>
            <p className="text-2xl font-extrabold tracking-tight text-slate-900">{activeOfficesCount} <span className="text-sm font-medium text-slate-500">Units</span></p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="group relative bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-300 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Active Queues</p>
            <p className="text-2xl font-extrabold tracking-tight text-slate-900">{totalWaiting} <span className="text-sm font-medium text-slate-500">Students</span></p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="group relative bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-300 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">System Status</p>
            <p className="text-2xl font-extrabold tracking-tight text-emerald-600 flex items-center gap-2">
              Online
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Main Office Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {offices.map((office, idx) => (
          <div 
            key={idx} 
            className="group relative bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs hover:shadow-lg hover:border-slate-300 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between"
          >
            {/* Card Content */}
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-[11px] font-bold tracking-wider uppercase bg-slate-100 text-slate-600 border border-slate-200/60">
                  {office.dbKey}
                </span>

                {/* Status Dot Pill */}
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                  currentStatus === 'Open' 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                  <span className={`h-2 w-2 rounded-full ${currentStatus === 'Open' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                  {currentStatus}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors duration-200 leading-snug">
                  {office.name}
                </h3>

                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                    <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="truncate">{office.location}</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                    <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>Head: <strong className="text-slate-700 font-semibold">{office.head}</strong></span>
                  </div>
                </div>
              </div>

              {/* Traffic & Queue Statistics */}
              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100 space-y-3">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-slate-500">Traffic Load</span>
                  <span className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold border ${getLoadBadgeStyle(office.currentLoad)}`}>
                    {office.currentLoad}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs font-medium pt-2 border-t border-slate-200/60">
                  <span className="text-slate-500">Waiting Bookings</span>
                  <span className="text-sm font-bold text-slate-900 bg-white px-3 py-0.5 rounded-lg border border-slate-200/80 shadow-2xs">
                    {office.appointmentCount}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}