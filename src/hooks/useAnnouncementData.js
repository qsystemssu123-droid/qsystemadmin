import { useState, useEffect } from 'react';
import { db, auth } from '../services/firebase';
import { collection, doc, getDocs, setDoc, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { ADMIN_EMAIL } from '../utils/announcementConstants';

export function useAnnouncementData() {
  const [offices, setOffices] = useState({
    OSAS: { isBusy: false, reason: '' },
    CLINIC: { isBusy: false, reason: '' },
    SWDS: { isBusy: false, reason: '' },
  });

  const [officeReasons, setOfficeReasons] = useState({
    OSAS: '',
    CLINIC: '',
    SWDS: '',
  });

  const [currentUser, setCurrentUser] = useState(null);
  const [staffOffice, setStaffOffice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessLoading, setAccessLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  const isAdmin = currentUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  useEffect(() => {
    let mounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!mounted) return;

      setCurrentUser(user);

      if (!user) {
        setStaffOffice(null);
        setAccessLoading(false);
        return;
      }

      if (user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        setStaffOffice(null);
        setAccessLoading(false);
        return;
      }

      try {
        const staffQuery = query(collection(db, 'staff'), where('email', '==', user.email));
        const staffSnapshot = await getDocs(staffQuery);

        if (!mounted) return;

        if (!staffSnapshot.empty) {
          const staffData = staffSnapshot.docs[0].data();
          const assignedOffice = String(staffData.office || '').trim().toUpperCase();

          if (['OSAS', 'CLINIC', 'SWDS'].includes(assignedOffice)) {
            setStaffOffice(assignedOffice);
          } else {
            setStaffOffice(null);
          }
        } else {
          setStaffOffice(null);
        }
      } catch (error) {
        console.error('Failed to load staff office assignment:', error);
        if (mounted) setStaffOffice(null);
      } finally {
        if (mounted) setAccessLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const fetchOfficesFromFirestore = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'offices'));
        const fetchedOffices = {
          OSAS: { isBusy: false, reason: '' },
          CLINIC: { isBusy: false, reason: '' },
          SWDS: { isBusy: false, reason: '' },
        };

        if (querySnapshot.empty) {
          for (const key of ['OSAS', 'CLINIC', 'SWDS']) {
            await setDoc(doc(db, 'offices', key), {
              isBusy: false,
              reason: '',
              updatedAt: new Date().toISOString(),
            });
          }
        } else {
          querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const officeKey = docSnap.id.toUpperCase();

            if (Object.prototype.hasOwnProperty.call(fetchedOffices, officeKey)) {
              fetchedOffices[officeKey] = {
                isBusy: !!data.isBusy,
                reason: data.reason || '',
              };
            }
          });
        }

        setOffices(fetchedOffices);
      } catch (error) {
        console.error('Error fetching offices from Firestore:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOfficesFromFirestore();
  }, []);

  const canControlOffice = (officeKey) => {
    if (isAdmin) return true;
    return staffOffice === officeKey;
  };

  const handleReasonChange = (officeKey, val) => {
    if (!canControlOffice(officeKey)) return;
    setOfficeReasons((prev) => ({ ...prev, [officeKey]: val }));
  };

  const handleToggleBooking = async (officeKey) => {
    if (!canControlOffice(officeKey)) {
      alert(`You are not authorized to modify the ${officeKey} Office. You can only manage your assigned office: ${staffOffice}.`);
      return;
    }

    const currentStatus = offices[officeKey].isBusy;
    const newStatus = !currentStatus;
    const currentReason = officeReasons[officeKey];

    if (newStatus && !currentReason.trim()) {
      alert(`Please select a preset reason or type a custom reason before disabling bookings for ${officeKey}.`);
      return;
    }

    const finalReason = newStatus ? currentReason.trim() : '';
    setActionLoading(officeKey);

    try {
      const officeDocRef = doc(db, 'offices', officeKey);
      await setDoc(
        officeDocRef,
        {
          isBusy: newStatus,
          reason: finalReason,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      setOffices((prev) => ({
        ...prev,
        [officeKey]: { isBusy: newStatus, reason: finalReason },
      }));

      if (!newStatus) {
        setOfficeReasons((prev) => ({ ...prev, [officeKey]: '' }));
      }

      setSuccessMessage(
        newStatus
          ? `Bookings successfully disabled for ${officeKey} Office in Firestore.`
          : `Bookings successfully enabled for ${officeKey} Office in Firestore.`
      );

      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (error) {
      console.error('Error updating office status in Firestore:', error);
      alert('Failed to update office status. Please check your Firestore connection/rules.');
    } finally {
      setActionLoading(null);
    }
  };

  return {
    offices,
    officeReasons,
    currentUser,
    staffOffice,
    isAdmin,
    loading,
    accessLoading,
    actionLoading,
    successMessage,
    canControlOffice,
    handleReasonChange,
    handleToggleBooking,
  };
}