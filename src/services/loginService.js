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

    throw new Error("You're not authorized to login", { cause: error });
  }
};

export const handleStaffEmailLogin = async ({
  email,
  password,
  office
}) => {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email.trim(),
      password
    );

    const user = userCredential.user;

    if (user.email === ADMIN_EMAIL) {
      await signOut(auth);

      throw new Error(
        'The administrator account must use the Google Admin Access login.'
      );
    }

    const staffDocRef = doc(db, 'staff', user.uid);
    let staffData = null;

    try {
      const staffDoc = await getDoc(staffDocRef);

      if (staffDoc.exists()) {
        staffData = staffDoc.data();
      }
    } catch (firestoreErr) {
      console.warn(
        'Firestore rule restriction encountered during staff lookup, proceeding with authenticated session:',
        firestoreErr
      );
    }

    if (
      staffData &&
      staffData.office &&
      staffData.office !== office
    ) {
      await signOut(auth);

      throw new Error(
        `Selected office (${office}) does not match your assigned office (${staffData.office}).`
      );
    }

    try {
      await setDoc(
        staffDocRef,
        {
          lastLogin: serverTimestamp(),
          email: user.email,
          office: staffData?.office || office,
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

    return {
      ...user,
      office: staffData?.office || office,
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
      throw new Error('Incorrect staff email or password.', { cause: error });
    }

    throw error;
  }
};