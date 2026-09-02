import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase.js';
import { getLocalDateString } from '../utils/dateUtils.js';
import { INITIAL_MOCK_APPOINTMENTS } from '../data/mockData.js';

export function useDashboardData() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [todayDateStr, setTodayDateStr] = useState(() => getLocalDateString());

  useEffect(() => {
    const interval = setInterval(() => {
      const currentLocal = getLocalDateString();
      setTodayDateStr((prev) => (prev !== currentLocal ? currentLocal : prev));
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'appointments'), (querySnapshot) => {
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      if (data.length === 0) {
        setAppointments(INITIAL_MOCK_APPOINTMENTS);
      } else {
        setAppointments(data);
      }
      setLoading(false);
    }, (error) => {
      console.error('Error listening to dashboard data:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { appointments, loading, todayDateStr };
}