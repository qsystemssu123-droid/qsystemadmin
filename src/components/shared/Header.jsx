import { Menu } from 'lucide-react';

export default function Header({
  sidebarOpen,
  setSidebarOpen,
  setActiveTab,
  adminName,
  adminUser,
  adminPhoto,
  adminInitials
}) {
  return (
    <header className="h-16 bg-blue-100 backdrop-blur-md border-b border-sky-200/60 flex items-center justify-between px-4 sm:px-6 z-10 shadow-2xs shrink-0">
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="p-2 rounded-xl hover:bg-sky-200/50 text-slate-700 cursor-pointer transition-colors"
        aria-label="Toggle Navigation"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div
        onClick={() => {
          setActiveTab('profile');

          if (window.innerWidth < 768) {
            setSidebarOpen(false);
          }
        }}
        className="flex items-center gap-3 cursor-pointer group p-1.5 rounded-2xl hover:bg-sky-200/50 transition-all duration-200"
        title="Go to Profile"
      >
        <div className="text-right hidden sm:block">
          <p className="text-sm font-semibold text-slate-900 group-hover:text-sky-800 transition-colors">
            {adminName}
          </p>

          <p className="text-xs text-slate-500">
            {adminUser?.role === 'staff'
              ? `Staff (${adminUser?.office})`
              : 'Administrator'}
          </p>
        </div>

        {adminPhoto ? (
          <img
            src={adminPhoto}
            alt="Admin Avatar"
            className="h-9 w-9 sm:h-10 sm:w-10 rounded-full object-cover border border-sky-300 shadow-2xs group-hover:ring-2 group-hover:ring-sky-400 group-hover:scale-105 transition-all duration-200"
          />
        ) : (
          <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-sky-200 text-sky-800 flex items-center justify-center font-bold border border-sky-300 shadow-2xs group-hover:ring-2 group-hover:ring-sky-400 group-hover:scale-105 transition-all duration-200 text-xs sm:text-sm">
            {adminInitials}
          </div>
        )}
      </div>
    </header>
  );
}