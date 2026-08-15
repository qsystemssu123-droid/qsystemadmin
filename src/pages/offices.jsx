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
      head: 'Dr. Maria Santos',
      services: ['Good Moral Certificate', 'Student Org Clearance', 'Scholarships', 'Disciplinary Tracking']
    },
    { 
      name: 'University Clinic', 
      dbKey: 'CLINIC', 
      currentLoad: 'Low', 
      appointmentCount: 0,
      location: 'Ground Floor, Medical Building',
      head: 'Dr. Juan Dela Cruz',
      services: ['Medical Consultation', 'Dental Checkup', 'Health Certificates', 'First Aid & Emergency']
    },
    { 
      name: 'SWDS (Social Welfare & Development Services)', 
      dbKey: 'SWDS', 
      currentLoad: 'None', 
      appointmentCount: 0,
      location: '2nd Floor, Administration Building',
      head: 'Prof. Ana Reyes',
      services: ['Counseling Session', 'Financial Assistance', 'Student Welfare Support', 'Guidance Services']
    },
  ]);

  // Determine if today is Monday to Thursday (1 to 4)
  // getDay(): 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday
  const today = new Date().getDay();
  const isOpenDay = today >= 1 && today <= 5;
  const currentStatus = isOpenDay ? 'Open' : 'Closed';

  // Real-time listener to count "waiting" appointments from the "appointments" collection
  useEffect(() => {
    const db = getFirestore();
    const unsubscribe = onSnapshot(collection(db, 'appointments'), (snapshot) => {
      const docs = snapshot.docs.map(doc => doc.data());
      
      setOffices(prev => prev.map(office => {
        // Match against both the full name or the short dbKey stored in Firestore
        const officeDocs = docs.filter(d => 
          d.office === office.dbKey || d.office === office.name
        );
        
        // Count strictly "waiting" appointments as requested
        const waitingCount = officeDocs.filter(d => d.status === 'waiting').length;

        // Custom Traffic Load Calculation based on your new thresholds:
        // - High: 30 or more
        // - Moderate: 10 to 15
        // - Low: Around 5 (or up to 9)
        // - None: 0
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

  // Calculate overall metrics for summary cards
  const totalWaiting = offices.reduce((acc, curr) => acc + curr.appointmentCount, 0);
  const activeOfficesCount = offices.length;

  return (
    <div className="space-y-6">
      {/* Header & Status Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Department & Office Status</h1>
          <p className="text-sm text-gray-500 mt-1">Monitor real-time queue traffic, location details, and available institutional services.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm font-medium text-gray-700 bg-gray-50 px-4 py-2 rounded-xl border border-gray-200">
            Schedule: <span className="text-gray-900 font-semibold">Monday – Thursday (Open) | Friday (Closed)</span>
          </div>
        </div>
      </div>

      {/* Quick Metrics Overview Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Monitored Offices</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{activeOfficesCount} Units</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Active Queues</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{totalWaiting} Students</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">System Operational Status</p>
            <p className="text-xl font-bold text-emerald-600 mt-1">Online & Syncing</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Main Office Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {offices.map((office, idx) => (
          <div key={idx} className="bg-white p-6 rounded-2xl shadow-xs border border-gray-200 space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
                  {office.dbKey}
                </span>
                <h3 className="font-bold text-gray-900 text-lg mt-2">{office.name}</h3>
                
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                  <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{office.location}</span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                  <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>Head: {office.head}</span>
                </div>
              </div>
              
              <div className="pt-2 border-t border-gray-100 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Operational Status:</span>
                  <span className={`font-semibold px-2 py-0.5 rounded-full text-xs ${currentStatus === 'Open' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {currentStatus}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Traffic Load:</span>
                  <span className={`font-semibold px-2.5 py-0.5 rounded-md text-xs ${
                    office.currentLoad === 'High' ? 'bg-red-100 text-red-800' :
                    office.currentLoad === 'Moderate' ? 'bg-amber-100 text-amber-800' :
                    office.currentLoad === 'Low' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {office.currentLoad}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Waiting Bookings:</span>
                  <span className="font-bold text-gray-900 bg-gray-100 px-2.5 py-0.5 rounded-md">
                    {office.appointmentCount}
                  </span>
                </div>
              </div>

              {/* Offered Services Section */}
              <div className="pt-3 border-t border-gray-100 space-y-2">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Available Services:</p>
                <div className="flex flex-wrap gap-1.5">
                  {office.services.map((service, sIdx) => (
                    <span key={sIdx} className="text-[11px] bg-gray-50 text-gray-600 px-2 py-1 rounded-lg border border-gray-200">
                      {service}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}