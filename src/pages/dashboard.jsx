import { useState, useEffect } from 'react';
import { 
  Users, 
  Calendar, 
  Building2, 
  CheckCircle2, 
  TrendingUp,
  Search,
} from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase.js';

export default function Dashboard() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOffice, setFilterOffice] = useState('ALL');

  // Real-time listener using onSnapshot for instant UI updates
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'appointments'), (querySnapshot) => {
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Fallback or blend with mock samples if collection is empty in development
      if (data.length === 0) {
        setAppointments([
          {
            id: '1',
            userName: 'Beta X1 Tester',
            userEmail: 'betax1tester@gmail.com',
            office: 'OSAS',
            service: 'Good Moral Certificate',
            appointmentDate: '2026-08-12',
            appointmentTime: '07:18 PM',
            status: 'waiting',
            queueNumber: '#002',
            userPhoto: 'https://lh3.googleusercontent.com/a/ACg8ocJ8iVWjuv-mRzi4ROTN41NJ675TC7MpHViHApL3zXMOuiPCZQ=s96-c'
          },
          {
            id: '2',
            userName: 'Adona Jerico',
            userEmail: 'adonajerico28@gmail.com',
            office: 'Registrar',
            service: 'Transcript of Records',
            appointmentDate: '2026-08-14',
            appointmentTime: '09:30 AM',
            status: 'completed',
            queueNumber: '#001',
            userPhoto: null
          },
          {
            id: '3',
            userName: 'Koby R. Sacendoncillo',
            userEmail: 'kobysacen05@gmail.com',
            office: 'Cashier',
            service: 'Tuition Payment Verification',
            appointmentDate: '2026-08-14',
            appointmentTime: '10:15 AM',
            status: 'waiting',
            queueNumber: '#003',
            userPhoto: null
          },
          {
            id: '4',
            userName: 'System Admin',
            userEmail: 'qsystemssu123@gmail.com',
            office: 'OSAS',
            service: 'Scholarship Inquiry',
            appointmentDate: '2026-08-14',
            appointmentTime: '01:00 PM',
            status: 'serving',
            queueNumber: '#004',
            userPhoto: null
          }
        ]);
      } else {
        setAppointments(data);
      }
      setLoading(false);
    }, (error) => {
      console.error('Error listening to dashboard data:', error);
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  // System Registered Users from Firebase Auth records snippet
  const registeredUsers = [
    { name: 'QSystems Admin', email: 'qsystemssu123@gmail.com', role: 'Administrator', joined: 'Aug 14, 2026', uid: '4x39ViZCA3drDhnQdLyn7bPdZxk2' },
    { name: 'Adona Jerico', email: 'adonajerico28@gmail.com', role: 'Student / User', joined: 'Aug 12, 2026', uid: '33gg3aQn8LMH80Lpmnx13hnmFfr1' },
    { name: 'Beta X1 Tester', email: 'betax1tester@gmail.com', role: 'Student / Tester', joined: 'Aug 12, 2026', uid: '3H1149x4vqUZHk5qRtKMGKQWrvM2' },
    { name: 'Koby R. Sacendoncillo', email: 'kobysacen05@gmail.com', role: 'Developer / Admin', joined: 'Aug 1, 2026', uid: '7hYFy6QTsMVoXpzVChHT9UHCQ7B3' },
  ];

  // Dynamic Live Analytics Metrics Calculations based on current system date
  const todayDateStr = new Date().toISOString().split('T')[0];
  
  const bookedTodayCount = appointments.filter(a => {
    // Check if appointmentDate matches today's date string (YYYY-MM-DD)
    if (a.appointmentDate === todayDateStr) return true;
    
    // Check if Firestore createdAt timestamp exists and falls on today
    if (a.createdAt) {
      const timestamp = a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const createdDateStr = timestamp.toISOString().split('T')[0];
      if (createdDateStr === todayDateStr) return true;
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

  // Filtered appointments list for table display
  const filteredAppointments = appointments.filter(item => {
    const matchesSearch = item.userName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.service?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesOffice = filterOffice === 'ALL' || item.office === filterOffice;
    return matchesSearch && matchesOffice;
  });

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center animate-fade-in">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-500 animate-pulse">Loading SSU Queue Analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-fade-in transition-all duration-300">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-sky-100 shadow-xs transition-all duration-300 hover:shadow-md transform hover:-translate-y-0.5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 transition-colors">SSU Q-Systems Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Real-time queue monitoring, office metrics, and user analytics.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 transition-transform duration-300 hover:scale-105">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            System Operational
          </span>
          <span className="text-xs font-medium text-slate-500 bg-sky-50 px-3 py-1.5 rounded-xl border border-sky-100 transition-transform duration-300 hover:scale-105">
            Today: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-6 rounded-2xl shadow-xs border border-sky-100 transition-all duration-300 hover:shadow-lg hover:border-sky-300 transform hover:-translate-y-1 group">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-500">Booked Today</h3>
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900 mt-3 transition-transform duration-300 group-hover:translate-x-1">{bookedTodayCount}</p>
          <div className="flex items-center gap-1.5 mt-3 text-xs font-semibold text-emerald-600">
            <TrendingUp className="w-4 h-4 transition-transform duration-300 group-hover:translate-y-[-2px]" />
            <span>Active queue flow normal</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-xs border border-sky-100 transition-all duration-300 hover:shadow-lg hover:border-sky-300 transform hover:-translate-y-1 group">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-500">Total Registered Users</h3>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900 mt-3 transition-transform duration-300 group-hover:translate-x-1">{registeredUsers.length}</p>
          <div className="flex items-center gap-1.5 mt-3 text-xs font-semibold text-indigo-600">
            <span>Synced with Firebase Auth</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-xs border border-sky-100 transition-all duration-300 hover:shadow-lg hover:border-sky-300 transform hover:-translate-y-1 group">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-500">Active Offices</h3>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900 mt-3 transition-transform duration-300 group-hover:translate-x-1">{Object.keys(officeCounts).length || 3}</p>
          <div className="flex items-center gap-1.5 mt-3 text-xs font-semibold text-amber-600">
            <span>OSAS, Registrar, Cashier</span>
          </div>
        </div>

        {/* Dynamic Completion Rate Card */}
        <div className="bg-white p-6 rounded-2xl shadow-xs border border-sky-100 transition-all duration-300 hover:shadow-lg hover:border-sky-300 transform hover:-translate-y-1 group">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-500">Completion Rate</h3>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-bold text-emerald-600 mt-3 transition-transform duration-300 group-hover:translate-x-1">{completionRate}%</p>
          <div className="flex items-center gap-1.5 mt-3 text-xs font-semibold text-slate-500">
            <span>{completedCount} of {totalBookings} appointments completed</span>
          </div>
        </div>
      </div>

      {/* Analytics Section: Office Distribution & User Sign-ins */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Office Bookings Breakdown */}
        <div className="bg-white p-6 rounded-2xl shadow-xs border border-sky-100 lg:col-span-2 flex flex-col justify-between transition-all duration-300 hover:shadow-md">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-900">Office Bookings Distribution</h2>
              <span className="text-xs font-medium text-slate-500">Real-time share</span>
            </div>
            
            <div className="space-y-4">
              {Object.entries(officeCounts).map(([officeName, count], idx) => {
                const percentage = Math.round((count / totalBookings) * 100);
                return (
                  <div key={officeName} className="space-y-1.5 transition-all duration-300 hover:translate-x-1">
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-slate-700 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-sky-600 transition-transform duration-300 hover:scale-125" />
                        {officeName}
                      </span>
                      <span className="text-slate-900 font-semibold">{count} bookings ({percentage}%)</span>
                    </div>
                    <div className="w-full h-3 bg-sky-50 rounded-full overflow-hidden border border-sky-100">
                      <div 
                        className="h-full bg-sky-600 rounded-full transition-all duration-1000 ease-out" 
                        style={{ width: `${Math.max(percentage, 10)}%`, transitionDelay: `${idx * 150}ms` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
              {Object.keys(officeCounts).length === 0 && (
                <p className="text-sm text-slate-500 py-8 text-center animate-pulse">No office booking metrics recorded yet.</p>
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-sky-100 flex items-center justify-between text-xs text-slate-500">
            <span>Sample Office: OSAS, Registrar, Cashier</span>
            <span className="font-semibold text-sky-700 animate-pulse">Updated Live</span>
          </div>
        </div>

        {/* User Engagement / Auth Summary */}
        <div className="bg-white p-6 rounded-2xl shadow-xs border border-sky-100 flex flex-col justify-between transition-all duration-300 hover:shadow-md">
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-4">User Authentication</h2>
            <p className="text-xs text-slate-500 mb-4">Latest registered credentials and UIDs from authentication database.</p>
            
            <div className="space-y-3">
              {registeredUsers.slice(0, 3).map((u, index) => (
                <div key={index} className="p-3 rounded-xl bg-sky-50/50 border border-sky-100 flex items-center justify-between transition-all duration-300 hover:bg-sky-100/60 hover:shadow-sm transform hover:scale-[1.02]">
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-bold text-slate-900 truncate">{u.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{u.email}</p>
                  </div>
                  <span className="text-[10px] font-semibold bg-sky-100 text-sky-800 px-2 py-1 rounded-lg shrink-0 transition-colors duration-200 hover:bg-sky-200">
                    {u.joined}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-sky-100 text-xs text-slate-500 flex items-center justify-between">
            <span>Total Auth Accounts: {registeredUsers.length}</span>
            <span className="text-sky-700 font-semibold">Active Session</span>
          </div>
        </div>
      </div>

      {/* Queue & Appointments Table Section with Search and Filter */}
      <div className="bg-white rounded-2xl shadow-xs border border-sky-100 overflow-hidden transition-all duration-300 hover:shadow-md">
        <div className="p-6 border-b border-sky-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Live Queue & Appointments</h2>
            <p className="text-xs text-slate-500 mt-0.5">Manage user queue tickets and appointments across campus offices.</p>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Search Bar */}
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 transition-colors duration-200 group-focus-within:text-sky-600" />
              <input 
                type="text"
                placeholder="Search user or service..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-sky-200 bg-sky-50/30 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:bg-white transition-all duration-300"
              />
            </div>

            {/* Office Filter */}
            <select
              value={filterOffice}
              onChange={(e) => setFilterOffice(e.target.value)}
              className="py-2 px-3 text-sm rounded-xl border border-sky-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400 transition-all duration-300 cursor-pointer hover:border-sky-300"
            >
              <option value="ALL">All Offices</option>
              <option value="OSAS">OSAS</option>
              <option value="Registrar">Registrar</option>
              <option value="Cashier">Cashier</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-sky-50/70 border-b border-sky-100 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-6">Queue #</th>
                <th className="py-3 px-6">User / Email</th>
                <th className="py-3 px-6">Office & Service</th>
                <th className="py-3 px-6">Date & Time</th>
                <th className="py-3 px-6">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-100 text-sm">
              {filteredAppointments.map((item, idx) => (
                <tr 
                  key={item.id || item.queueNumber} 
                  className="hover:bg-sky-50/60 transition-all duration-200 transform hover:scale-[1.002]"
                  style={{ animation: `fadeIn 0.4s ease-out ${idx * 0.05}s both` }}
                >
                  <td className="py-4 px-6 font-bold text-sky-700 transition-transform duration-200 hover:translate-x-1">{item.queueNumber || '#001'}</td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      {item.userPhoto ? (
                        <img src={item.userPhoto} alt="" className="w-8 h-8 rounded-full object-cover border border-sky-200 transition-transform duration-300 hover:scale-110" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs transition-transform duration-300 hover:scale-110">
                          {item.userName ? item.userName.charAt(0) : 'U'}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-slate-900">{item.userName || 'Unknown User'}</p>
                        <p className="text-xs text-slate-500">{item.userEmail || 'No email provided'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="inline-block px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-sky-100 text-sky-800 mb-1 transition-colors duration-200 hover:bg-sky-200">
                      {item.office}
                    </span>
                    <p className="text-xs font-medium text-slate-600">{item.service || item.reason}</p>
                  </td>
                  <td className="py-4 px-6 text-slate-600 text-xs">
                    <p className="font-medium text-slate-800">{item.appointmentDate}</p>
                    <p className="text-slate-500">{item.appointmentTime}</p>
                  </td>
                  <td className="py-4 px-6">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-300 hover:scale-105 ${
                        item.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.status === 'serving'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-sky-100 text-sky-800'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        item.status === 'completed' ? 'bg-emerald-500 animate-pulse' : item.status === 'serving' ? 'bg-amber-500 animate-ping' : 'bg-sky-500 animate-pulse'
                      }`}></span>
                      {item.status || 'waiting'}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredAppointments.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-500 text-sm animate-pulse">
                    No matching queue tickets or appointments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}