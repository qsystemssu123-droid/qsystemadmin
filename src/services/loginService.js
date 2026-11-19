
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';

import { db, auth } from './firebase.js';

import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from 'firebase/firestore';

const ADMIN_EMAIL = 'qsystemssu123@gmail.com';

// Google Administrator Login
export const handleGoogleLogin = async () => {
  const provider = new GoogleAuthProvider();

  provider.setCustomParameters({
    prompt: 'select_account',
    login_hint: ADMIN_EMAIL
  });

  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    if (!user || user.email !== ADMIN_EMAIL) {
      await signOut(auth);

      throw new Error(
        "You're not authorized to login. Only the system administrator can access this portal."
      );
    }

    await setDoc(
      doc(db, 'admin', user.uid),
      {
        userId: user.uid,
        userName: user.displayName || 'Admin User',
        userEmail: user.email || '',
        userPhoto: user.photoURL || null,
        role: 'admin',
        lastLogin: serverTimestamp()
      },
      { merge: true }
    );

    return {
      ...user,
      role: 'admin'
    };
  } catch (error) {
    try {
      await signOut(auth);
    } catch (signOutErr) {
      console.error('Sign out error:', signOutErr);
    }

    if (
      error?.message ===
      "You're not authorized to login. Only the system administrator can access this portal."
    ) {
      throw error;
    }

    throw new Error("You're not authorized to login", {
      cause: error
    });
  }
};

// Staff Email Login - Automatic Firestore Office Detection
export const handleStaffEmailLogin = async ({
  email,
  password
}) => {
  try {
    // Authenticate staff using Firebase Authentication.
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email.trim(),
      password
    );

    const user = userCredential.user;

    // Administrator accounts must use Google login.
    if (
      user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
    ) {
      await signOut(auth);

      throw new Error(
        'The administrator account must use the Google Admin Access login.'
      );
    }

    // Retrieve staff record using authenticated Firebase UID.
    const staffDocRef = doc(db, 'staff', user.uid);

    let staffData = null;

    try {
      const staffDoc = await getDoc(staffDocRef);

      if (staffDoc.exists()) {
        staffData = staffDoc.data();
      }
    } catch (firestoreErr) {
      console.error(
        'Firestore error during staff lookup:',
        firestoreErr
      );

      throw new Error(
        'Unable to verify your staff account. Please contact the administrator.',
        { cause: firestoreErr }
      );
    }

    // Only registered staff accounts are allowed.
    if (!staffData) {
      throw new Error(
        'Staff account not found. Please contact the administrator.'
      );
    }

    // Verify that the authenticated email matches
    // the email registered in the staff collection.
    const authenticatedEmail = user.email?.trim().toLowerCase();

    const registeredEmail = staffData.email
      ?.trim()
      .toLowerCase();

    if (
      !authenticatedEmail ||
      !registeredEmail ||
      authenticatedEmail !== registeredEmail
    ) {
      throw new Error(
        'Your email does not match the registered staff account.'
      );
    }

    // Automatically detect the office from Firestore.
    // No dropdown or manual office selection is needed.
    const assignedOffice = staffData.office?.trim();

    if (!assignedOffice) {
      throw new Error(
        'No office is assigned to your staff account. Please contact the administrator.'
      );
    }

    console.log(
      'Staff office automatically detected:',
      assignedOffice
    );

    // Update staff login information.
    // Preserve the office value stored in Firestore.
    try {
      await setDoc(
        staffDocRef,
        {
          lastLogin: serverTimestamp(),
          email: user.email,
          office: assignedOffice,
          role: 'staff'
        },
        { merge: true }
      );
    } catch (updateErr) {
      console.warn(
        'Could not update lastLogin timestamp due to permissions:',
        updateErr
      );
    }

    // Return authenticated staff information
    // with the automatically detected office.
    return {
      ...user,
      uid: user.uid,
      email: user.email,
      name: staffData.name || user.displayName || '',
      office: assignedOffice,
      role: 'staff'
    };
  } catch (error) {
    console.error(
      'Staff Login Error Code & Message:',
      error?.code,
      error?.message
    );

    try {
      await signOut(auth);
    } catch (signOutErr) {
      console.error('Sign out error:', signOutErr);
    }

    if (
      error?.code === 'auth/invalid-credential' ||
      error?.code === 'auth/user-not-found' ||
      error?.code === 'auth/wrong-password'
    ) {
      throw new Error(
        'Incorrect staff email or password.',
        { cause: error }
      );
    }

    throw error;
  }
};
