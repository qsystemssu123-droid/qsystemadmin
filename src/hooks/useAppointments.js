
import { useState, useEffect } from 'react';
import {
  collection,
  doc,
  updateDoc,
  query,
  orderBy,
  onSnapshot,
  getDocs,
  getDoc,
  limit,
  writeBatch,
  runTransaction,
  where,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db } from '../services/firebase.js';

const ADMIN_EMAIL = 'qsystemssu123@gmail.com';
const DELETE_BATCH_SIZE = 400;

const FEEDBACK_SITE_URL = (
  import.meta.env.VITE_FEEDBACK_SITE_URL || ''
).trim().replace(/\/+$/, '');

const isValidFeedbackReference = (reference) => {
  return (
    typeof reference === 'string' &&
    /^[a-f0-9]{48}$/i.test(reference.trim())
  );
};

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

const normalize = (value) =>
  String(value || '').trim().toLowerCase();

const isCompletedStatus = (status) =>
  ['completed', 'complete', 'finished', 'done'].includes(
    normalize(status)
  );

const isActiveStatus = (status) =>
  [
    'pending',
    'booked',
    'requested',
    'approved',
    'waiting',
    'in-progress',
    'serving',
    'now-serving'
  ].includes(normalize(status));

const getAssignedStaffId = (data) =>
  String(
    data?.assignedStaffId ||
    data?.staffId ||
    ''
  ).trim();

const getAssignedStaffEmail = (data) =>
  normalize(
    data?.assignedStaffEmail ||
    data?.staffEmail ||
    ''
  );

