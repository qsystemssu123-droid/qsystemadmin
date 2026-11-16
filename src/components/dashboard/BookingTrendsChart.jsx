import { LineChart as LineChartIcon } from 'lucide-react';

export default function BookingTrendsChart({
  chartTimeframe,
  setChartTimeframe,
  lineChartPoints,
  totalInTimeframe
}) {
  const maxChartVal = Math.max(...lineChartPoints.map(p => p.count), 1);
  const svgWidth = 600;
  const svgHeight = 200;
  const padLeft = 35;
  const padRight = 35;
  const padTop = 25;
  const padBottom = 35;
  const chartW = svgWidth - padLeft - padRight;
  const chartH = svgHeight - padTop - padBottom;

  const chartCoords = lineChartPoints.map((pt, i) => {
    const x = padLeft + (i / Math.max(lineChartPoints.length - 1, 1)) * chartW;
    const y = padTop + chartH - (pt.count / maxChartVal) * chartH;
    return { x, y, ...pt };
  });

  const linePathD = chartCoords.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  const areaPathD = chartCoords.length > 0
    ? `${linePathD} L ${chartCoords[chartCoords.length - 1].x} ${padTop + chartH} L ${chartCoords[0].x} ${padTop + chartH} Z`
    : '';

  return (
    <div className="animate-slide-right-3 bg-white p-6 rounded-2xl shadow-xs border border-sky-100 transition-all duration-300 hover:shadow-md">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <LineChartIcon className="w-5 h-5 text-sky-600" />
            Booking Trends Analytics
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Total bookings recorded for {chartTimeframe === 'WEEK' ? 'this week' : chartTimeframe === 'MONTH' ? 'this month' : 'this year'}: <span className="font-bold text-sky-700">{totalInTimeframe}</span>
          </p>
        </div>

        {/* Timeframe Selector Tabs */}
        <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
          {['WEEK', 'MONTH', 'YEAR'].map((tf) => (
            <button
              key={tf}
              onClick={() => setChartTimeframe(tf)}
              className={`px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
                chartTimeframe === tf
                  ? 'bg-white text-sky-700 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              This {tf.charAt(0) + tf.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="w-full overflow-x-auto">
        <div className="min-w-[500px]">
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto overflow-visible">
            <defs>
              <linearGradient id="skyAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0284c7" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid Lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
              const y = padTop + chartH * ratio;
              const val = Math.round(maxChartVal * (1 - ratio));
              return (
                <g key={idx}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={svgWidth - padRight}
                    y2={y}
                    stroke="#e2e8f0"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                  <text
                    x={padLeft - 8}
                    y={y + 3}
                    fontSize="10"
                    fill="#94a3b8"
                    textAnchor="end"
                    className="font-medium"
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            {/* Gradient Area */}
            {areaPathD && (
              <path
                d={areaPathD}
                fill="url(#skyAreaGradient)"
                className="transition-all duration-500 ease-out"
              />
            )}

            {/* Line Path */}
            {linePathD && (
              <path
                d={linePathD}
                fill="none"
                stroke="#0284c7"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-all duration-500 ease-out"
              />
            )}

            {/* Nodes */}
            {chartCoords.map((pt, idx) => (
              <g key={idx} className="group/node cursor-pointer">
                <line
                  x1={pt.x}
                  y1={padTop}
                  x2={pt.x}
                  y2={padTop + chartH}
                  stroke="#bae6fd"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                  className="opacity-0 group-hover/node:opacity-100 transition-opacity"
                />
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="6"
                  className="fill-sky-100 stroke-sky-600 stroke-2 transition-all duration-300 group-hover/node:r-8"
                />
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="3"
                  className="fill-sky-600 transition-all duration-300 group-hover/node:fill-sky-800"
                />
                <text
                  x={pt.x}
                  y={pt.y - 10}
                  fontSize="10"
                  fontWeight="bold"
                  fill="#0369a1"
                  textAnchor="middle"
                  className="transition-all duration-200 opacity-80 group-hover/node:opacity-100"
                >
                  {pt.count}
                </text>
                <text
                  x={pt.x}
                  y={padTop + chartH + 16}
                  fontSize="11"
                  fontWeight="600"
                  fill="#475569"
                  textAnchor="middle"
                >
                  {pt.label}
                </text>
                {pt.subLabel && (
                  <text
                    x={pt.x}
                    y={padTop + chartH + 28}
                    fontSize="9"
                    fill="#94a3b8"
                    textAnchor="middle"
                  >
                    {pt.subLabel}
                  </text>
                )}
              </g>
            ))}
          </svg>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-sky-100 flex items-center justify-between text-xs text-slate-500">
        <span>Filter view: <strong className="text-slate-700 capitalize">{chartTimeframe.toLowerCase()}</strong> breakdown</span>
        <span className="text-sky-700 font-semibold animate-pulse">Live Realtime Sync</span>
      </div>
    </div>
  );
}