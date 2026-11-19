
import Dashboard from './pages/dashboard';
import QueueControl from './pages/queue.jsx';
import Appointments from './pages/appointments';
import Offices from './pages/offices';
import MobileUsers from './pages/users';
import Staff from './pages/staff';
import Profile from './pages/profile.jsx';
import Feedback from './pages/feedback';
import Ratings from './pages/ratings';
import Announcement from './pages/announcement';
import Login from './pages/login';

// NEW: Public feedback page
import PublicFeedback from './pages/publicFeedback.jsx';

import Sidebar from './components/shared/Sidebar.jsx';
import Header from './components/shared/Header.jsx';
import LogoutModal from './components/shared/LogoutModal.jsx';
import { useAppLogic } from './hooks/useAppLogic';

export default function App() {
  const {
    isAuthenticated,
    setIsAuthenticated,
    loadingAuth,
    activeTab,
    setActiveTab,
    sidebarOpen,
    setSidebarOpen,
    adminUser,
    setAdminUser,
    showLogoutModal,
    setShowLogoutModal,
    handleNavClick,
    navItems,
    adminName,
    adminPhoto,
    adminInitials
  } = useAppLogic();

  // NEW:
  // Public feedback route.
  // This page is accessible without admin/staff login.
  // It does not display the admin sidebar or header.
  const currentPath =
    typeof window !== 'undefined'
      ? window.location.pathname.replace(/\/+$/, '') || '/'
      : '/';

  const isPublicFeedbackPage =
    currentPath === '/public-feedback';

  // IMPORTANT:
  // Public route is checked BEFORE authentication loading,
  // login redirects, and admin dashboard rendering.
  if (isPublicFeedbackPage) {
    return <PublicFeedback />;
  }

  // EXISTING: Authentication loading screen
  if (loadingAuth) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-sky-950 text-white">
        <p className="text-sm font-medium animate-pulse">Loading...</p>
      </div>
    );
  }

  // EXISTING: Login screen
  if (!isAuthenticated) {
    return (
      <Login
        onLogin={(user) => {
          setIsAuthenticated(true);
          setAdminUser(user);

          // Make sure the correct starting page is used
          // depending on the logged-in user's role.
          if (user?.role === 'staff') {
            setActiveTab('queue');
          } else {
            setActiveTab('dashboard');
          }
        }}
      />
    );
  }

  // EXISTING: Admin and staff page navigation
  const renderPage = () => {
    // Extra protection:
    // ADMIN MUST NEVER be able to access Queue Control.
    if (adminUser?.role === 'admin' && activeTab === 'queue') {
      return <Dashboard />;
    }

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;

      case 'queue':
        // Queue Control is STAFF ONLY.
        if (adminUser?.role !== 'staff') {
          return <Dashboard />;
        }

        return <QueueControl />;

      case 'appointments':
        return <Appointments />;

      case 'offices':
        return <Offices />;

      case 'users':
        return <MobileUsers />;

      case 'staff':
        return <Staff />;

      case 'announcement':
        return <Announcement />;

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

  // EXISTING: Main admin dashboard layout
  return (
    <div className="flex h-screen bg-sky-50 text-slate-800 font-sans overflow-hidden relative">
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        navItems={navItems}
        activeTab={activeTab}
        handleNavClick={handleNavClick}
        setShowLogoutModal={setShowLogoutModal}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden w-full">
        <Header
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          setActiveTab={setActiveTab}
          adminName={adminName}
          adminUser={adminUser}
          adminPhoto={adminPhoto}
          adminInitials={adminInitials}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-sky-50/60">
          {renderPage()}
        </main>
      </div>

      {showLogoutModal && (
        <LogoutModal setShowLogoutModal={setShowLogoutModal} />
      )}
    </div>
  );
}