export function useAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clearingAppointments, setClearingAppointments] = useState(false);

  const [copyingFeedbackId, setCopyingFeedbackId] = useState(null);
  const [feedbackCopyError, setFeedbackCopyError] = useState('');

  useEffect(() => {
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
      throw error;
    }
  };

  // COMPLETE THE CURRENT STAFF MEMBER'S SERVICE TASK.
  const completeAppointment = async (id) => {
    if (!id) {
      throw new Error('Appointment ID is required.');
    }

    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error('Authentication required to complete an appointment.');
    }

    const appointmentRef = doc(db, 'appointments', id);

    const appointmentSnapshot = await getDoc(appointmentRef);

    if (!appointmentSnapshot.exists()) {
      throw new Error('Appointment not found.');
    }

    const tasksQuery = query(
      collection(db, 'appointment_services'),
      where('appointmentId', '==', id)
    );

    const tasksSnapshot = await getDocs(tasksQuery);

    // Legacy appointment without child service documents.
    if (tasksSnapshot.empty) {
      await updateDoc(appointmentRef, {
        status: 'completed'
      });

      return {
        success: true,
        message: 'Appointment completed successfully.'
      };
    }

    const tasks = tasksSnapshot.docs.map((task) => ({
      ref: task.ref,
      id: task.id,
      data: task.data()
    }));

    const currentUid = currentUser.uid;
    const currentEmail = normalize(currentUser.email);

    // Identify the service assigned to the authenticated staff member.
    let assignedTasks = tasks.filter(({ data }) => {
      const staffId = getAssignedStaffId(data);
      const staffEmail = getAssignedStaffEmail(data);

      return (
        (staffId && staffId === currentUid) ||
        (currentEmail && staffEmail === currentEmail)
      );
    });

    // Admin can complete a task only when there is exactly one
    // unfinished task, because this callback receives only appointment ID.
    if (
      !assignedTasks.length &&
      currentEmail === normalize(ADMIN_EMAIL)
    ) {
      const unfinishedTasks = tasks.filter(
        ({ data }) => !isCompletedStatus(data.status)
      );

      if (unfinishedTasks.length === 1) {
        assignedTasks = unfinishedTasks;
      }
    }

    if (assignedTasks.length !== 1) {
      throw new Error(
        assignedTasks.length > 1
          ? 'Multiple service tasks are assigned to this account. The correct task could not be identified.'
          : 'No service task assigned to your account was found for this appointment.'
      );
    }

    const targetTask = assignedTasks[0];

    // All reads happen before writes inside the transaction.
    return await runTransaction(db, async (transaction) => {
      const freshAppointment = await transaction.get(appointmentRef);

      if (!freshAppointment.exists()) {
        throw new Error('Appointment no longer exists.');
      }

      const freshTasks = [];

      for (const task of tasks) {
        const snapshot = await transaction.get(task.ref);

        if (snapshot.exists()) {
          freshTasks.push({
            ref: task.ref,
            id: task.id,
            data: snapshot.data()
          });
        }
      }

      const freshTarget = freshTasks.find(
        (task) => task.id === targetTask.id
      );

      if (!freshTarget) {
        throw new Error('The assigned service task no longer exists.');
      }

      const freshAppointmentData = freshAppointment.data();

      // Recheck ownership to avoid completing a reassigned task.
      const freshStaffId = getAssignedStaffId(freshTarget.data);
      const freshStaffEmail = getAssignedStaffEmail(freshTarget.data);

      const stillAssigned =
        (freshStaffId && freshStaffId === currentUid) ||
        (currentEmail && freshStaffEmail === currentEmail) ||
        (
          currentEmail === normalize(ADMIN_EMAIL) &&
          !freshStaffId &&
          !freshStaffEmail &&
          tasks.length === 1
        );

      if (!stillAssigned) {
        throw new Error(
          'This service task is no longer assigned to your account.'
        );
      }

      // Mark only the selected staff member's task completed.
      transaction.update(freshTarget.ref, {
        status: 'completed',
        completedAt: serverTimestamp(),
        completedBy: currentUid,
        completedByEmail: currentUser.email || ''
      });

      // Calculate the final status of every child task.
      const finalTasks = freshTasks.map((task) => ({
        ...task,
        data: {
          ...task.data,
          status:
            task.id === freshTarget.id
              ? 'completed'
              : task.data.status
        }
      }));

      const completedCount = finalTasks.filter(
        (task) => isCompletedStatus(task.data.status)
      ).length;

      const pendingCount = finalTasks.filter(
        (task) => isActiveStatus(task.data.status)
      ).length;

      const allCompleted =
        finalTasks.length > 0 &&
        completedCount === finalTasks.length;

      // Synchronize embedded parent service statuses.
      const services = Array.isArray(freshAppointmentData.services)
        ? [...freshAppointmentData.services]
        : [];

      const serviceTaskIds = Array.isArray(
        freshAppointmentData.serviceTaskIds
      )
        ? freshAppointmentData.serviceTaskIds
        : [];

      finalTasks.forEach((task) => {
        let serviceIndex = serviceTaskIds.findIndex(
          (taskId) => taskId === task.id
        );

        if (serviceIndex < 0) {
          serviceIndex = services.findIndex((service) => {
            const sameStaff =
              getAssignedStaffId(service) ===
                getAssignedStaffId(task.data) ||
              getAssignedStaffEmail(service) ===
                getAssignedStaffEmail(task.data);

            const sameService =
              normalize(service.serviceId) ===
                normalize(task.data.serviceId) ||
              normalize(service.serviceName) ===
                normalize(task.data.serviceName) ||
              normalize(service.name) ===
                normalize(task.data.serviceName);

            return sameStaff && sameService;
          });
        }

        if (serviceIndex >= 0 && services[serviceIndex]) {
          services[serviceIndex] = {
            ...services[serviceIndex],
            status: task.data.status || 'pending'
          };
        }
      });

      // Update parent counters and status.
      const parentUpdates = {
        services,
        completedServices: completedCount,
        pendingServices: pendingCount,
        status: allCompleted ? 'completed' : 'approved'
      };

      if (allCompleted) {
        parentUpdates.completedAt = serverTimestamp();
      }

      transaction.update(appointmentRef, parentUpdates);

      return {
        success: true,
        completedTaskId: freshTarget.id,
        completedServices: completedCount,
        pendingServices: pendingCount,
        allCompleted,
        message: allCompleted
          ? 'All service tasks have been completed.'
          : 'Your assigned service task has been completed.'
      };
    });
  };

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

    approveAppointment: (id) => updateStatus(id, 'approved'),
    rejectAppointment: (id) => updateStatus(id, 'rejected'),
    completeAppointment,

    generateFeedbackLink,
    getAppointmentFeedbackLink,
    copyFeedbackReference,
    copyFeedbackLink,
    copyingFeedbackId,
    feedbackCopyError,
  };
}
