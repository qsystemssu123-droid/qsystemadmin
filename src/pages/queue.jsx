import { useState } from 'react';
import { useAppointments } from '../hooks/useAppointments';
import { X } from 'lucide-react';
import Clinic from '../components/clinic';
import Osas from '../components/osas';
import Swds from '../components/swds';

export default function Queue() {
  const {
    appointments,
    loading,
    approveAppointment,
    rejectAppointment,
    completeAppointment,
  } = useAppointments();

  const [selectedOffice, setSelectedOffice] = useState('Clinic');
  const [selectedImage, setSelectedImage] = useState(null);

  const offices = ['Clinic', 'SWDS', 'OSAS'];

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm font-medium text-slate-500 animate-pulse">
          Loading live queue data...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Live Queue Management
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage, approve, complete, or reject student appointments in
              real-time for <span className="font-semibold text-slate-700">{selectedOffice}</span>.
            </p>
          </div>

          {/* Office Switcher Tabs with Animated Highlight Borders */}
          <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 w-full md:w-auto shadow-inner">
            {offices.map((office) => {
              const isSelected = selectedOffice === office;
              return (
                <button
                  key={office}
                  onClick={() => setSelectedOffice(office)}
                  className={`flex-1 md:flex-initial px-5 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 transform active:scale-95 ${
                    isSelected
                      ? 'bg-white text-purple-700 shadow-md border-2 border-purple-600 ring-4 ring-purple-100 scale-102'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 border-2 border-transparent'
                  }`}
                >
                  {office}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Conditional rendering of individual office components */}
      {selectedOffice === 'Clinic' && (
        <Clinic
          appointments={appointments}
          approveAppointment={approveAppointment}
          rejectAppointment={rejectAppointment}
          completeAppointment={completeAppointment}
          setSelectedImage={setSelectedImage}
        />
      )}

      {selectedOffice === 'OSAS' && (
        <Osas
          appointments={appointments}
          approveAppointment={approveAppointment}
          rejectAppointment={rejectAppointment}
          completeAppointment={completeAppointment}
          setSelectedImage={setSelectedImage}
        />
      )}

      {selectedOffice === 'SWDS' && (
        <Swds
          appointments={appointments}
          approveAppointment={approveAppointment}
          rejectAppointment={rejectAppointment}
          completeAppointment={completeAppointment}
          setSelectedImage={setSelectedImage}
        />
      )}

      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 relative shadow-xl border border-slate-200 flex flex-col items-center">
            <div className="flex items-center justify-between w-full mb-4">
              <h3 className="text-base font-bold text-slate-900">
                PWD / Senior Citizen ID
              </h3>
              <button
                onClick={() => setSelectedImage(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="w-full bg-slate-100 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center max-h-[400px]">
              <img
                src={selectedImage}
                alt="Priority ID Verification"
                className="object-contain max-h-[400px] w-full"
              />
            </div>

            <div className="mt-5 w-full flex justify-end">
              <button
                onClick={() => setSelectedImage(null)}
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors"
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