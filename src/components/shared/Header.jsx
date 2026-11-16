
import { useCallback, useSyncExternalStore } from 'react';

import { Menu } from 'lucide-react';

import { auth } from '../../services/firebase.js';

import {
  onAuthStateChanged,
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

// Keep the latest authenticated user outside
// React's effect lifecycle.
//
// useSyncExternalStore subscribes to changes
// without synchronous setState calls in effects.

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

// Cache profile data by Firebase UID and role.
// This avoids stale data when switching between
// administrator and staff accounts.

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
  // HANDLE PROFILE NAVIGATION
  // ============================================

  const handleProfileClick = () => {
    setActiveTab('profile');

    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  // ============================================
  // ORIGINAL HEADER UI
  // ALL EXISTING FEATURES PRESERVED
  // ============================================

  return (
    <header className="h-16 bg-blue-100 backdrop-blur-md border-b border-sky-200/60 flex items-center justify-between px-4 sm:px-6 z-10 shadow-2xs shrink-0">

      {/* ====================================== */}
      {/* SIDEBAR TOGGLE */}
      {/* ====================================== */}

      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="p-2 rounded-xl hover:bg-sky-200/50 text-slate-700 cursor-pointer transition-colors"
        aria-label="Toggle Navigation"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* ====================================== */}
      {/* ACCOUNT PROFILE NAVIGATION */}
      {/* ====================================== */}

      <div
        onClick={handleProfileClick}
        className="flex items-center gap-3 cursor-pointer group p-1.5 rounded-2xl hover:bg-sky-200/50 transition-all duration-200"
        title="Go to Profile"
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
            className="h-9 w-9 sm:h-10 sm:w-10 rounded-full object-cover border border-sky-300 shadow-2xs group-hover:ring-2 group-hover:ring-sky-400 group-hover:scale-105 transition-all duration-200"
          />

        ) : (

          <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-sky-200 text-sky-800 flex items-center justify-center font-bold border border-sky-300 shadow-2xs group-hover:ring-2 group-hover:ring-sky-400 group-hover:scale-105 transition-all duration-200 text-xs sm:text-sm">

            {displayedInitials}

          </div>

        )}

      </div>

    </header>
  );
}
