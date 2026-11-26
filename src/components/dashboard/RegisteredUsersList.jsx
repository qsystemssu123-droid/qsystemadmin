
import { useEffect, useState } from 'react';
import { Users, Loader2, AlertCircle } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';

export default function RegisteredUsersList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const fetchRegisteredUsers = async () => {
      try {
        setLoading(true);
        setError('');

        // Fetch ALL users directly from Firestore
        const usersSnapshot = await getDocs(
          collection(db, 'users')
        );

        const fetchedUsers = usersSnapshot.docs.map((userDoc) => {
          const data = userDoc.data();

          return {
            uid: data.uid || userDoc.id,
            name:
              data.displayName ||
              data.name ||
              data.fullName ||
              'Unnamed User',
            email: data.email || 'No email available',
            photoURL: data.photoURL || '',
            createdAt: data.createdAt || null,
            role: data.role || 'User',
          };
        });

        // Sort users by registration date (newest first)
        fetchedUsers.sort((a, b) => {
          const dateA = a.createdAt?.toMillis
            ? a.createdAt.toMillis()
            : 0;

          const dateB = b.createdAt?.toMillis
            ? b.createdAt.toMillis()
            : 0;

          return dateB - dateA;
        });

        if (isMounted) {
          setUsers(fetchedUsers);
        }
      } catch (err) {
        console.error('Error fetching registered users:', err);

        if (isMounted) {
          setError(
            err.code === 'permission-denied'
              ? 'Permission denied. Check your Firestore security rules.'
              : 'Failed to load registered users. Please try again.'
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchRegisteredUsers();

    return () => {
      isMounted = false;
    };
  }, []);

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Registration date unavailable';

    try {
      const date = timestamp.toDate
        ? timestamp.toDate()
        : new Date(timestamp);

      if (Number.isNaN(date.getTime())) {
        return 'Registration date unavailable';
      }

      return date.toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Registration date unavailable';
    }
  };

  return (
    <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-xs border border-sky-100 flex flex-col justify-between transition-all duration-300 hover:shadow-md">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600 shrink-0" />
            Registered System Users
          </h2>

          <span className="self-start sm:self-auto text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
            {loading ? 'Loading...' : `${users.length} Users`}
          </span>
        </div>

        <div className="space-y-3 mt-4 max-h-[380px] overflow-y-auto pr-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <Loader2 className="w-7 h-7 animate-spin text-indigo-600 mb-3" />
              <p className="text-xs font-medium">
                Loading all registered users...
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <AlertCircle className="w-7 h-7 text-red-500 mb-2" />
              <p className="text-xs font-semibold text-red-600">
                {error}
              </p>
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <Users className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-xs font-medium">
                No registered users found.
              </p>
            </div>
          ) : (
            users.map((u) => (
              <div
                key={u.uid}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 transition-all hover:bg-sky-50/50 hover:border-sky-200"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden border border-indigo-200">
                    {u.photoURL ? (
                      <img
                        src={u.photoURL}
                        alt={u.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      u.name.charAt(0).toUpperCase()
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800 truncate">
                      {u.name}
                    </p>

                    <p className="text-[11px] text-slate-500 truncate max-w-[150px] sm:max-w-xs md:max-w-sm">
                      {u.email}
                    </p>

                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Joined {formatDate(u.createdAt)}
                    </p>
                  </div>
                </div>

                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 shrink-0">
                  {u.role}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-sky-100 flex items-center justify-between text-xs text-slate-500">
        <span>Firestore Database</span>
        <span className="font-semibold text-indigo-600">
          {loading
            ? 'Fetching Records'
            : error
              ? 'Fetch Failed'
              : 'Verified Records'}
        </span>
      </div>
    </div>
  );
}
