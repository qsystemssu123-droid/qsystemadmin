import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase.js';

export async function fetchUsers() {
  const [usersSnapshot, bannedSnapshot] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'Banned')),
  ]);

  const now = new Date();
  const activeBannedDocs = [];
  const expiredIds = [];
  const banDetailsMap = {};

  bannedSnapshot.docs.forEach((docItem) => {
    const data = docItem.data();

    const expiresAt = data.expiresAt?.toDate
      ? data.expiresAt.toDate()
      : data.expiresAt?.seconds
        ? new Date(data.expiresAt.seconds * 1000)
        : data.expiresAt
          ? new Date(data.expiresAt)
          : null;

    if (expiresAt && expiresAt <= now) {
      expiredIds.push(docItem.id);
    } else {
      activeBannedDocs.push(docItem.id);
      banDetailsMap[docItem.id] = data;
    }
  });

  if (expiredIds.length > 0) {
    await Promise.all(
      expiredIds.map((id) => deleteDoc(doc(db, 'Banned', id)))
    );
  }

  const bannedIds = new Set(activeBannedDocs);

  return usersSnapshot.docs.map((docItem) => {
    const uid = docItem.id;
    const userData = docItem.data();
    const isBannedInCollection = bannedIds.has(uid);
    const banData = banDetailsMap[uid] || {};

    return {
      id: uid,
      uid,
      ...userData,
      banned: isBannedInCollection || !!userData.banned,
      expiresAt: banData.expiresAt || null,
    };
  });
}

export async function unbanUser(uid) {
  const bannedRef = doc(db, 'Banned', uid);
  await deleteDoc(bannedRef);
}

export function calculateBanExpiration(durationValue, durationUnit) {
  const now = new Date();
  const val = parseInt(durationValue) || 1;
  const expiresAt = new Date(now.getTime());

  if (durationUnit === 'hours') {
    expiresAt.setTime(now.getTime() + val * 60 * 60 * 1000);
  } else if (durationUnit === 'days') {
    expiresAt.setDate(now.getDate() + val);
  } else if (durationUnit === 'weeks') {
    expiresAt.setDate(now.getDate() + val * 7);
  } else if (durationUnit === 'months') {
    expiresAt.setMonth(now.getMonth() + val);
  } else if (durationUnit === 'years') {
    expiresAt.setFullYear(now.getFullYear() + val);
  }

  return {
    now,
    expiresAt,
    val,
  };
}

export async function banUser(userData, durationValue, durationUnit) {
  const uid = userData.uid || userData.id;

  const { now, expiresAt, val } = calculateBanExpiration(
    durationValue,
    durationUnit
  );

  const bannedRef = doc(db, 'Banned', uid);

  await setDoc(bannedRef, {
    ...userData,
    status: 'BANNED',
    bannedAt: now,
    expiresAt,
    banDurationText: `${val} ${durationUnit}`,
  });

  return {
    uid,
    expiresAt,
  };
}

export function formatDate(timestamp) {
  if (!timestamp) return 'Active Session';

  if (typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toLocaleString();
  }

  if (timestamp.seconds) {
    return new Date(timestamp.seconds * 1000).toLocaleString();
  }

  if (typeof timestamp === 'string') {
    return new Date(timestamp).toLocaleString();
  }

  return 'Active Session';
}