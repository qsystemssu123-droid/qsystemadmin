
import { useEffect, useState } from 'react';
import { X, LogOut, } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../services/firebase.js';

const ADMIN_EMAIL = 'qsystemssu123@gmail.com';

export default function Sidebar({
  sidebarOpen,
  setSidebarOpen,
  navItems = [],
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

  const handleNavigation = (itemId) => {
    if (typeof handleNavClick === 'function') {
      handleNavClick(itemId);
    }

    // Automatically close the sidebar on mobile after navigation.
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const handleLogout = () => {
    if (typeof setShowLogoutModal === 'function') {
      setShowLogoutModal(true);
    }

    // Close mobile sidebar when opening the logout modal.
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes sidebarFadeIn {
          from {
            opacity: 0;
            transform: translateX(-12px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes sidebarItemIn {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .sidebar-fade-in {
          animation: sidebarFadeIn 0.3s ease-out both;
        }

        .sidebar-item-in {
          animation: sidebarItemIn 0.35s ease-out both;
        }

        .sidebar-nav-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(100, 116, 139, 0.25) transparent;
        }

        .sidebar-nav-scroll::-webkit-scrollbar {
          width: 5px;
        }

        .sidebar-nav-scroll::-webkit-scrollbar-track {
          background: transparent;
        }

        .sidebar-nav-scroll::-webkit-scrollbar-thumb {
          background: rgba(100, 116, 139, 0.25);
          border-radius: 20px;
        }

        .sidebar-nav-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(100, 116, 139, 0.45);
        }

        @media (prefers-reduced-motion: reduce) {
          .sidebar-fade-in,
          .sidebar-item-in {
            animation: none !important;
          }
        }
      `}</style>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-[2px] md:hidden transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar */}
      <aside
        aria-label="Main navigation"
        className={`
          fixed inset-y-0 left-0 z-40
          md:static md:z-20
          flex flex-col
          h-screen
          bg-white
          border-r border-slate-200
          shadow-xl md:shadow-sm
          overflow-hidden
          transition-all duration-300 ease-in-out
          ${
            sidebarOpen
              ? 'translate-x-0 w-64'
              : '-translate-x-full w-64 md:translate-x-0 md:w-20'
          }
        `}
      >
        {/* Sidebar Header */}
        <div className="relative flex h-16 shrink-0 items-center justify-between px-4 border-b border-slate-200 bg-white">

          {/* Brand */}
          <div className="relative flex min-w-0 flex-1 items-center">

            {/* Expanded Sidebar Title */}
            <div
              className={`
                flex items-center gap-3
                whitespace-nowrap
                transition-all duration-300
                ${
                  sidebarOpen
                    ? 'opacity-100 translate-x-0'
                    : 'opacity-0 -translate-x-3 pointer-events-none absolute'
                }
              `}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm shadow-sky-200">
                <span className="text-sm font-extrabold tracking-tight">
                  QM
                </span>
              </div>

              <div className="flex min-w-0 flex-col">
                <span className="truncate text-base font-extrabold tracking-tight text-slate-900">
                  QueueMatrix
                </span>

                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-600">
                  {userRole} Portal
                </span>
              </div>
            </div>

            {/* Collapsed Sidebar Title */}
            <div
              className={`
                absolute left-0 flex items-center justify-center
                transition-all duration-300
                ${
                  !sidebarOpen
                    ? 'opacity-100 translate-x-0'
                    : 'opacity-0 translate-x-3 pointer-events-none'
                }
              `}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm shadow-sky-200">
                <span className="text-sm font-extrabold tracking-tight">
                  QM
                </span>
              </div>
            </div>
          </div>

          {/* Mobile Close Button */}
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
            className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-all duration-200 hover:bg-slate-100 hover:text-slate-900 active:scale-95 md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sidebar Information */}
        <div
          className={`
            shrink-0 px-4 pt-5 pb-2
            transition-all duration-300
            ${sidebarOpen ? 'opacity-100' : 'opacity-0 md:opacity-100'}
          `}
        >
          <span
            className={`
              block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400
              transition-all duration-300
              ${sidebarOpen ? 'opacity-100' : 'md:opacity-0'}
            `}
          >
            Navigation
          </span>
        </div>

        {/* Navigation Menu */}
        <nav
          className="sidebar-nav-scroll flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3 py-2"
          aria-label="Sidebar navigation"
        >
          {navItems.map((item, index) => {
            const IconComponent = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id ?? index}
                type="button"
                onClick={() => handleNavigation(item.id)}
                title={!sidebarOpen ? item.label : undefined}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={`
                  sidebar-item-in group relative
                  flex w-full items-center gap-3
                  rounded-xl px-3 py-3
                  text-left text-sm font-medium
                  transition-all duration-200 ease-out
                  active:scale-[0.98]
                  ${
                    isActive
                      ? 'bg-sky-50 text-sky-700 shadow-sm'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  }
                  ${sidebarOpen ? 'justify-start' : 'md:justify-center'}
                `}
                style={{
                  animationDelay: `${Math.min(index * 45, 350)}ms`
                }}
              >
                {/* Active Indicator */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-sky-600" />
                )}

                {/* Navigation Icon */}
                {IconComponent ? (
                  <IconComponent
                    className={`
                      h-5 w-5 shrink-0
                      transition-all duration-200
                      group-hover:scale-110
                      ${
                        isActive
                          ? 'text-sky-600'
                          : 'text-slate-400 group-hover:text-slate-700'
                      }
                    `}
                  />
                ) : (
                  <span className="h-5 w-5 shrink-0" />
                )}

                {/* Navigation Label */}
                <span
                  className={`
                    min-w-0 flex-1 truncate
                    transition-all duration-300
                    ${
                      sidebarOpen
                        ? 'opacity-100 translate-x-0'
                        : 'w-0 overflow-hidden opacity-0 translate-x-2 md:absolute md:pointer-events-none'
                    }
                    ${isActive ? 'font-semibold' : ''}
                  `}
                >
                  {item.label}
                </span>

                {/* Active Indicator Dot */}
                {isActive && sidebarOpen && (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-600" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="shrink-0 border-t border-slate-200 bg-slate-50/70 p-3">

          {/* Account Role */}
          <div
            className={`
              mb-2 flex items-center gap-3 rounded-xl px-3 py-2
              transition-all duration-300
              ${sidebarOpen ? 'opacity-100' : 'justify-center opacity-100 md:px-0'}
            `}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700">
              {userRole.charAt(0)}
            </div>

            <div
              className={`
                min-w-0 flex-1 transition-all duration-300
                ${
                  sidebarOpen
                    ? 'opacity-100'
                    : 'w-0 overflow-hidden opacity-0 md:absolute md:pointer-events-none'
                }
              `}
            >
              <p className="truncate text-xs font-semibold text-slate-700">
                {sidebarTitle}
              </p>
              <p className="text-[10px] text-slate-400">
                Signed in
              </p>
            </div>
          </div>

          {/* Logout Button */}
          <button
            type="button"
            onClick={handleLogout}
            title={!sidebarOpen ? 'Logout' : undefined}
            aria-label="Logout"
            className={`
              group flex w-full items-center gap-3
              rounded-xl px-3 py-3
              text-sm font-semibold text-rose-600
              transition-all duration-200 ease-in-out
              hover:bg-rose-50 hover:text-rose-700
              active:scale-[0.98]
              ${sidebarOpen ? 'justify-start' : 'justify-center'}
            `}
          >
            <LogOut className="h-5 w-5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />

            <span
              className={`
                whitespace-nowrap transition-all duration-300
                ${
                  sidebarOpen
                    ? 'opacity-100 translate-x-0'
                    : 'w-0 overflow-hidden opacity-0 translate-x-2'
                }
              `}
            >
              Logout
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}
