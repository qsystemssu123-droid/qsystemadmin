
import { useState, useEffect } from 'react';
import { db, auth } from '../services/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { ADMIN_EMAIL } from '../utils/announcementConstants';

const OFFICE_NAME = 'SWDS';

const createEmptyOffice = () => ({
  isBusy: false,
  reason: '',
  unavailableFrom: '',
  resumeAt: '',
});

const toDateTimeLocal = (value) => {
  if (!value) return '';

  try {
    const date =
      typeof value === 'object' && typeof value.toDate === 'function'
        ? value.toDate()
        : new Date(value);

    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return '';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch (error) {
    console.error('Error formatting office schedule:', error);
    return '';
  }
};

const toISOString = (value) => {
  if (!value) return '';

  try {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toISOString();
  } catch (error) {
    console.error('Error converting office schedule:', error);
    return '';
  }
};

export function useAnnouncementData() {
  const [offices, setOffices] = useState({
    SWDS: createEmptyOffice(),
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
        const officeDocRef = doc(db, 'offices', OFFICE_NAME);
        const officeSnapshot = await getDoc(officeDocRef);

        const fetchedOffices = {
          SWDS: createEmptyOffice(),
        };

        if (!officeSnapshot.exists()) {
          await setDoc(
            officeDocRef,
            {
              ...createEmptyOffice(),
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } else {
          const data = officeSnapshot.data();

          fetchedOffices.SWDS = {
            isBusy: !!data.isBusy,
            reason: data.reason || '',
            unavailableFrom: toDateTimeLocal(
              data.unavailableFrom
            ),
            resumeAt: toDateTimeLocal(data.resumeAt),
          };
        }

        if (mounted) {
          setOffices(fetchedOffices);

          setOfficeReasons({
            SWDS: fetchedOffices.SWDS.reason,
          });
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

  const handleScheduleChange = (officeKey, field, value) => {
    if (!canControlOffice(officeKey)) return;

    if (
      field !== 'unavailableFrom' &&
      field !== 'resumeAt'
    ) {
      return;
    }

    setOffices((prev) => ({
      ...prev,
      [officeKey]: {
        ...prev[officeKey],
        [field]: value,
      },
    }));
  };

  const validateSchedule = (officeKey) => {
    const office = offices[officeKey];

    if (!office.unavailableFrom || !office.resumeAt) {
      alert(
        'Please select both the unavailable date/time and the booking resume date/time.'
      );
      return null;
    }

    const unavailableDate = new Date(office.unavailableFrom);
    const resumeDate = new Date(office.resumeAt);

    if (
      Number.isNaN(unavailableDate.getTime()) ||
      Number.isNaN(resumeDate.getTime())
    ) {
      alert('Please enter valid unavailable and resume date/times.');
      return null;
    }

    if (resumeDate <= unavailableDate) {
      alert(
        'The booking resume date and time must be later than the unavailable date and time.'
      );
      return null;
    }

    return {
      unavailableFrom: toISOString(office.unavailableFrom),
      resumeAt: toISOString(office.resumeAt),
    };
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

    let schedule = {
      unavailableFrom: '',
      resumeAt: '',
    };

    if (newStatus) {
      const validatedSchedule = validateSchedule(officeKey);

      if (!validatedSchedule) return;

      schedule = validatedSchedule;
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
          unavailableFrom: schedule.unavailableFrom,
          resumeAt: schedule.resumeAt,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      setOffices((prev) => ({
        ...prev,
        [officeKey]: {
          ...prev[officeKey],
          isBusy: newStatus,
          reason: finalReason,
          unavailableFrom: newStatus
            ? prev[officeKey].unavailableFrom
            : '',
          resumeAt: newStatus
            ? prev[officeKey].resumeAt
            : '',
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
          ? `Bookings successfully disabled for ${officeKey} Office. The unavailable and resume schedule has been saved to Firestore.`
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

  const handleSaveSchedule = async (officeKey) => {
    if (!canControlOffice(officeKey)) {
      alert(
        `You are not authorized to modify the ${officeKey} Office.`
      );
      return;
    }

    if (!offices[officeKey].isBusy) {
      alert('Disable bookings before updating the unavailable schedule.');
      return;
    }

    const currentReason = officeReasons[officeKey];

    if (!currentReason.trim()) {
      alert('Please provide a reason for the office unavailability.');
      return;
    }

    const validatedSchedule = validateSchedule(officeKey);

    if (!validatedSchedule) return;

    setActionLoading(officeKey);

    try {
      await setDoc(
        doc(db, 'offices', officeKey),
        {
          isBusy: true,
          reason: currentReason.trim(),
          unavailableFrom: validatedSchedule.unavailableFrom,
          resumeAt: validatedSchedule.resumeAt,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      setOffices((prev) => ({
        ...prev,
        [officeKey]: {
          ...prev[officeKey],
          isBusy: true,
          reason: currentReason.trim(),
          unavailableFrom: offices[officeKey].unavailableFrom,
          resumeAt: offices[officeKey].resumeAt,
        },
      }));

      setSuccessMessage(
        `The ${officeKey} unavailable and resume schedule has been updated successfully.`
      );

      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (error) {
      console.error(
        'Error updating office schedule in Firestore:',
        error
      );

      alert(
        'Failed to update the office schedule. Please check your Firestore connection/rules.'
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
    handleScheduleChange,
    handleToggleBooking,
    handleSaveSchedule,
  };
}
