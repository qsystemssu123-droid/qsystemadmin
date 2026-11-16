import { useState, useEffect } from 'react';
import UsersHeader from '../components/users/UsersHeader.jsx';
import UsersTable from '../components/users/UsersTable.jsx';
import BanUserModal from '../components/users/BanUserModal.jsx';
import UsersDatabaseNote from '../components/users/UsersDatabaseNote.jsx';
import {
  fetchUsers,
  unbanUser,
  banUser,
} from '../services/usersService.js';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const [banModalUser, setBanModalUser] = useState(null);
  const [durationValue, setDurationValue] = useState('1');
  const [durationUnit, setDurationUnit] = useState('days');

  useEffect(() => {
    async function loadUsers() {
      try {
        const userList = await fetchUsers();
        setUsers(userList);
      } catch (error) {
        console.error(
          'Error fetching user profiles from Firestore:',
          error
        );
      } finally {
        setLoading(false);
      }
    }

    loadUsers();
  }, []);

  const handleToggleBan = async (
    uid,
    currentBanStatus,
    userData
  ) => {
    if (currentBanStatus) {
      try {
        setActionLoading(uid);

        await unbanUser(uid);

        setUsers((prevUsers) =>
          prevUsers.map((user) =>
            user.uid === uid
              ? {
                  ...user,
                  banned: false,
                  expiresAt: null,
                }
              : user
          )
        );
      } catch (error) {
        console.error(
          'Error updating user ban status:',
          error
        );

        alert(
          'Failed to update ban status. Please check console.'
        );
      } finally {
        setActionLoading(null);
      }
    } else {
      setDurationValue('1');
      setDurationUnit('days');
      setBanModalUser(userData);
    }
  };

  const confirmBan = async (userData) => {
    const uid = userData.uid || userData.id;

    try {
      setActionLoading(uid);

      const result = await banUser(
        userData,
        durationValue,
        durationUnit
      );

      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user.uid === result.uid
            ? {
                ...user,
                banned: true,
                expiresAt: result.expiresAt,
              }
            : user
        )
      );

      setBanModalUser(null);
    } catch (error) {
      console.error(
        'Error banning user with duration:',
        error
      );

      alert(
        'Failed to apply ban. Please check console.'
      );
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm font-medium text-slate-500 animate-pulse">
          Loading user accounts...
        </p>
      </div>
    );
  }

  return (
    <div
      className="space-y-6 max-w-7xl mx-auto"
      style={{ animation: 'fadeIn 1s ease-in-out' }}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

      <UsersHeader userCount={users.length} />

      <div className="bg-white rounded-3xl shadow-xs border border-slate-200 overflow-hidden">
        <UsersTable
          users={users}
          actionLoading={actionLoading}
          onToggleBan={handleToggleBan}
        />
      </div>

      <BanUserModal
        user={banModalUser}
        durationValue={durationValue}
        durationUnit={durationUnit}
        actionLoading={actionLoading}
        onDurationValueChange={setDurationValue}
        onDurationUnitChange={setDurationUnit}
        onClose={() => setBanModalUser(null)}
        onConfirm={confirmBan}
      />

      <UsersDatabaseNote />
    </div>
  );
}