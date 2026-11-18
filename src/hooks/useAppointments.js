
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

export function useAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clearingAppointments, setClearingAppointments] = useState(false);

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
              'Failed to clear appointments. Please check Firestore permissions.', { cause: error }
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
    completeAppointment: (id) => updateStatus(id, 'completed'),
  };
}
