
import { useState, useEffect } from 'react';
import {
  collection,
  doc,
  updateDoc,
  query,
  orderBy,
  onSnapshot,
  getDocs,
  limit,
  writeBatch
} from 'firebase/firestore';
import { auth, db } from '../services/firebase.js';

const ADMIN_EMAIL = 'qsystemssu123@gmail.com';
const DELETE_BATCH_SIZE = 400;

// Optional: Configure this in your .env file for production.
// Example:
// VITE_FEEDBACK_SITE_URL=https://your-domain.com
const FEEDBACK_SITE_URL = (
  import.meta.env.VITE_FEEDBACK_SITE_URL || ''
).trim().replace(/\/+$/, '');

// A valid feedback reference is a 48-character hexadecimal token.
const isValidFeedbackReference = (reference) => {
  return (
    typeof reference === 'string' &&
    /^[a-f0-9]{48}$/i.test(reference.trim())
  );
};

// Generate a personalized feedback link.
// The student will not need to manually type the reference.
export const generateFeedbackLink = (feedbackReference) => {
  const reference = String(feedbackReference || '').trim();

  if (!isValidFeedbackReference(reference)) {
    return '';
  }

  const baseUrl =
    FEEDBACK_SITE_URL ||
    (typeof window !== 'undefined'
      ? window.location.origin
      : '');

  if (!baseUrl) {
    return '';
  }

  try {
    const url = new URL('/public-feedback', baseUrl);

    url.searchParams.set('token', reference);

    return url.toString();
  } catch (error) {
    console.error('Error generating feedback link:', error);
    return '';
  }
};

// Copy text to the clipboard.
// Supports modern browsers and a fallback for older browsers.
const copyTextToClipboard = async (text) => {
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.warn(
        'Modern clipboard API unavailable, trying fallback:',
        error
      );
    }
  }

  if (typeof document === 'undefined') {
    throw new Error(
      'Clipboard access is unavailable in this environment.'
    );
  }

  const textarea = document.createElement('textarea');

  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  textarea.style.opacity = '0';

  document.body.appendChild(textarea);

  try {
    textarea.focus();
    textarea.select();

    const successful = document.execCommand('copy');

    if (!successful) {
      throw new Error('Clipboard copy was unsuccessful.');
    }

    return true;
  } finally {
    document.body.removeChild(textarea);
  }
};

