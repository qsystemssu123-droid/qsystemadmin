
import { useState, useEffect } from 'react';
import { db, auth } from '../services/firebase';
import { collection, doc, getDocs, setDoc, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { ADMIN_EMAIL } from '../utils/announcementConstants';

const OFFICE_NAME = 'SWDS';

export function useAnnouncementData() {
  const [offices, setOffices] = useState({
    SWDS: { isBusy: false, reason: '' },
  });

  const [officeReasons, setOfficeReasons] = useState({
    SWDS: '',
  });

  const [currentUser, setCurrentUser] = useState(null);
  const [staffOffice, setStaffOffice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessLoading, setAccessLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  const isAdmin =
    currentUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  useEffect(() => {
    let mounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!mounted) return;

      setCurrentUser(user);
      setAccessLoading(true);

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
        const staffQuery = query(
          collection(db, 'staff'),
          where('email', '==', user.email)
        );

        const staffSnapshot = await getDocs(staffQuery);

        if (!mounted) return;

        if (!staffSnapshot.empty) {
          const staffData = staffSnapshot.docs[0].data();

          const assignedOffice = String(
            staffData.office || ''
          ).trim().toUpperCase();

          if (assignedOffice === OFFICE_NAME) {
            setStaffOffice(assignedOffice);
          } else {
            setStaffOffice(null);
          }
        } else {
          setStaffOffice(null);
        }
      } catch (error) {
        console.error(
          'Failed to load staff office assignment:',
          error
        );

        if (mounted) {
          setStaffOffice(null);
        }
      } finally {
        if (mounted) {
          setAccessLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const fetchOfficesFromFirestore = async () => {
      try {
        // Only fetch the SWDS office.
        const officeQuery = query(
          collection(db, 'offices'),
          where('__name__', '==', OFFICE_NAME)
        );

        const querySnapshot = await getDocs(officeQuery);

        const fetchedOffices = {
          SWDS: { isBusy: false, reason: '' },
        };

        if (querySnapshot.empty) {
          await setDoc(
            doc(db, 'offices', OFFICE_NAME),
            {
              isBusy: false,
              reason: '',
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } else {
          querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();

            if (docSnap.id.toUpperCase() === OFFICE_NAME) {
              fetchedOffices.SWDS = {
                isBusy: !!data.isBusy,
                reason: data.reason || '',
              };
            }
          });
        }

        if (mounted) {
          setOffices(fetchedOffices);
        }
      } catch (error) {
        console.error(
          'Error fetching SWDS office from Firestore:',
          error
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchOfficesFromFirestore();

    return () => {
      mounted = false;
    };
  }, []);

  const canControlOffice = (officeKey) => {
    if (officeKey !== OFFICE_NAME) return false;

    if (isAdmin) return true;

    return staffOffice === officeKey;
  };

  const handleReasonChange = (officeKey, val) => {
    if (!canControlOffice(officeKey)) return;

    setOfficeReasons((prev) => ({
      ...prev,
      [officeKey]: val,
    }));
  };

  const handleToggleBooking = async (officeKey) => {
    if (!canControlOffice(officeKey)) {
      alert(
        `You are not authorized to modify the ${officeKey} Office. You can only manage your assigned office: ${staffOffice || 'None'}.`
      );
      return;
    }

    const currentStatus = offices[officeKey].isBusy;
    const newStatus = !currentStatus;
    const currentReason = officeReasons[officeKey];

    if (newStatus && !currentReason.trim()) {
      alert(
        `Please select a preset reason or type a custom reason before disabling bookings for ${officeKey}.`
      );
      return;
    }

    const finalReason = newStatus
      ? currentReason.trim()
      : '';

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
        [officeKey]: {
          isBusy: newStatus,
          reason: finalReason,
        },
      }));

      if (!newStatus) {
        setOfficeReasons((prev) => ({
          ...prev,
          [officeKey]: '',
        }));
      }

      setSuccessMessage(
        newStatus
          ? `Bookings successfully disabled for ${officeKey} Office in Firestore.`
          : `Bookings successfully enabled for ${officeKey} Office in Firestore.`
      );

      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (error) {
      console.error(
        'Error updating office status in Firestore:',
        error
      );

      alert(
        'Failed to update office status. Please check your Firestore connection/rules.'
      );
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
