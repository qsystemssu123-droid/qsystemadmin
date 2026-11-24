import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { Menu, UserRound, LogOut, X } from 'lucide-react';

import { auth } from '../../services/firebase.js';

import {
  onAuthStateChanged,
  signOut,
} from 'firebase/auth';

import {
  getFirestore,
  doc,
  onSnapshot,
} from 'firebase/firestore';

// ============================================
// FIREBASE CONFIGURATION
// ============================================

const db = getFirestore(auth.app);

const ADMIN_EMAIL = 'qsystemssu123@gmail.com';

const ADMIN_COLLECTION = 'admin';
const STAFF_COLLECTION = 'staff';
const USERS_COLLECTION = 'users';

// ============================================
// HELPER: GET INITIALS
// ============================================

const getInitials = (name) => {
  const parts = (name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return 'AD';

  return parts
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
};

// ============================================
// FIREBASE AUTHENTICATION EXTERNAL STORE
// ============================================

let currentAuthUser = auth.currentUser;

const authListeners = new Set();

let authSubscription = null;

const notifyAuthListeners = () => {
  authListeners.forEach((listener) => listener());
};

const startAuthSubscription = () => {
  if (authSubscription) return;

  authSubscription = onAuthStateChanged(
    auth,
    (user) => {
      if (currentAuthUser !== user) {
        currentAuthUser = user;
        notifyAuthListeners();
      }
    },
    (error) => {
      console.error(
        'Header authentication listener error:',
        error
      );
    }
  );
};

const subscribeToAuth = (callback) => {
  authListeners.add(callback);

  startAuthSubscription();

  return () => {
    authListeners.delete(callback);
  };
};

const getAuthSnapshot = () => currentAuthUser;

// ============================================
// FIRESTORE PROFILE EXTERNAL STORE
// ============================================

const profileStores = new Map();

const createProfileStore = (uid, email) => {
  const isAdminAccount =
    email?.toLowerCase() ===
    ADMIN_EMAIL.toLowerCase();

  const collectionName = isAdminAccount
    ? ADMIN_COLLECTION
    : STAFF_COLLECTION;

  const listeners = new Set();

  let currentSnapshot = {
    profile: null,
    loaded: false,
  };

  let unsubscribeProfile = null;
  let unsubscribeLegacy = null;

  let subscriberCount = 0;

  const notify = () => {
    listeners.forEach((listener) => listener());
  };

  const updateSnapshot = (profile, loaded) => {
    currentSnapshot = {
      profile,
      loaded,
    };

    notify();
  };

  const stopLegacyListener = () => {
    if (unsubscribeLegacy) {
      unsubscribeLegacy();
      unsubscribeLegacy = null;
    }
  };

  const startLegacyListener = () => {
    if (!isAdminAccount || unsubscribeLegacy) {
      return;
    }

    const legacyRef = doc(
      db,
      USERS_COLLECTION,
      uid
    );

    unsubscribeLegacy = onSnapshot(
      legacyRef,

      (snapshot) => {
        if (snapshot.exists()) {
          updateSnapshot(
            snapshot.data(),
            true
          );
        } else {
          updateSnapshot(
            null,
            true
          );
        }
      },

      (error) => {
        console.error(
          'Error listening to legacy admin profile:',
          error
        );

        updateSnapshot(null, true);
      }
    );
  };

  const startProfileListener = () => {
    if (unsubscribeProfile) return;

    const profileRef = doc(
      db,
      collectionName,
      uid
    );

    unsubscribeProfile = onSnapshot(
      profileRef,

      (snapshot) => {
        if (snapshot.exists()) {
          stopLegacyListener();

          updateSnapshot(
            snapshot.data(),
            true
          );

          return;
        }

        // ====================================
        // LEGACY ADMIN PROFILE FALLBACK
        // ====================================

        if (isAdminAccount) {
          startLegacyListener();
          return;
        }

        updateSnapshot(null, true);
      },

      (error) => {
        console.error(
          'Error listening to account profile:',
          error
        );

        updateSnapshot(null, true);
      }
    );
  };

  const stopProfileListener = () => {
    if (unsubscribeProfile) {
      unsubscribeProfile();
      unsubscribeProfile = null;
    }

    stopLegacyListener();
  };

  return {
    getSnapshot: () => currentSnapshot,

    subscribe: (callback) => {
      listeners.add(callback);
      subscriberCount += 1;

      if (subscriberCount === 1) {
        startProfileListener();
      }

      return () => {
        listeners.delete(callback);
        subscriberCount -= 1;

        if (subscriberCount === 0) {
          stopProfileListener();
        }
      };
    },
  };
};

// ============================================
// PROFILE STORE REGISTRY
// ============================================

const getProfileStore = (uid, email) => {
  if (!uid) return null;

  const normalizedEmail = (
    email || ''
  ).toLowerCase();

  const key = `${uid}:${normalizedEmail}`;

  if (!profileStores.has(key)) {
    profileStores.set(
      key,
      createProfileStore(uid, normalizedEmail)
    );
  }

  return profileStores.get(key);
};

// ============================================
// EMPTY PROFILE SNAPSHOT
// ============================================

const EMPTY_PROFILE_SNAPSHOT = {
  profile: null,
  loaded: false,
};

const subscribeToNothing = () => () => {};

const getEmptyProfileSnapshot = () =>
  EMPTY_PROFILE_SNAPSHOT;

// ============================================
// HEADER COMPONENT
// ============================================

export default function Header({
  sidebarOpen,
  setSidebarOpen,
  setActiveTab,
  adminName,
  adminUser,
  adminPhoto,
  adminInitials
}) {

  // ============================================
  // PROFILE DROPDOWN STATE
  // ============================================

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const dropdownWrapperRef = useRef(null);

  // ============================================
  // FIREBASE AUTHENTICATION
  // ============================================

  const firebaseUser = useSyncExternalStore(
    subscribeToAuth,
    getAuthSnapshot,
    getAuthSnapshot
  );

  // ============================================
  // DETERMINE ACCOUNT TYPE
  // ============================================

  const isAuthorizedAdmin =
    firebaseUser?.email?.toLowerCase() ===
    ADMIN_EMAIL.toLowerCase();

  const accountRole = isAuthorizedAdmin
    ? 'admin'
    : 'staff';

  // ============================================
  // REAL-TIME FIRESTORE PROFILE STORE
  // ============================================

  const profileStore = getProfileStore(
    firebaseUser?.uid,
    firebaseUser?.email
  );

  const subscribeToProfile = useCallback(
    (callback) => {
      if (!profileStore) {
        return subscribeToNothing(callback);
      }

      return profileStore.subscribe(callback);
    },
    [profileStore]
  );

  const getProfileSnapshot = useCallback(
    () => {
      if (!profileStore) {
        return getEmptyProfileSnapshot();
      }

      return profileStore.getSnapshot();
    },
    [profileStore]
  );

  const profileSnapshot = useSyncExternalStore(
    subscribeToProfile,
    getProfileSnapshot,
    getProfileSnapshot
  );

  // ============================================
  // RESOLVE PROFILE INFORMATION
  // ============================================

  const liveProfile = profileSnapshot.profile;

  const profileLoaded = profileSnapshot.loaded;

  // ============================================
  // REAL-TIME PROFILE NAME
  // ============================================

  const displayedName =
    (
      accountRole === 'admin'
        ? liveProfile?.userName ||
          liveProfile?.name
        : liveProfile?.name ||
          liveProfile?.userName
    ) ||
    adminName ||
    firebaseUser?.displayName ||
    (
      accountRole === 'admin'
        ? 'Administrator'
        : 'Staff Member'
    );

  // ============================================
  // REAL-TIME PROFILE PICTURE
  // ============================================

  const displayedPhoto =
    liveProfile?.userPhoto ||
    liveProfile?.photoURL ||
    adminPhoto ||
    firebaseUser?.photoURL ||
    null;

  // ============================================
  // REAL-TIME OFFICE
  // ============================================

  const displayedOffice =
    liveProfile?.office ||
    adminUser?.office ||
    'Unassigned';

  // ============================================
  // REAL-TIME PROFILE INITIALS
  // ============================================

  const displayedInitials =
    profileLoaded && liveProfile
      ? getInitials(displayedName)
      : (
          adminInitials ||
          getInitials(displayedName)
        );

  // ============================================
  // DISPLAY ACCOUNT ROLE
  // ============================================

  const displayedRole =
    accountRole === 'staff'
      ? `Staff (${displayedOffice})`
      : 'Administrator';

  // ============================================
  // TOGGLE / OPEN PROFILE DROPDOWN
  // ============================================

  const handleProfileClick = () => {
    setLogoutError('');
    setShowProfileModal((prev) => !prev);
  };

  // ============================================
  // CLOSE PROFILE DROPDOWN
  // ============================================

  const handleCloseProfileModal = () => {
    if (loggingOut) return;

    setShowProfileModal(false);
    setLogoutError('');
  };

  // ============================================
  // GO TO PROFILE
  // ============================================

  const handleGoToProfile = () => {
    setShowProfileModal(false);
    setLogoutError('');

    if (typeof setActiveTab === 'function') {
      setActiveTab('profile');
    }

    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  // ============================================
  // LOGOUT
  // ============================================

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);
    setLogoutError('');

    try {
      await signOut(auth);

      setShowProfileModal(false);

      if (typeof setActiveTab === 'function') {
        setActiveTab('dashboard');
      }

      setSidebarOpen(false);
    } catch (error) {
      console.error('Logout failed:', error);

      setLogoutError(
        error?.message || 'Unable to log out. Please try again.'
      );
    } finally {
      setLoggingOut(false);
    }
  };

  // ============================================
  // CLOSE DROPDOWN WITH ESCAPE OR OUTSIDE CLICK
  // ============================================

  useEffect(() => {
    if (!showProfileModal) return;

    const handleEscape = (event) => {
      if (event.key === 'Escape' && !loggingOut) {
        setShowProfileModal(false);
        setLogoutError('');
      }
    };

    const handleOutsideClick = (event) => {
      if (
        !loggingOut &&
        dropdownWrapperRef.current &&
        !dropdownWrapperRef.current.contains(event.target)
      ) {
        setShowProfileModal(false);
        setLogoutError('');
      }
    };

    window.addEventListener('keydown', handleEscape);
    document.addEventListener('mousedown', handleOutsideClick);

    return () => {
      window.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showProfileModal, loggingOut]);

  // ============================================
  // ORIGINAL HEADER UI
  // WHITE HEADER #FFFFFF
  // ============================================

  return (
    <div ref={dropdownWrapperRef} className="relative z-20 shrink-0">
      <header className="relative h-16 bg-[#ffffff] border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 z-10 shadow-sm shrink-0">

        {/* ====================================== */}
        {/* SIDEBAR TOGGLE */}
        {/* ====================================== */}

        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-700 cursor-pointer transition-colors"
          aria-label="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* ====================================== */}
        {/* ACCOUNT PROFILE DROPDOWN TRIGGER */}
        {/* ====================================== */}

        <button
          type="button"
          onClick={handleProfileClick}
          className="flex items-center gap-3 cursor-pointer group p-1.5 rounded-2xl hover:bg-slate-100 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
          title="Account options"
          aria-label="Open account options"
          aria-haspopup="menu"
          aria-expanded={showProfileModal}
        >

          {/* ==================================== */}
          {/* PROFILE NAME AND ROLE */}
          {/* ==================================== */}

          <div className="text-right hidden sm:block">

            <p className="text-sm font-semibold text-slate-900 group-hover:text-sky-800 transition-colors">
              {displayedName}
            </p>

            <p className="text-xs text-slate-500">
              {displayedRole}
            </p>

          </div>

          {/* ==================================== */}
          {/* PROFILE PICTURE */}
          {/* ==================================== */}

          {displayedPhoto ? (

            <img
              src={displayedPhoto}
              alt={
                accountRole === 'admin'
                  ? 'Administrator Avatar'
                  : 'Staff Avatar'
              }
              className="h-9 w-9 sm:h-10 sm:w-10 rounded-full object-cover border border-slate-200 shadow-sm group-hover:ring-2 group-hover:ring-sky-400 group-hover:scale-105 transition-all duration-200"
            />

          ) : (

            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-sky-100 text-sky-800 flex items-center justify-center font-bold border border-slate-200 shadow-sm group-hover:ring-2 group-hover:ring-sky-400 group-hover:scale-105 transition-all duration-200 text-xs sm:text-sm">

              {displayedInitials}

            </div>

          )}

        </button>

      </header>

      {/* ========================================== */}
      {/* ACCOUNT OPTIONS DROPDOWN MODAL */}
      {/* ========================================== */}

      {showProfileModal && (
        <div
          role="menu"
          aria-labelledby="account-modal-title"
          className="absolute right-4 sm:right-6 top-full mt-2 z-[9999] w-72 sm:w-80 origin-top-right overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-900/5 animate-in fade-in zoom-in-95 duration-150"
        >

          {/* ==================================== */}
          {/* DROPDOWN CLOSE BUTTON */}
          {/* ==================================== */}

          <button
            type="button"
            onClick={handleCloseProfileModal}
            disabled={loggingOut}
            aria-label="Close account options"
            className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>

          {/* ==================================== */}
          {/* ACCOUNT INFORMATION */}
          {/* ==================================== */}

          <div className="flex items-center gap-3 px-4 pt-4 pb-3.5 pr-10">

            {displayedPhoto ? (

              <img
                src={displayedPhoto}
                alt={displayedName}
                className="h-11 w-11 shrink-0 rounded-full border border-slate-200 object-cover shadow-2xs"
              />

            ) : (

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-sky-200 bg-sky-100 text-sm font-extrabold text-sky-800 shadow-2xs">
                {displayedInitials}
              </div>

            )}

            <div className="min-w-0 flex-1">

              <h2
                id="account-modal-title"
                className="truncate text-sm font-bold text-slate-900"
              >
                {displayedName}
              </h2>

              <p className="truncate text-xs font-medium text-sky-700">
                {displayedRole}
              </p>

              {firebaseUser?.email && (
                <p className="mt-0.5 truncate text-[11px] text-slate-400">
                  {firebaseUser.email}
                </p>
              )}

            </div>

          </div>

          {/* ==================================== */}
          {/* DROPDOWN DIVIDER */}
          {/* ==================================== */}

          <div className="border-t border-slate-100"></div>

          {/* ==================================== */}
          {/* DROPDOWN ACTIONS */}
          {/* ==================================== */}

          <div className="space-y-1.5 p-2.5">

            {/* GO TO PROFILE */}

            <button
              type="button"
              role="menuitem"
              onClick={handleGoToProfile}
              disabled={loggingOut}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all hover:bg-sky-50 cursor-pointer disabled:opacity-50"
            >

              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                <UserRound className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">
                  Go to Profile
                </p>

                <p className="truncate text-[11px] text-slate-500">
                  View and manage account info
                </p>
              </div>

            </button>

            {/* LOGOUT */}

            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all hover:bg-rose-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
            >

              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                {loggingOut ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-rose-300 border-t-rose-700"></div>
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-rose-700">
                  {loggingOut ? 'Logging out...' : 'Logout'}
                </p>

                <p className="truncate text-[11px] text-slate-500">
                  Sign out of QueueMatrix
                </p>
              </div>

            </button>

            {/* LOGOUT ERROR */}

            {logoutError && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
                <X className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{logoutError}</span>
              </div>
            )}

          </div>

          {/* ==================================== */}
          {/* DROPDOWN FOOTER */}
          {/* ==================================== */}

          <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-2 text-center">
            <p className="text-[10px] font-medium text-slate-400">
              QueueMatrix Account
            </p>
          </div>

        </div>
      )}
    </div>
  );
}