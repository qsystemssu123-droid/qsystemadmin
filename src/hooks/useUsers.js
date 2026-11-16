import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase.js';

export function useUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Updated to query the 'admin' collection instead of 'users'
    const q = query(collection(db, 'admin'), orderBy('lastLogin', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const list = querySnapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        }));

        setUsers(list);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching admin users: ', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { users, loading };
}