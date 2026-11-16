import { useEffect, useState } from 'react';
import { useAppointments } from '../hooks/useAppointments';
import { X } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import Clinic from '../components/queue/clinic';
import Osas from '../components/queue/osas';
import Swds from '../components/queue/swds';

const ADMIN_EMAIL = 'qsystemssu123@gmail.com';

export default function Queue() {
  const {
    appointments,
    loading: appointmentsLoading,
    approveAppointment,
    rejectAppointment,
    completeAppointment,
  } = useAppointments();

  const [currentUser, setCurrentUser] = useState(null);
  const [staffOffice, setStaffOffice] = useState(null);
  const [accessLoading, setAccessLoading] = useState(true);
  const [selectedOffice, setSelectedOffice] = useState('Clinic');
  const [selectedImage, setSelectedImage] = useState(null);

  const isAdmin =
    currentUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  useEffect(() => {
    let unsubscribe;

    const loadUserAccess = async (user) => {
      setCurrentUser(user);
      setStaffOffice(null);

      if (!user) {
        setAccessLoading(false);
        return;
      }

      if (user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        setAccessLoading(false);
        setSelectedOffice('Clinic'); // Default admin tab view
        return;
      }

      try {
        const staffQuery = query(
          collection(db, 'staff'),
          where('email', '==', user.email)
        );
        const staffSnapshot = await getDocs(staffQuery);

        if (!staffSnapshot.empty) {
          const staffData = staffSnapshot.docs[0].data();
          const assignedOffice = String(
            staffData.office || ''
          ).trim();

          if (assignedOffice) {
            // Capitalize properly to match component keys: e.g. "CLINIC" -> "Clinic" or exact match
            const formattedOffice =
              assignedOffice.charAt(0).toUpperCase() +
              assignedOffice.slice(1).toLowerCase();
            setStaffOffice(formattedOffice);
            setSelectedOffice(formattedOffice);
          }
        }
      } catch (error) {
        console.error('Failed to load staff access:', error);
      } finally {
        setAccessLoading(false);
      }
    };

    unsubscribe = onAuthStateChanged(auth, loadUserAccess);

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const offices = ['Clinic', 'SWDS', 'OSAS'];

  if (appointmentsLoading || accessLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm font-medium text-slate-500 animate-pulse">
          Loading live queue data...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-1 sm:px-0">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in-slow {
          animation: fadeIn 1s ease-in-out;
        }
      `}</style>

      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-4 sm:p-5 animate-fade-in-slow">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Live Queue Management
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
              Manage, approve, complete, or reject student appointments in
              real-time for <span className="font-semibold text-slate-700">{selectedOffice}</span>.
            </p>
          </div>

          {/* Office Switcher Tabs: Visible ONLY to Admin */}
          {isAdmin ? (
            <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 w-full lg:w-auto shadow-inner gap-1">
              {offices.map((office) => {
                const isSelected = selectedOffice === office;
                return (
                  <button
                    key={office}
                    onClick={() => setSelectedOffice(office)}
                    className={`flex-1 lg:flex-initial px-3 sm:px-5 py-2 sm:py-2.5 text-xs font-bold rounded-xl transition-all duration-300 transform active:scale-95 cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? 'bg-white text-blue-700 shadow-md border-2 border-blue-500 ring-4 ring-purple-100 scale-102'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 border-2 border-transparent'
                    }`}
                  >
                    {office}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="bg-slate-50 px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-inner">
              Office Assignment: <span className="text-blue-600">{staffOffice}</span>
            </div>
          )}
        </div>
      </div>

      {/* Conditional rendering of individual office components with fade-in animation */}
      <div key={selectedOffice} className="animate-fade-in-slow">
        {selectedOffice.toLowerCase() === 'clinic' && (
          <Clinic
            appointments={appointments}
            approveAppointment={approveAppointment}
            rejectAppointment={rejectAppointment}
            completeAppointment={completeAppointment}
            setSelectedImage={setSelectedImage}
          />
        )}

        {selectedOffice.toLowerCase() === 'osas' && (
          <Osas
            appointments={appointments}
            approveAppointment={approveAppointment}
            rejectAppointment={rejectAppointment}
            completeAppointment={completeAppointment}
            setSelectedImage={setSelectedImage}
          />
        )}

        {selectedOffice.toLowerCase() === 'swds' && (
          <Swds
            appointments={appointments}
            approveAppointment={approveAppointment}
            rejectAppointment={rejectAppointment}
            completeAppointment={completeAppointment}
            setSelectedImage={setSelectedImage}
          />
        )}
      </div>

      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in-slow">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 relative shadow-xl border border-slate-200 flex flex-col items-center">
            <div className="flex items-center justify-between w-full mb-4">
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                PWD / Senior Citizen ID
              </h3>
              <button
                onClick={() => setSelectedImage(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="w-full bg-slate-100 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center max-h-[350px] sm:max-h-[400px]">
              <img
                src={selectedImage}
                alt="Priority ID Verification"
                className="object-contain max-h-[350px] sm:max-h-[400px] w-full"
              />
            </div>

            <div className="mt-5 w-full flex justify-end">
              <button
                onClick={() => setSelectedImage(null)}
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}