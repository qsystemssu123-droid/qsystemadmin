import { useEffect, useRef, useState } from 'react';

import { auth } from '../services/firebase.js';

import {
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';

import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  setDoc,
} from 'firebase/firestore';

import {
  ShieldCheck,
  Mail,
  KeyRound,
  Lock,
  Clock,
  CheckCircle2,
  BadgeCheck,
  Camera,
  Pencil,
  Save,
  X,
  Loader2,
  AlertCircle,
  UserRound,
} from 'lucide-react';

// ============================================
// FIREBASE CONFIGURATION
// ============================================

const db = getFirestore(auth.app);

// Separate collections for the two website roles.
const ADMIN_COLLECTION = 'admin';
const STAFF_COLLECTION = 'staff';

// Preserve the mobile application's users collection.
// Used only as a legacy administrator profile fallback.
const USERS_COLLECTION = 'users';

const ADMIN_EMAIL = 'qsystemssu123@gmail.com';

// ============================================
// IMAGE CONFIGURATION
// ============================================

// Maximum original image size: 5 MB.
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

// Maximum compressed image dimension.
const MAX_IMAGE_DIMENSION = 320;

// Target JPEG quality.
const IMAGE_QUALITY = 0.7;

// Keeps compressed images below Firestore limits.
const MAX_BASE64_LENGTH = 300000;

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
// HELPER: COMPRESS IMAGE INTO BASE64
// ============================================

const compressImageToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No image selected.'));
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => {
      reject(
        new Error('Failed to read the selected image.')
      );
    };

    reader.onload = () => {
      const image = new Image();

      image.onerror = () => {
        reject(
          new Error('Unable to process the selected image.')
        );
      };

      image.onload = () => {
        try {
          const canvas = document.createElement('canvas');

          let width = image.width;
          let height = image.height;

          if (width > height) {
            if (width > MAX_IMAGE_DIMENSION) {
              height = Math.round(
                height * MAX_IMAGE_DIMENSION / width
              );

              width = MAX_IMAGE_DIMENSION;
            }
          } else {
            if (height > MAX_IMAGE_DIMENSION) {
              width = Math.round(
                width * MAX_IMAGE_DIMENSION / height
              );

              height = MAX_IMAGE_DIMENSION;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const context = canvas.getContext('2d');

          if (!context) {
            throw new Error(
              'Image compression is not supported.'
            );
          }

          // White background for transparent images.
          context.fillStyle = '#ffffff';

          context.fillRect(
            0,
            0,
            width,
            height
          );

          context.drawImage(
            image,
            0,
            0,
            width,
            height
          );

          let quality = IMAGE_QUALITY;

          let base64 = canvas.toDataURL(
            'image/jpeg',
            quality
          );

          // Further compress if necessary.
          while (
            base64.length > MAX_BASE64_LENGTH &&
            quality > 0.3
          ) {
            quality -= 0.1;

            base64 = canvas.toDataURL(
              'image/jpeg',
              quality
            );
          }

          if (base64.length > MAX_BASE64_LENGTH) {
            throw new Error(
              'The compressed image is still too large. ' +
              'Please select a smaller picture.'
            );
          }

          resolve(base64);
        } catch (error) {
          reject(error);
        }
      };

      image.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
};

// ============================================
// HELPER: FIREBASE ERROR MESSAGES
// ============================================

const getFirebaseErrorMessage = (error) => {
  const code = error?.code || '';

  if (
    code === 'permission-denied' ||
    code === 'firestore/permission-denied'
  ) {
    return (
      'Firestore permission denied. ' +
      'Please verify your Firestore security rules.'
    );
  }

  if (code === 'resource-exhausted') {
    return (
      'The profile data exceeds Firebase limits. ' +
      'Please use a smaller image.'
    );
  }

  if (code === 'unavailable') {
    return (
      'Firestore is temporarily unavailable. ' +
      'Please check your internet connection.'
    );
  }

  return error?.message || 'Failed to update profile.';
};

// ============================================
// HELPER: IDENTIFY WEBSITE ACCOUNT ROLE
// ============================================

const getAccountRole = (user) => {
  if (!user) return null;

  if (
    user.email?.toLowerCase() ===
    ADMIN_EMAIL.toLowerCase()
  ) {
    return 'admin';
  }

  return 'staff';
};

// ============================================
// PROFILE COMPONENT
// SUPPORTS ADMINISTRATOR AND STAFF
// ============================================

export default function AdminProfile() {

  // ============================================
  // STATES
  // ============================================

  const [adminUser, setAdminUser] = useState(
    () => auth.currentUser
  );

  const [profileData, setProfileData] = useState(null);

  const [loadingProfile, setLoadingProfile] = useState(true);

  const [isEditing, setIsEditing] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  const [editedName, setEditedName] = useState('');

  const [selectedPhoto, setSelectedPhoto] = useState(null);

  const [photoPreview, setPhotoPreview] = useState(null);

  const [successMessage, setSuccessMessage] = useState('');

  const [errorMessage, setErrorMessage] = useState('');

  const [profileCollection, setProfileCollection] = useState(null);

  const [accountVerified, setAccountVerified] = useState(false);

  const fileInputRef = useRef(null);

  // ============================================
  // ACCOUNT ROLE
  // ============================================

  const accountRole = getAccountRole(adminUser);

  const isAuthorizedAdmin = accountRole === 'admin';

  const isStaff = accountRole === 'staff';

  // ============================================
  // AUTHENTICATION LISTENER
  // ============================================

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setAdminUser(user);

        if (!user) {
          setProfileData(null);
          setProfileCollection(null);
          setAccountVerified(false);
          setLoadingProfile(false);
          setIsEditing(false);
        }
      }
    );

    return () => unsubscribe();
  }, []);

  // ============================================
  // LOAD PROFILE FROM THE CORRECT COLLECTION
  // ============================================

  useEffect(() => {
    let cancelled = false;

    const fetchAccountProfile = async () => {
      if (!adminUser) {
        setLoadingProfile(false);
        return;
      }

      setLoadingProfile(true);
      setErrorMessage('');
      setSuccessMessage('');
      setProfileData(null);
      setProfileCollection(null);
      setAccountVerified(false);

      try {
        const currentRole = getAccountRole(adminUser);

        // ============================================
        // ADMINISTRATOR ACCOUNT
        // ============================================

        if (currentRole === 'admin') {

          const adminRef = doc(
            db,
            ADMIN_COLLECTION,
            adminUser.uid
          );

          const adminSnapshot = await getDoc(adminRef);

          if (cancelled) return;

          if (adminSnapshot.exists()) {
            const data = adminSnapshot.data();

            setProfileData(data);
            setProfileCollection(ADMIN_COLLECTION);
            setAccountVerified(true);

            setEditedName(
              data.userName ||
              data.name ||
              adminUser.displayName ||
              'Administrator'
            );

            return;
          }

          // ============================================
          // LEGACY ADMIN PROFILE FALLBACK
          // ============================================

          const legacyRef = doc(
            db,
            USERS_COLLECTION,
            adminUser.uid
          );

          const legacySnapshot = await getDoc(legacyRef);

          if (cancelled) return;

          if (legacySnapshot.exists()) {
            const data = legacySnapshot.data();

            setProfileData(data);
            setProfileCollection(USERS_COLLECTION);
            setAccountVerified(true);

            setEditedName(
              data.userName ||
              data.name ||
              adminUser.displayName ||
              'Administrator'
            );

            return;
          }

          // ============================================
          // ADMIN AUTH EXISTS BUT PROFILE IS MISSING
          // ============================================

          // Create only the signed-in administrator's
          // profile. Do not overwrite any existing data.
          const initialAdminData = {
            userId: adminUser.uid,
            userEmail: adminUser.email,
            userName:
              adminUser.displayName || 'Administrator',
            userPhoto: null,
            role: 'admin',
          };

          await setDoc(
            adminRef,
            initialAdminData,
            { merge: true }
          );

          if (cancelled) return;

          setProfileData(initialAdminData);
          setProfileCollection(ADMIN_COLLECTION);
          setAccountVerified(true);

          setEditedName(initialAdminData.userName);

          return;
        }

        // ============================================
        // STAFF ACCOUNT
        // ============================================

        const staffRef = doc(
          db,
          STAFF_COLLECTION,
          adminUser.uid
        );

        const staffSnapshot = await getDoc(staffRef);

        if (cancelled) return;

        if (!staffSnapshot.exists()) {
          throw new Error(
            'Staff profile document was not found in ' +
            'Firestore. Expected path: staff/' +
            adminUser.uid +
            '. Please verify that this staff account ' +
            'was created by the administrator.'
          );
        }

        const staffData = staffSnapshot.data();

        // Prevent using another staff document
        // with a mismatched email.
        if (
          staffData.email?.toLowerCase() !==
          adminUser.email?.toLowerCase()
        ) {
          throw new Error(
            'Staff account verification failed. ' +
            'The Firestore staff email does not match ' +
            'the authenticated account.'
          );
        }

        setProfileData(staffData);
        setProfileCollection(STAFF_COLLECTION);
        setAccountVerified(true);

        setEditedName(
          staffData.name ||
          adminUser.displayName ||
          'Staff Member'
        );

      } catch (error) {
        console.error(
          'Error fetching account profile:',
          error
        );

        if (!cancelled) {
          setErrorMessage(
            'Unable to load account profile: ' +
            getFirebaseErrorMessage(error)
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingProfile(false);
        }
      }
    };

    fetchAccountProfile();

    return () => {
      cancelled = true;
    };
  }, [adminUser?.uid, adminUser?.email]);

  // ============================================
  // CLEAN UP IMAGE PREVIEW
  // ============================================

  useEffect(() => {
    return () => {
      if (photoPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  // ============================================
  // ACCOUNT INFORMATION
  // ============================================

  const adminEmail =
    adminUser?.email ||
    profileData?.userEmail ||
    profileData?.email ||
    '';

  const adminName = isAuthorizedAdmin
    ? (
        profileData?.userName ||
        profileData?.name ||
        adminUser?.displayName ||
        'Administrator'
      )
    : (
        profileData?.name ||
        adminUser?.displayName ||
        'Staff Member'
      );

  const adminPhoto =
    profileData?.userPhoto ||
    profileData?.photoURL ||
    adminUser?.photoURL ||
    null;

  const adminUid =
    adminUser?.uid ||
    'Protected System UID';

  const assignedOffice =
    profileData?.office ||
    'Not Assigned';

  const creationTime =
    adminUser?.metadata?.creationTime
      ? new Date(
          adminUser.metadata.creationTime
        ).toLocaleDateString()
      : 'Active Session';

  const displayedPhoto =
    photoPreview || adminPhoto;

  const canEditProfile =
    !!adminUser &&
    !!profileData &&
    !!profileCollection &&
    accountVerified;

  // ============================================
  // BEGIN EDITING
  // ============================================

  const handleEditProfile = () => {
    if (!canEditProfile) {
      setErrorMessage(
        'Your account profile could not be verified.'
      );
      return;
    }

    setEditedName(adminName);
    setSelectedPhoto(null);
    setPhotoPreview(null);
    setErrorMessage('');
    setSuccessMessage('');
    setIsEditing(true);
  };

  // ============================================
  // CANCEL EDITING
  // ============================================

  const handleCancelEdit = () => {
    if (isSaving) return;

    setEditedName(adminName);
    setSelectedPhoto(null);
    setPhotoPreview(null);

    setIsEditing(false);
    setErrorMessage('');
    setSuccessMessage('');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ============================================
  // HANDLE PROFILE PICTURE SELECTION
  // ============================================

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setErrorMessage('');
    setSuccessMessage('');

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
    ];

    if (!allowedTypes.includes(file.type)) {
      setErrorMessage(
        'Please choose a JPG, PNG, or WEBP image.'
      );

      event.target.value = '';
      return;
    }

    if (file.size === 0) {
      setErrorMessage(
        'The selected image is empty.'
      );

      event.target.value = '';
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setErrorMessage(
        'Please select an image smaller than 5 MB.'
      );

      event.target.value = '';
      return;
    }

    const preview = URL.createObjectURL(file);

    setSelectedPhoto(file);
    setPhotoPreview(preview);
  };

  // ============================================
  // SAVE PROFILE TO FIRESTORE
  // ============================================

  const handleSaveProfile = async () => {
    if (isSaving) return;

    setErrorMessage('');
    setSuccessMessage('');

    const trimmedName = editedName.trim();

    if (!trimmedName) {
      setErrorMessage(
        'Please enter your full name.'
      );
      return;
    }

    if (trimmedName.length > 100) {
      setErrorMessage(
        'Your name cannot exceed 100 characters.'
      );
      return;
    }

    const currentUser = auth.currentUser;

    if (!currentUser) {
      setErrorMessage(
        'Your session has expired. Please sign in again.'
      );
      return;
    }

    if (
      !canEditProfile ||
      currentUser.uid !== adminUser?.uid
    ) {
      setErrorMessage(
        'This account is not authorized to update this profile.'
      );
      return;
    }

    setIsSaving(true);

    try {
      // ============================================
      // SELECT CORRECT FIRESTORE DOCUMENT
      // ============================================

      const profileRef = doc(
        db,
        profileCollection,
        currentUser.uid
      );

      const existingDoc = await getDoc(profileRef);

      if (!existingDoc.exists()) {
        throw new Error(
          'Your profile document no longer exists. ' +
          'Please refresh the page.'
        );
      }

      const existingData = existingDoc.data();

      // ============================================
      // VERIFY STAFF ACCOUNT AGAIN
      // ============================================

      if (isStaff) {
        if (
          existingData.email?.toLowerCase() !==
          currentUser.email?.toLowerCase()
        ) {
          throw new Error(
            'Staff account verification failed.'
          );
        }
      }

      // ============================================
      // FIRESTORE-ONLY IMAGE HANDLING
      // ============================================

      let updatedPhotoURL =
        existingData.userPhoto ||
        existingData.photoURL ||
        currentUser.photoURL ||
        null;

      if (selectedPhoto) {
        updatedPhotoURL = await compressImageToBase64(
          selectedPhoto
        );
      }

      // ============================================
      // UPDATE ONLY PROFILE FIELDS
      // ============================================

      // Existing fields are preserved.
      // No Firebase Storage is used.

      const updatedFields = isAuthorizedAdmin
        ? {
            userName: trimmedName,
            userPhoto: updatedPhotoURL,
          }
        : {
            name: trimmedName,
            userPhoto: updatedPhotoURL,
          };

      await updateDoc(
        profileRef,
        updatedFields
      );

      // ============================================
      // SYNCHRONIZE FIREBASE AUTHENTICATION
      // ============================================

      let authSyncWarning = '';

      try {
        // Firebase Authentication photoURL should
        // remain a normal URL.
        // The compressed Base64 image stays in Firestore.

        await updateProfile(currentUser, {
          displayName: trimmedName,
        });

      } catch (authError) {
        console.error(
          'Firebase Auth profile sync failed:',
          authError
        );

        authSyncWarning =
          ' Firestore was updated, but Firebase ' +
          'Authentication could not be synchronized.';
      }

      // ============================================
      // UPDATE UI IMMEDIATELY
      // ============================================

      setProfileData((previous) => ({
        ...(previous || {}),
        ...updatedFields,
      }));

      setAdminUser({
        ...currentUser,
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: trimmedName,
        photoURL: currentUser.photoURL,
        metadata: currentUser.metadata,
      });

      setSelectedPhoto(null);
      setPhotoPreview(null);
      setIsEditing(false);

      setSuccessMessage(
        `${
          isAuthorizedAdmin
            ? 'Administrator'
            : 'Staff'
        } profile updated successfully.` +
        authSyncWarning
      );

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error) {
      console.error(
        'Error updating profile:',
        error
      );

      setErrorMessage(
        getFirebaseErrorMessage(error)
      );
    } finally {
      setIsSaving(false);
    }
  };

  // ============================================
  // ORIGINAL PROFILE UI
  // UPDATED FOR ADMIN AND STAFF
  // ============================================

  return (
    <div
      className="space-y-6 max-w-5xl mx-auto px-2 sm:px-0"
      style={{
        animation: 'fadeIn 0.5s ease-in-out',
      }}
    >

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

      {/* ====================================== */}
      {/* PAGE HEADER */}
      {/* ====================================== */}

      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
          {isAuthorizedAdmin
            ? 'Administrator Profile & Security'
            : 'Staff Profile & Security'}
        </h1>

        <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
          {isAuthorizedAdmin
            ? 'Manage system credentials, access control permissions, and administrative security state.'
            : 'Manage your staff profile, assigned office information, and account security.'}
        </p>
      </div>

      {/* ====================================== */}
      {/* SUCCESS MESSAGE */}
      {/* ====================================== */}

      {successMessage && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800">

          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />

          <p className="text-xs sm:text-sm font-medium flex-1">
            {successMessage}
          </p>

          <button
            type="button"
            onClick={() => setSuccessMessage('')}
            aria-label="Dismiss success message"
          >
            <X className="w-4 h-4" />
          </button>

        </div>
      )}

      {/* ====================================== */}
      {/* ERROR MESSAGE */}
      {/* ====================================== */}

      {errorMessage && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800">

          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />

          <p className="text-xs sm:text-sm font-medium flex-1">
            {errorMessage}
          </p>

          <button
            type="button"
            onClick={() => setErrorMessage('')}
            aria-label="Dismiss error message"
          >
            <X className="w-4 h-4" />
          </button>

        </div>
      )}

      {/* ====================================== */}
      {/* MAIN PROFILE CARD */}
      {/* ====================================== */}

      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xs border border-slate-200 overflow-hidden">

        {/* ==================================== */}
        {/* BANNER HEADER */}
        {/* ==================================== */}

        <div className="h-32 sm:h-32 bg-gradient-to-r from-purple-700 via-indigo-700 to-slate-900 px-4 sm:px-8 flex flex-col sm:flex-row justify-between sm:justify-end items-start sm:items-end py-3 sm:pb-4 gap-2">

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-semibold bg-white/20 text-white backdrop-blur-md z-10">

            <BadgeCheck className="w-3.5 h-3.5" />

            {isAuthorizedAdmin
              ? 'Super Administrator'
              : 'Authorized Staff'}

          </span>

        </div>

        {/* ==================================== */}
        {/* PROFILE CONTENT */}
        {/* ==================================== */}

        <div className="px-4 sm:px-8 pb-6 sm:pb-8 pt-0 relative">

          {/* ================================== */}
          {/* AVATAR AND HEADER INFORMATION */}
          {/* ================================== */}

          <div className="-mt-12 sm:-mt-12 mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">

            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-3 sm:gap-5 text-center sm:text-left w-full sm:w-auto">

              {/* ============================== */}
              {/* AVATAR */}
              {/* ============================== */}

              <div className="relative shrink-0 z-20">

                {displayedPhoto ? (
                  <img
                    src={displayedPhoto}
                    alt="Profile Avatar"
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-4 border-white shadow-md bg-white"
                  />
                ) : (
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-2xl sm:text-3xl border-4 border-white shadow-md">

                    {getInitials(
                      isEditing
                        ? editedName
                        : adminName
                    )}

                  </div>
                )}

                {/* ============================ */}
                {/* CHANGE PROFILE PICTURE */}
                {/* ============================ */}

                {isEditing && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handlePhotoChange}
                      disabled={isSaving}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        fileInputRef.current?.click()
                      }
                      disabled={isSaving}
                      aria-label="Change profile picture"
                      title="Change profile picture"
                      className="absolute -bottom-2 -right-2 p-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl shadow-md border-2 border-white transition-colors disabled:opacity-50"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </>
                )}

              </div>

              {/* ============================== */}
              {/* NAME AND DESCRIPTION */}
              {/* ============================== */}

              <div className="mb-0 sm:mb-1 w-full sm:w-auto min-w-0">

                {loadingProfile ? (
                  <div className="flex items-center justify-center sm:justify-start gap-2">

                    <Loader2 className="w-4 h-4 animate-spin text-purple-600" />

                    <span className="text-sm text-slate-500">
                      Loading profile...
                    </span>

                  </div>
                ) : isEditing ? (
                  <div className="space-y-2">

                    <label
                      htmlFor="admin-full-name"
                      className="block text-xs font-semibold text-slate-600"
                    >
                      Full Name
                    </label>

                    <div className="relative">

                      <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />

                      <input
                        id="admin-full-name"
                        type="text"
                        value={editedName}
                        onChange={(event) =>
                          setEditedName(event.target.value)
                        }
                        maxLength={100}
                        disabled={isSaving}
                        placeholder="Enter your full name"
                        className="w-full sm:w-72 pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:opacity-60"
                      />

                    </div>

                    <p className="text-[11px] text-slate-500">
                      Click the camera icon to choose a profile picture.
                      Maximum original image size: 5 MB.
                      Images are compressed before saving to Firestore.
                    </p>

                  </div>
                ) : (
                  <>
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug truncate">
                      {adminName}
                    </h2>

                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">

                      {isAuthorizedAdmin
                        ? 'SSU Queue Management System Administrator'
                        : `SSU Queue Management System Staff — ${assignedOffice}`}

                    </p>
                  </>
                )}

              </div>

            </div>

            {/* ================================ */}
            {/* SESSION STATUS */}
            {/* ================================ */}

            <div className="flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3.5 py-2 rounded-xl text-xs font-semibold self-center sm:self-auto w-full sm:w-auto shrink-0">

              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />

              Secure Session Active

            </div>

          </div>

          {/* ================================== */}
          {/* PROFILE EDITING ACTIONS */}
          {/* ================================== */}

          <div className="flex flex-wrap items-center gap-2 mb-6">

            {!isEditing ? (
              <button
                type="button"
                onClick={handleEditProfile}
                disabled={
                  loadingProfile ||
                  !adminUser ||
                  !profileData ||
                  !canEditProfile
                }
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >

                <Pencil className="w-4 h-4" />

                Edit Profile

              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50"
                >

                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Changes
                    </>
                  )}

                </button>

                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50"
                >

                  <X className="w-4 h-4" />

                  Cancel

                </button>
              </>
            )}

          </div>

          {/* ================================== */}
          {/* DETAILS GRID */}
          {/* ================================== */}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 pt-4 border-t border-slate-100">

            {/* ================================ */}
            {/* EMAIL FIELD */}
            {/* ================================ */}

            <div className="flex items-start gap-3.5 sm:gap-4 p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-100">

              <div className="p-2.5 sm:p-3 bg-white text-purple-700 rounded-xl shadow-2xs border border-slate-200 shrink-0">
                <Mail className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>

              <div className="min-w-0 flex-1">

                <p className="text-[11px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">

                  {isAuthorizedAdmin
                    ? 'Authorized Admin Email'
                    : 'Authorized Staff Email'}

                </p>

                <p className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5 truncate">
                  {adminEmail}
                </p>

                <p className="text-xs text-slate-500 mt-1 leading-snug">

                  {isAuthorizedAdmin
                    ? 'Strictly whitelisted for administrator access.'
                    : 'Verified against the registered staff account.'}

                </p>

              </div>

            </div>

            {/* ================================ */}
            {/* ACCOUNT UID */}
            {/* ================================ */}

            <div className="flex items-start gap-3.5 sm:gap-4 p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-100">

              <div className="p-2.5 sm:p-3 bg-white text-purple-700 rounded-xl shadow-2xs border border-slate-200 shrink-0">
                <KeyRound className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>

              <div className="min-w-0 flex-1">

                <p className="text-[11px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Firebase Account UID
                </p>

                <div className="mt-1">

                  <p className="font-mono text-[11px] sm:text-xs text-slate-800 bg-white px-2 py-1 rounded-md border border-slate-200 inline-block max-w-full truncate">
                    {adminUid}
                  </p>

                </div>

                <p className="text-xs text-slate-500 mt-1 leading-snug">
                  Unique database identifier reference.
                </p>

              </div>

            </div>

            {/* ================================ */}
            {/* SECURITY LEVEL */}
            {/* ================================ */}

            <div className="flex items-start gap-3.5 sm:gap-4 p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-100">

              <div className="p-2.5 sm:p-3 bg-white text-purple-700 rounded-xl shadow-2xs border border-slate-200 shrink-0">
                <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>

              <div className="min-w-0 flex-1">

                <p className="text-[11px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Access Clearance
                </p>

                <p className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5">

                  {isAuthorizedAdmin
                    ? 'Administrator Account Management'
                    : 'Staff Appointment Management'}

                </p>

                <p className="text-xs text-slate-500 mt-1 leading-snug">

                  {isAuthorizedAdmin
                    ? 'Authorized to manage staff accounts and account bans.'
                    : `Assigned to ${assignedOffice}. Responsible for managing appointments.`}

                </p>

              </div>

            </div>

            {/* ================================ */}
            {/* SESSION VERIFICATION */}
            {/* ================================ */}

            <div className="flex items-start gap-3.5 sm:gap-4 p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-100">

              <div className="p-2.5 sm:p-3 bg-white text-purple-700 rounded-xl shadow-2xs border border-slate-200 shrink-0">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>

              <div className="min-w-0 flex-1">

                <p className="text-[11px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Session Registered
                </p>

                <p className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5 truncate">
                  {creationTime}
                </p>

                <p className="text-xs text-slate-500 mt-1 leading-snug">
                  Firebase Authentication Secure Session.
                </p>

              </div>

            </div>

          </div>

          {/* ================================== */}
          {/* SECURITY NOTICE BOX */}
          {/* ================================== */}

          <div className="mt-5 sm:mt-6 p-3.5 sm:p-4 rounded-2xl bg-purple-50/60 border border-purple-100 flex items-start gap-3 text-purple-900">

            <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 shrink-0 mt-0.5" />

            <p className="text-xs leading-relaxed">

              <strong>
                Security Protocol Enforced:
              </strong>{' '}

              {isAuthorizedAdmin ? (
                <>
                  Administrator access is reserved for the
                  authorized account{' '}

                  <span className="font-mono font-semibold break-all">
                    {ADMIN_EMAIL}
                  </span>.

                  Staff account management and account bans
                  are administrator-only operations.
                </>
              ) : (
                <>
                  Staff account identity is verified against
                  the Firestore staff collection.

                  Staff members can update their own profile
                  name and picture without changing their
                  registered email, assigned office, or
                  account permissions.
                </>
              )}

            </p>

          </div>

        </div>

      </div>

    </div>
  );
}