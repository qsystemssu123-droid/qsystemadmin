export default function DashboardLoading() {
  return (
    <div className="flex h-96 items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-slate-500 animate-pulse">Loading SSU Queue Analytics...</p>
      </div>
    </div>
  );
}