import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '../services/firebase.js';
import { doc, getDoc } from 'firebase/firestore';
import {
  LayoutDashboard,
  Ticket,
  CalendarCheck,
  Building2,
  Users,
  User,
  ShieldUser,
  Megaphone,
  MessageSquareText,
  Star
} from 'lucide-react';

export function useAppLogic() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [adminUser, setAdminUser] = useState(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

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
    let mounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!mounted) return;

      if (!user) {
        setIsAuthenticated(false);
        setAdminUser(null);
        setLoadingAuth(false);
        return;
      }

      try {
        if (user.email === 'qsystemssu123@gmail.com') {
          if (!mounted) return;

          setIsAuthenticated(true);
          setAdminUser({
            ...user,
            role: 'admin'
          });

          // Admin should NEVER stay on Queue Control.
          setActiveTab((prevTab) =>
            prevTab === 'queue' ? 'dashboard' : prevTab
          );

          setLoadingAuth(false);
          return;
        }

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

          // Prevent staff from staying on/defaulting to dashboard view.
          setActiveTab((prevTab) =>
            prevTab === 'dashboard' ? 'queue' : prevTab
          );

          setLoadingAuth(false);
          return;
        }

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

        if (!mounted) return;

        setIsAuthenticated(true);
        setAdminUser({
          ...user,
          role: 'staff'
        });

        setActiveTab((prevTab) =>
          prevTab === 'dashboard' ? 'queue' : prevTab
        );

        setLoadingAuth(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const handleNavClick = (id) => {
    // Staff cannot explicitly navigate to Dashboard.
    if (adminUser?.role === 'staff' && id === 'dashboard') {
      setActiveTab('queue');
    }
    // Admin cannot navigate to Queue Control.
    else if (adminUser?.role === 'admin' && id === 'queue') {
      setActiveTab('dashboard');
    }
    else {
      setActiveTab(id);
    }

    if (window.innerWidth < 768) {
      setSidebarOpen(false);
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
      label: 'SWDS',
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
      id: 'announcement',
      label: 'Announcements',
      icon: Megaphone
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
    // STAFF SIDEBAR
    if (adminUser?.role === 'staff') {
      return [
        'queue',
        'appointments',
        'announcement',
        'profile'
      ].includes(item.id);
    }

    // ADMIN SIDEBAR
    // Queue Control is intentionally excluded from admin navigation.
    if (adminUser?.role === 'admin') {
      return item.id !== 'queue';
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

  return {
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
  };
}