export function useAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clearingAppointments, setClearingAppointments] = useState(false);

  // NEW: Feedback link copy state.
  const [copyingFeedbackId, setCopyingFeedbackId] = useState(null);
  const [feedbackCopyError, setFeedbackCopyError] = useState('');

  useEffect(() => {
    // Sort from first (oldest/earliest) to last.
    const q = query(
      collection(db, 'appointments'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const list = querySnapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        }));

        setAppointments(list);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching appointments: ', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const updateStatus = async (id, newStatus) => {
    try {
      const docRef = doc(db, 'appointments', id);
      await updateDoc(docRef, { status: newStatus });
    } catch (error) {
      console.error('Error updating status: ', error);
    }
  };

  // NEW: Get a feedback link for a completed appointment.
  const getAppointmentFeedbackLink = (appointment) => {
    if (!appointment) {
      return '';
    }

    const status = String(appointment.status || '')
      .trim()
      .toLowerCase();

    if (status !== 'completed') {
      return '';
    }

    return generateFeedbackLink(appointment.feedbackReference);
  };

  // NEW: Copy a completed appointment's feedback reference.
  const copyFeedbackReference = async (appointment) => {
    setFeedbackCopyError('');

    if (!appointment) {
      throw new Error('Appointment not found.');
    }

    const status = String(appointment.status || '')
      .trim()
      .toLowerCase();

    if (status !== 'completed') {
      throw new Error(
        'Feedback is only available for completed appointments.'
      );
    }

    const reference = String(
      appointment.feedbackReference || ''
    ).trim();

    if (!isValidFeedbackReference(reference)) {
      throw new Error(
        'The feedback reference is not available yet. ' +
        'Please wait for Firebase to generate it.'
      );
    }

    setCopyingFeedbackId(appointment.id || null);

    try {
      await copyTextToClipboard(reference);

      return {
        success: true,
        reference,
        message: 'Feedback reference copied successfully.'
      };
    } catch (error) {
      console.error('Error copying feedback reference:', error);
      setFeedbackCopyError(error.message);
      throw error;
    } finally {
      setCopyingFeedbackId(null);
    }
  };

  // NEW: Copy the personalized feedback link.
  const copyFeedbackLink = async (appointment) => {
    setFeedbackCopyError('');

    if (!appointment) {
      throw new Error('Appointment not found.');
    }

    const status = String(appointment.status || '')
      .trim()
      .toLowerCase();

    if (status !== 'completed') {
      throw new Error(
        'A feedback link can only be generated for a completed appointment.'
      );
    }

    const reference = String(
      appointment.feedbackReference || ''
    ).trim();

    if (!isValidFeedbackReference(reference)) {
      throw new Error(
        'The feedback reference has not been generated yet. ' +
        'Please wait a few seconds and try again.'
      );
    }

    const link = generateFeedbackLink(reference);

    if (!link) {
      throw new Error(
        'Unable to generate the feedback link. ' +
        'Please check your website URL configuration.'
      );
    }

    setCopyingFeedbackId(appointment.id || null);

    try {
      await copyTextToClipboard(link);

      return {
        success: true,
        link,
        reference,
        message: 'Feedback link copied successfully.'
      };
    } catch (error) {
      console.error('Error copying feedback link:', error);
      setFeedbackCopyError(error.message);
      throw error;
    } finally {
      setCopyingFeedbackId(null);
    }
  };

  // ADMIN ONLY: Delete every document in appointments.
  const clearAllAppointments = async () => {
    if (clearingAppointments) {
      throw new Error(
        'An appointment deletion is already in progress.'
      );
    }

    const currentUser = auth.currentUser;

    if (
      !currentUser ||
      String(currentUser.email || '').trim().toLowerCase() !==
        ADMIN_EMAIL
    ) {
      throw new Error(
        'Access denied. Only the administrator can clear all appointments.'
      );
    }

    setClearingAppointments(true);

    let deletedCount = 0;

    try {
      const appointmentsCollection = collection(db, 'appointments');

      // Process in batches to avoid Firestore write batch limits.
      // This deletes every document, not only the currently
      // displayed or filtered appointments.
      while (true) {
        const snapshot = await getDocs(
          query(
            appointmentsCollection,
            limit(DELETE_BATCH_SIZE)
          )
        );

        if (snapshot.empty) {
          break;
        }

        const batch = writeBatch(db);

        snapshot.docs.forEach((documentSnapshot) => {
          batch.delete(documentSnapshot.ref);
        });

        await batch.commit();

        deletedCount += snapshot.size;
      }

      return {
        success: true,
        deletedCount,
        message: `${deletedCount} appointment(s) deleted successfully.`
      };
    } catch (error) {
      console.error('Error clearing all appointments:', error);

      throw new Error(
        deletedCount > 0
          ? `${deletedCount} appointment(s) were deleted before the operation stopped. ${error.message || 'Please check Firestore permissions.'}`
          : error.message ||
              'Failed to clear appointments. Please check Firestore permissions.',
        { cause: error }
      );
    } finally {
      setClearingAppointments(false);
    }
  };

  return {
    appointments,
    loading,
    clearingAppointments,
    clearAllAppointments,

    // Existing appointment functionality.
    approveAppointment: (id) => updateStatus(id, 'approved'),
    rejectAppointment: (id) => updateStatus(id, 'rejected'),
    completeAppointment: (id) => updateStatus(id, 'completed'),

    // NEW: Public feedback functionality.
    generateFeedbackLink,
    getAppointmentFeedbackLink,
    copyFeedbackReference,
    copyFeedbackLink,
    copyingFeedbackId,
    feedbackCopyError,
  };
}
