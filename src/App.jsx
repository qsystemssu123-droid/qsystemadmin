import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './services/firebase.js';
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
  MessageSquareText
} from 'lucide-react';
import Dashboard from './pages/dashboard';
import QueueControl from './pages/queue.jsx';
import Appointments from './pages/appointments';
import Offices from './pages/offices';
import MobileUsers from './pages/users';
import Profile from './pages/profile.jsx';
import Feedback from './pages/feedback'; // Added Feedback page import
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.email === 'qsystemssu123@gmail.com') {
        setIsAuthenticated(true);
        setAdminUser(user);
      } else {
        setIsAuthenticated(false);
        setAdminUser(null);
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  if (loadingAuth) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-sky-950 text-white">
        <p className="text-sm font-medium animate-pulse">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />;
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
      case 'feedback':
        return <Feedback />; // Added Feedback case
      case 'profile':
        return <Profile />;
      default:
        return <Dashboard />;
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'queue', label: 'Queue Control', icon: Ticket },
    { id: 'appointments', label: 'Appointments', icon: CalendarCheck },
    { id: 'offices', label: 'Offices', icon: Building2 },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'feedback', label: 'Feedback', icon: MessageSquareText }, // Added Feedback nav item
    { id: 'profile', label: 'Profile', icon: User },
  ];

  const adminName = adminUser?.displayName || 'Koby R. Sacendoncillo';
  const adminPhoto = adminUser?.photoURL;
  const adminInitials = adminName
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const handleNavClick = (id) => {
    setActiveTab(id);
    // Automatically close sidebar on mobile devices after clicking a nav item
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  return (
    <>
      {/* Custom Keyframes for Smooth Left-to-Right Sidebar Sliding (3 Seconds Slow) */}
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
      `}</style>

      <div className="flex h-screen bg-sky-50 text-slate-800 font-sans overflow-hidden relative">
        {/* Mobile Backdrop Overlay */}
        {sidebarOpen && (
          <div 
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-30 md:hidden transition-opacity duration-300"
          />
        )}

        {/* Light Blue Tint Sidebar with Mobile Off-Canvas & Responsive Widths */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 md:static md:z-20 bg-blue-100 border-r border-slate-200/60 transition-all duration-300 ease-in-out flex flex-col shadow-lg md:shadow-xs overflow-hidden ${
            sidebarOpen 
              ? 'translate-x-0 w-64' 
              : '-translate-x-full md:translate-x-0 md:w-20'
          }`}
        >
          {/* Top Header / Logo */}
          <div className="h-16 flex items-center justify-between px-4 bg-blue-100 text-sky-700 font-bold text-lg tracking-wide border-b border-sky-200/60 whitespace-nowrap overflow-hidden relative shrink-0">
            {/* Full Title (Visible when Open) */}
            <span
              className={`transition-all duration-300 ease-out transform ${
                sidebarOpen
                  ? 'opacity-100 translate-x-0'
                  : 'opacity-0 -translate-x-4 pointer-events-none absolute'
              }`}
            >
              QueueMatrix Admin
            </span>

            {/* Short Title (Visible when Collapsed on Desktop) */}
            <span
              className={`transition-all duration-300 ease-out transform ${
                !sidebarOpen
                  ? 'opacity-100 translate-x-0'
                  : 'opacity-0 translate-x-4 pointer-events-none absolute'
              }`}
            >
              Admin
            </span>

            {/* Close Button for Mobile Drawer */}
            <button 
              onClick={() => setSidebarOpen(false)}
              className="p-1 rounded-lg hover:bg-sky-200/50 text-slate-600 md:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Items - Staggered Left-to-Right Animation */}
          <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto overflow-x-hidden">
            {navItems.map((item, index) => {
              const IconComponent = item.icon;
              const animClass = `animate-slide-left-${index + 2}`;

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`${animClass} w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-all duration-300 ease-out transform ${
                    sidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-90'
                  } ${
                    activeTab === item.id
                      ? 'bg-sky-200/70 text-sky-900 font-semibold shadow-2xs'
                      : 'text-slate-600 hover:bg-sky-50 hover:text-sky-900'
                  }`}
                >
                  <IconComponent className="w-5 h-5 shrink-0 transition-transform duration-200 group-hover:scale-110" />
                  <span className={`whitespace-nowrap transition-opacity duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Footer Logout Button */}
          <div 
            className={`animate-slide-left-8 p-3 border-t border-sky-200/60 transition-all duration-500 ease-out transform shrink-0 ${
              sidebarOpen ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-90'
            }`}
          >
            <button
              onClick={() => setShowLogoutModal(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-rose-600 hover:bg-rose-50 cursor-pointer transition-all duration-200 ease-in-out transform hover:translate-x-1 overflow-hidden"
            >
              <LogOut className="w-5 h-5 shrink-0" />
              <span className={`whitespace-nowrap transition-opacity duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
                Logout
              </span>
            </button>
          </div>
        </aside>

        {/* Main Layout Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden w-full">
          {/* Header */}
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
                if (window.innerWidth < 768) setSidebarOpen(false);
              }}
              className="flex items-center gap-3 cursor-pointer group p-1.5 rounded-2xl hover:bg-sky-200/50 transition-all duration-200"
              title="Go to Profile"
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-900 group-hover:text-sky-800 transition-colors">{adminName}</p>
                <p className="text-xs text-slate-500">Administrator</p>
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

          {/* Content Body */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-sky-50/60">
            {renderPage()}
          </main>
        </div>

        {/* Custom Logout Confirmation Modal */}
        {showLogoutModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-4 border border-rose-100">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">Log Out</h3>
              <p className="text-sm text-slate-500 mb-6">Are you sure you want to log out?</p>
              
              <div className="flex items-center gap-3 w-full">
                <button
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-slate-200 hover:bg-slate-300 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowLogoutModal(false);
                    signOut(auth);
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