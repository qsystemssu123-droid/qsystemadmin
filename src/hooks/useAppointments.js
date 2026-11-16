import { useState, useEffect } from 'react';
import { collection, doc, updateDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase.js';

export function useAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Changed 'desc' to 'asc' to sort from 1st (oldest/earliest) to last
    const q = query(collection(db, 'appointments'), orderBy('createdAt', 'asc'));

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

  return {
    appointments,
    loading,
    approveAppointment: (id) => updateStatus(id, 'approved'),
    rejectAppointment: (id) => updateStatus(id, 'rejected'),
    completeAppointment: (id) => updateStatus(id, 'completed'),
  };
}