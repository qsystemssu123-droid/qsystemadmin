
import { useState } from 'react';
import {
  Megaphone,
  CheckCircle2,
  ShieldAlert,
  Clock,
  Building2,
  Power,
  Search,
  Loader2,
  CalendarClock
} from 'lucide-react';
import { useAnnouncementData } from '../hooks/useAnnouncementData';
import { COMMON_REASONS } from '../utils/announcementConstants';
import {
  AnnouncementLoading,
  AuthRequiredState,
  OfficeAssignmentRequiredState
} from '../components/announcement/AnnouncementStates';

const formatScheduleDate = (value) => {
  if (!value) return 'Not set';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'Invalid date';

  return date.toLocaleString('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

export default function Announcement() {
  const [searchQuery, setSearchQuery] = useState('');

  const {
    offices,
    officeReasons,
    currentUser,
    staffOffice,
    isAdmin,
    loading,
    accessLoading,
    actionLoading,
    successMessage,
    canControlOffice,
    handleReasonChange,
    handleScheduleChange,
    handleToggleBooking,
    handleSaveSchedule,
  } = useAnnouncementData();

  const filteredOfficeKeys = ['SWDS'].filter(
    (officeKey) =>
      officeKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
      offices[officeKey].reason.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading || accessLoading) {
    return <AnnouncementLoading />;
  }

  if (!currentUser) {
    return <AuthRequiredState />;
  }

  if (!isAdmin && !staffOffice) {
    return <OfficeAssignmentRequiredState />;
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6 [animation:fadeIn_2s_ease-in-out] font-sans">
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 w-full">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-100">
            <Megaphone className="w-6 h-6" />
          </div>

          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Office Status
            </h1>

            <p className="text-sm text-slate-500 mt-0.5">
              Manage live SWDS office availability, sync state directly with Firestore and control bookings in real time.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold shadow-2xs">
              Firestore Sync Active
            </span>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="bg-emerald-50 text-emerald-900 px-4 py-3.5 rounded-xl border border-emerald-200 text-sm flex items-center gap-3 shadow-xs w-full">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-medium">
            {successMessage}
          </span>
        </div>
      )}

      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold text-slate-700">
            {isAdmin
              ? 'Administrator Access'
              : 'Staff Office Access'}
          </p>

          <p className="text-xs text-slate-500 mt-0.5">
            {isAdmin
              ? 'You can manage SWDS office availability.'
              : `You can only manage the ${staffOffice} Office.`}
          </p>
        </div>

        <span className="shrink-0 inline-flex items-center px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700">
          SWDS ONLY
        </span>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-6 w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 w-full">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Department Control Hub
            </h2>

            <p className="text-xs text-slate-500">
              {isAdmin
                ? 'Toggle live booking status for the SWDS department.'
                : `Toggle live booking status for ${staffOffice} department only.`}
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </span>

              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search department..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all shadow-2xs"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 w-full">
          {filteredOfficeKeys.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl">
              No matching offices found for &quot;
              <span className="font-semibold text-slate-600">
                {searchQuery}
              </span>
              &quot;.
            </div>
          ) : (
            filteredOfficeKeys.map((officeKey) => {
              const office = offices[officeKey];
              const currentReasonValue = officeReasons[officeKey];
              const isThisLoading = actionLoading === officeKey;
              const hasControl = canControlOffice(officeKey);
              const isLockedForStaff = !isAdmin && !hasControl;

              return (
                <div
                  key={officeKey}
                  className={`bg-white border rounded-2xl p-6 shadow-xs transition-all duration-200 relative overflow-hidden w-full ${
                    isLockedForStaff
                      ? 'border-slate-200 bg-slate-100/80 opacity-55 grayscale-[0.35]'
                      : office.isBusy
                      ? 'border-rose-300 ring-4 ring-rose-50/50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div
                    className={`absolute top-0 left-0 w-1.5 h-full ${
                      isLockedForStaff
                        ? 'bg-slate-300'
                        : office.isBusy
                        ? 'bg-rose-500'
                        : 'bg-emerald-500'
                    }`}
                  />

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pl-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                          isLockedForStaff
                            ? 'bg-slate-200 text-slate-400 border-slate-300'
                            : office.isBusy
                            ? 'bg-rose-50 text-rose-600 border-rose-100'
                            : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                        }`}
                      >
                        <Building2 className="w-5 h-5" />
                      </div>

                      <div>
                        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                          {officeKey} Office

                          {isLockedForStaff && (
                            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-slate-200 text-slate-500 border border-slate-300">
                              Read Only
                            </span>
                          )}
                        </h3>

                        <p className="text-xs text-slate-400">
                          Firestore Doc ID:{' '}
                          <span className="font-mono text-slate-600">
                            {officeKey}
                          </span>
                        </p>

                        {isLockedForStaff && (
                          <p className="text-[11px] text-slate-500 mt-1 font-medium">
                            Only {officeKey} staff and the administrator can modify this office.
                          </p>
                        )}
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full tracking-wide w-fit ${
                        isLockedForStaff
                          ? 'bg-slate-200 text-slate-500 border border-slate-300'
                          : office.isBusy
                          ? 'bg-rose-100 text-rose-700 border border-rose-200'
                          : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isLockedForStaff
                            ? 'bg-slate-400'
                            : office.isBusy
                            ? 'bg-rose-500 animate-pulse'
                            : 'bg-emerald-500'
                        }`}
                      />

                      {isLockedForStaff
                        ? 'READ ONLY'
                        : office.isBusy
                        ? 'BOOKINGS DISABLED'
                        : 'ACTIVE / OPEN'}
                    </span>
                  </div>

                  {office.isBusy && (
                    <div
                      className={`${
                        isLockedForStaff
                          ? 'bg-slate-200/70 border-slate-300 text-slate-600'
                          : 'bg-rose-50/70 border-rose-200/80 text-rose-900'
                      } border rounded-xl p-3.5 text-xs mb-5 flex items-start gap-3 ml-2`}
                    >
                      <ShieldAlert
                        className={`w-4 h-4 shrink-0 mt-0.5 ${
                          isLockedForStaff
                            ? 'text-slate-500'
                            : 'text-rose-600'
                        }`}
                      />

                      <div>
                        <span
                          className={`font-bold ${
                            isLockedForStaff
                              ? 'text-slate-700'
                              : 'text-rose-950'
                          }`}
                        >
                          Active Notice Reason:{' '}
                        </span>

                        <span
                          className={
                            isLockedForStaff
                              ? 'text-slate-600'
                              : 'text-rose-800'
                          }
                        >
                          {office.reason || 'No reason provided'}
                        </span>
                      </div>
                    </div>
                  )}

                  <div
                    className={`border rounded-xl p-4 ml-2 flex flex-col gap-4 ${
                      isLockedForStaff
                        ? 'bg-slate-100 border-slate-200'
                        : 'bg-slate-50 border-slate-100'
                    }`}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          Select Preset Reason:
                        </label>

                        <div className="relative">
                          <select
                            disabled={isLockedForStaff}
                            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all shadow-2xs ${
                              isLockedForStaff
                                ? 'border-slate-200 bg-slate-200 text-slate-400 cursor-not-allowed'
                                : 'border-slate-200 bg-white text-slate-700 cursor-pointer'
                            }`}
                            value={currentReasonValue}
                            onChange={(e) =>
                              handleReasonChange(officeKey, e.target.value)
                            }
                          >
                            <option value="">
                              -- Choose a preset reason --
                            </option>

                            {COMMON_REASONS.map((reason, index) => (
                              <option key={index} value={reason}>
                                {reason}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          Or Type Custom Reason:
                        </label>

                        <input
                          type="text"
                          disabled={isLockedForStaff}
                          placeholder="e.g. Brief emergency maintenance..."
                          value={currentReasonValue}
                          onChange={(e) =>
                            handleReasonChange(officeKey, e.target.value)
                          }
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all shadow-2xs ${
                            isLockedForStaff
                              ? 'border-slate-200 bg-slate-200 text-slate-400 placeholder:text-slate-400 cursor-not-allowed'
                              : 'border-slate-200 bg-white text-slate-700'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="border-t border-slate-200 pt-4 space-y-4">
                      <div>
                        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                          <CalendarClock className="w-4 h-4 text-sky-600" />
                          Booking Unavailability Schedule
                        </h4>

                        <p className="text-xs text-slate-500 mt-1">
                          Enter when the office becomes unavailable and when students can book again.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-slate-700">
                            Unavailable From (Date & Time)
                          </label>

                          <input
                            type="datetime-local"
                            value={office.unavailableFrom}
                            disabled={isLockedForStaff}
                            onChange={(e) =>
                              handleScheduleChange(
                                officeKey,
                                'unavailableFrom',
                                e.target.value
                              )
                            }
                            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                              isLockedForStaff
                                ? 'border-slate-200 bg-slate-200 text-slate-400 cursor-not-allowed'
                                : 'border-slate-200 bg-white text-slate-700'
                            }`}
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-slate-700">
                            Booking Available Again (Date & Time)
                          </label>

                          <input
                            type="datetime-local"
                            value={office.resumeAt}
                            disabled={isLockedForStaff}
                            min={office.unavailableFrom || undefined}
                            onChange={(e) =>
                              handleScheduleChange(
                                officeKey,
                                'resumeAt',
                                e.target.value
                              )
                            }
                            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                              isLockedForStaff
                                ? 'border-slate-200 bg-slate-200 text-slate-400 cursor-not-allowed'
                                : 'border-slate-200 bg-white text-slate-700'
                            }`}
                          />
                        </div>
                      </div>

                      <div className="bg-white border border-sky-100 rounded-xl p-3 space-y-2">
                        <p className="text-xs font-bold text-slate-700">
                          Schedule Preview
                        </p>

                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                          <span className="text-slate-500">
                            Office unavailable:
                          </span>

                          <span className="font-semibold text-slate-800">
                            {formatScheduleDate(office.unavailableFrom)}
                          </span>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                          <span className="text-slate-500">
                            Booking resumes:
                          </span>

                          <span className="font-semibold text-emerald-700">
                            {formatScheduleDate(office.resumeAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
                      {office.isBusy && (
                        <button
                          disabled={isThisLoading || isLockedForStaff}
                          onClick={() => handleSaveSchedule(officeKey)}
                          className="inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl font-semibold text-xs transition-all border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isThisLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CalendarClock className="w-3.5 h-3.5" />
                          )}

                          Update Schedule
                        </button>
                      )}

                      <button
                        disabled={isThisLoading || isLockedForStaff}
                        title={
                          isLockedForStaff
                            ? `You cannot modify ${officeKey}. You can only manage ${staffOffice}.`
                            : office.isBusy
                            ? `Enable bookings for ${officeKey}`
                            : `Disable bookings for ${officeKey}`
                        }
                        className={`inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl font-semibold text-xs transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed ${
                          isLockedForStaff
                            ? 'bg-slate-400 text-white cursor-not-allowed'
                            : office.isBusy
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 cursor-pointer'
                            : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20 cursor-pointer'
                        }`}
                        onClick={() => handleToggleBooking(officeKey)}
                      >
                        {isThisLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Power className="w-3.5 h-3.5" />
                        )}

                        {isLockedForStaff
                          ? `Manage ${officeKey} Disabled`
                          : office.isBusy
                          ? `Enable Bookings for ${officeKey}`
                          : `Disable Bookings for ${officeKey}`}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
