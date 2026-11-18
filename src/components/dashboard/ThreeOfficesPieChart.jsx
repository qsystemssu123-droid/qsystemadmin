
import { PieChart } from 'lucide-react';

export default function ThreeOfficesPieChart({
  swdsCount = 0,
  CIRCUMFERENCE
}) {
  // SWDS is now the only office displayed.
  // The original component name is preserved for compatibility.

  const totalSWDSBookings = Number(swdsCount) || 0;

  const swdsSharePercent = totalSWDSBookings > 0 ? 100 : 0;

  const circleCircumference =
    Number(CIRCUMFERENCE) > 0
      ? Number(CIRCUMFERENCE)
      : 2 * Math.PI * 40;

  const swdsCircleDash =
    totalSWDSBookings > 0 ? circleCircumference : 0;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-xs border border-sky-100 flex flex-col justify-between transition-all duration-300 hover:shadow-md">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-sky-600" />
              SWDS Booking Overview
            </h2>

            <p className="text-xs text-slate-500 mt-0.5">
              Total bookings for the SWDS Office
            </p>
          </div>

          <span className="text-xs font-semibold px-2.5 py-1 bg-sky-50 text-sky-700 rounded-lg border border-sky-100">
            {totalSWDSBookings} Total
          </span>
        </div>

        {/* Pie / Donut SVG Graphic */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 my-4">
          <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
            <svg
              viewBox="0 0 100 100"
              className="w-full h-full transform -rotate-90"
              role="img"
              aria-label={`SWDS bookings: ${totalSWDSBookings}`}
            >
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke="#f1f5f9"
                strokeWidth="12"
              />

              {/* SWDS circle only */}
              {totalSWDSBookings > 0 && (
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#8b5cf6"
                  strokeWidth="12"
                  strokeDasharray={`${swdsCircleDash} ${circleCircumference}`}
                  strokeDashoffset={0}
                  className="transition-all duration-700 ease-out"
                />
              )}
            </svg>

            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-xs font-medium text-slate-400">
                SWDS
              </span>

              <span className="text-lg font-extrabold text-slate-800">
                {totalSWDSBookings}
              </span>

              <span className="text-[11px] font-medium text-slate-400">
                Bookings
              </span>
            </div>
          </div>

          {/* SWDS Color Legend */}
          <div className="space-y-2.5 text-xs w-full sm:w-auto">
            <div className="flex items-center justify-between sm:justify-start gap-3 bg-slate-50 p-2 rounded-lg border border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-purple-500"></span>

                <span className="font-semibold text-slate-700">
                  SWDS
                </span>
              </div>

              <span className="font-bold text-slate-900">
                {totalSWDSBookings} ({swdsSharePercent}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-sky-100 flex items-center justify-between text-xs text-slate-500">
        <span>SWDS Department Bookings</span>

        <span className="font-semibold text-sky-700">
          SWDS Only
        </span>
      </div>
    </div>
  );
}
