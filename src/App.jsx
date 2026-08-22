import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from './services/firebase.js';
import { doc, getDoc } from 'firebase/firestore';

import {
  LayoutDashboard,
  Ticket,
  CalendarCheck,
  Building2,
  Users,
  User,
  LogOut,
  Menu,
  AlertCircle,
  X,
  MessageSquareText,
  Star,
  ShieldUser
} from 'lucide-react';

import Dashboard from './pages/dashboard';
import QueueControl from './pages/queue.jsx';
import Appointments from './pages/appointments';
import Offices from './pages/offices';
import MobileUsers from './pages/users';
import Staff from './pages/staff';
import Profile from './pages/profile.jsx';
import Feedback from './pages/feedback';
import Ratings from './pages/ratings';
import Login from './pages/login';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [adminUser, setAdminUser] = useState(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Auto-close sidebar on small screens on initial load
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };

    handleResize();

    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /*
   * Firebase Authentication Session Listener
   *
   * IMPORTANT:
   * Do not manually sign out the user here just because Firestore
   * temporarily fails. Firebase Auth persists the authenticated
   * session across page refreshes.
   */
  useEffect(() => {
    let mounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!mounted) return;

      // No Firebase user means the session is genuinely logged out.
      if (!user) {
        setIsAuthenticated(false);
        setAdminUser(null);
        setLoadingAuth(false);
        return;
      }

      try {
        // ADMIN
        if (user.email === 'qsystemssu123@gmail.com') {
          if (!mounted) return;

          setIsAuthenticated(true);
          setAdminUser({
            ...user,
            role: 'admin'
          });
          setLoadingAuth(false);

          return;
        }

        // STAFF
        const staffDocRef = doc(db, 'staff', user.uid);
        const staffDoc = await getDoc(staffDocRef);

        if (!mounted) return;

        if (staffDoc.exists()) {
          const staffData = staffDoc.data();

          setIsAuthenticated(true);

          setAdminUser({
            ...user,
            ...staffData,
            role: 'staff'
          });

          setLoadingAuth(false);

          return;
        }

        /*
         * The Firebase account exists, but there is no staff
         * document. This user is not authorized to access the portal.
         */
        console.warn(
          'Authenticated Firebase user has no staff record:',
          user.uid
        );

        await signOut(auth);

        if (!mounted) return;

        setIsAuthenticated(false);
        setAdminUser(null);
        setLoadingAuth(false);
      } catch (err) {
        console.error('Auth verification error:', err);

        /*
         * IMPORTANT:
         *
         * Do NOT immediately sign the user out when Firestore
         * verification encounters an error.
         *
         * Firebase Auth may still have a perfectly valid session.
         * A Firestore/network/rules problem should not destroy
         * that authentication session.
         *
         * Keep the authenticated Firebase user available.
         */
        if (!mounted) return;

        setIsAuthenticated(true);

        setAdminUser({
          ...user,
          role: 'staff'
        });

        setLoadingAuth(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  if (loadingAuth) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-sky-950 text-white">
        <p className="text-sm font-medium animate-pulse">
          Loading...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Login
        onLogin={(user) => {
          setIsAuthenticated(true);
          setAdminUser(user);
        }}
      />
    );
  }

  const renderPage = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;

      case 'queue':
        return <QueueControl />;

      case 'appointments':
        return <Appointments />;

      case 'offices':
        return <Offices />;

      case 'users':
        return <MobileUsers />;

      case 'staff':
        return <Staff />;

      case 'feedback':
        return <Feedback />;

      case 'ratings':
        return <Ratings />;

      case 'profile':
        return <Profile />;

      default:
        return <Dashboard />;
    }
  };

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard
    },
    {
      id: 'queue',
      label: 'Queue Control',
      icon: Ticket
    },
    {
      id: 'appointments',
      label: 'Appointments',
      icon: CalendarCheck
    },
    {
      id: 'offices',
      label: 'Offices',
      icon: Building2
    },
    {
      id: 'users',
      label: 'Users',
      icon: Users
    },
    {
      id: 'staff',
      label: 'Staff Management',
      icon: ShieldUser
    },
    {
      id: 'feedback',
      label: 'Feedback',
      icon: MessageSquareText
    },
    {
      id: 'ratings',
      label: 'Ratings',
      icon: Star
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: User
    }
  ].filter((item) => {
    if (adminUser?.role === 'staff') {
      return ['dashboard', 'queue', 'appointments', 'profile'].includes(item.id);
    }
    return true;
  });

  const adminName =
    adminUser?.displayName ||
    adminUser?.name ||
    'Koby R. Sacendoncillo';

  const adminPhoto = adminUser?.photoURL;

  const adminInitials = adminName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const handleNavClick = (id) => {
    setActiveTab(id);

    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

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
      `}</style>

      <div className="flex h-screen bg-sky-50 text-slate-800 font-sans overflow-hidden relative">

        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-30 md:hidden transition-opacity duration-300"
          />
        )}

        <aside
          className={`fixed inset-y-0 left-0 z-40 md:static md:z-20 bg-blue-100 border-r border-slate-200/60 transition-all duration-300 ease-in-out flex flex-col shadow-lg md:shadow-xs overflow-hidden ${
            sidebarOpen
              ? 'translate-x-0 w-64'
              : '-translate-x-full md:translate-x-0 md:w-20'
          }`}
        >

          <div className="h-16 flex items-center justify-between px-4 bg-blue-100 text-sky-700 font-bold text-lg tracking-wide border-b border-sky-200/60 whitespace-nowrap overflow-hidden relative shrink-0">

            <span
              className={`transition-all duration-300 ease-out transform ${
                sidebarOpen
                  ? 'opacity-100 translate-x-0'
                  : 'opacity-0 -translate-x-4 pointer-events-none absolute'
              }`}
            >
              QueueMatrix Admin
            </span>

            <span
              className={`transition-all duration-300 ease-out transform ${
                !sidebarOpen
                  ? 'opacity-100 translate-x-0'
                  : 'opacity-0 translate-x-4 pointer-events-none absolute'
              }`}
            >
              Admin
            </span>

            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 rounded-lg hover:bg-sky-200/50 text-slate-600 md:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto overflow-x-hidden">

            {navItems.map((item, index) => {
              const IconComponent = item.icon;
              const animClass = `animate-slide-left-${index + 2}`;

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

          <div
            className={`animate-slide-left-10 p-3 border-t border-sky-200/60 transition-all duration-500 ease-out transform shrink-0 ${
              sidebarOpen
                ? 'translate-y-0 opacity-100'
                : 'translate-y-2 opacity-90'
            }`}
          >
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

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden w-full">

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

          <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-sky-50/60">
            {renderPage()}
          </main>
        </div>

        {showLogoutModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">

            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 flex flex-col items-center text-center">

              <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-4 border border-rose-100">
                <AlertCircle className="w-6 h-6" />
              </div>

              <h3 className="text-lg font-bold text-slate-900 mb-1">
                Log Out
              </h3>

              <p className="text-sm text-slate-500 mb-6">
                Are you sure you want to log out?
              </p>

              <div className="flex items-center gap-3 w-full">

                <button
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-slate-200 hover:bg-slate-300 transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  onClick={async () => {
                    setShowLogoutModal(false);

                    try {
                      await signOut(auth);
                    } catch (error) {
                      console.error('Logout error:', error);
                    }
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-xs cursor-pointer"
                >
                  Yes, Log Out
                </button>

              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}