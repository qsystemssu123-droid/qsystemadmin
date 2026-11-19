
import { useEffect, useState } from 'react';
import { X, LogOut } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../services/firebase.js';

const ADMIN_EMAIL = 'qsystemssu123@gmail.com';

export default function Sidebar({
  sidebarOpen,
  setSidebarOpen,
  navItems,
  activeTab,
  handleNavClick,
  setShowLogoutModal
}) {
  const [currentUser, setCurrentUser] = useState(
    () => auth.currentUser
  );

  // Listen for Firebase authentication changes.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setCurrentUser(user);
      },
      (error) => {
        console.error(
          'Sidebar authentication error:',
          error
        );
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // Determine the sidebar title based on the logged-in account.
  const isAdmin =
    currentUser?.email?.trim().toLowerCase() ===
    ADMIN_EMAIL.toLowerCase();

  const userRole = isAdmin ? 'Admin' : 'Staff';

  const sidebarTitle = `QueueMatrix ${userRole}`;

  return (
    <>
      <style>{`
        @keyframes slideInLeftToRight {
          0% {
            opacity: 0;
            transform: translateX(-80px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .animate-slide-left-1 {
          animation: slideInLeftToRight 3s cubic-bezier(0.16, 1, 0.3, 1) 0.05s both;
        }

        .animate-slide-left-2 {
          animation: slideInLeftToRight 3s cubic-bezier(0.16, 1, 0.3, 1) 0.12s both;
        }

        .animate-slide-left-3 {
          animation: slideInLeftToRight 3s cubic-bezier(0.16, 1, 0.3, 1) 0.19s both;
        }

        .animate-slide-left-4 {
          animation: slideInLeftToRight 3s cubic-bezier(0.16, 1, 0.3, 1) 0.26s both;
        }

        .animate-slide-left-5 {
          animation: slideInLeftToRight 3s cubic-bezier(0.16, 1, 0.3, 1) 0.33s both;
        }

        .animate-slide-left-6 {
          animation: slideInLeftToRight 3s cubic-bezier(0.16, 1, 0.3, 1) 0.40s both;
        }

        .animate-slide-left-7 {
          animation: slideInLeftToRight 3s cubic-bezier(0.16, 1, 0.3, 1) 0.47s both;
        }

        .animate-slide-left-8 {
          animation: slideInLeftToRight 3s cubic-bezier(0.16, 1, 0.3, 1) 0.54s both;
        }

        .animate-slide-left-9 {
          animation: slideInLeftToRight 3s cubic-bezier(0.16, 1, 0.3, 1) 0.61s both;
        }

        .animate-slide-left-10 {
          animation: slideInLeftToRight 3s cubic-bezier(0.16, 1, 0.3, 1) 0.68s both;
        }

        .animate-slide-left-11 {
          animation: slideInLeftToRight 3s cubic-bezier(0.16, 1, 0.3, 1) 0.75s both;
        }
      `}</style>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-30 md:hidden transition-opacity duration-300"
        />
      )}

      {/* Main Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 md:static md:z-20 bg-blue-100 border-r border-slate-200/60 transition-all duration-300 ease-in-out flex flex-col shadow-lg md:shadow-xs overflow-hidden ${
          sidebarOpen
            ? 'translate-x-0 w-64'
            : '-translate-x-full md:translate-x-0 md:w-20'
        }`}
      >
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-4 bg-blue-100 text-sky-700 font-bold text-lg tracking-wide border-b border-sky-200/60 whitespace-nowrap overflow-hidden relative shrink-0">

          {/* Expanded Sidebar Title */}
          <span
            className={`transition-all duration-300 ease-out transform ${
              sidebarOpen
                ? 'opacity-100 translate-x-0'
                : 'opacity-0 -translate-x-4 pointer-events-none absolute'
            }`}
          >
            {sidebarTitle}
          </span>

          {/* Collapsed Sidebar Title */}
          <span
            className={`transition-all duration-300 ease-out transform ${
              !sidebarOpen
                ? 'opacity-100 translate-x-0'
                : 'opacity-0 translate-x-4 pointer-events-none absolute'
            }`}
          >
            {userRole}
          </span>

          {/* Mobile Close Button */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 rounded-lg hover:bg-sky-200/50 text-slate-600 md:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto overflow-x-hidden">
          {navItems.map((item, index) => {
            const IconComponent = item.icon;

            // Ensures profile dynamically resolves safely
            // to .animate-slide-left-11
            const animClass = `animate-slide-left-${Math.min(
              index + 2,
              11
            )}`;

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`${animClass} w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-all duration-300 ease-out transform ${
                  sidebarOpen
                    ? 'translate-x-0 opacity-100'
                    : '-translate-x-2 opacity-90'
                } ${
                  activeTab === item.id
                    ? 'bg-sky-200/70 text-sky-900 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:bg-sky-50 hover:text-sky-900'
                }`}
              >
                <IconComponent className="w-5 h-5 shrink-0 transition-transform duration-200 group-hover:scale-110" />

                <span
                  className={`whitespace-nowrap transition-opacity duration-300 ${
                    sidebarOpen
                      ? 'opacity-100'
                      : 'opacity-0 w-0 overflow-hidden'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Logout Section */}
        <div className="animate-slide-left-11 p-3 border-t border-sky-200/60 transition-all duration-500 ease-out transform shrink-0">
          <button
            onClick={() => setShowLogoutModal(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-rose-600 hover:bg-rose-50 cursor-pointer transition-all duration-200 ease-in-out transform hover:translate-x-1 overflow-hidden"
          >
            <LogOut className="w-5 h-5 shrink-0" />

            <span
              className={`whitespace-nowrap transition-opacity duration-300 ${
                sidebarOpen
                  ? 'opacity-100'
                  : 'opacity-0 w-0 overflow-hidden'
              }`}
            >
              Logout
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}
