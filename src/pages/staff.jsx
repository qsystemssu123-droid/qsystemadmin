import { useState, useEffect } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { collection, doc, setDoc, deleteDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { 
  ShieldUser, 
  UserPlus, 
  Mail, 
  Lock, 
  Building2, 
  Trash2, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Users,
  Search,
  User,
  KeyRound
} from 'lucide-react';

export default function Staff() {
  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [office, setOffice] = useState('CLINIC');

  // UI states
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Reusable fetch logic for manual refreshes
  const fetchStaff = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "staff"));
      const staffArray = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setStaffList(staffArray);
    } catch (err) {
      console.error("Error fetching staff:", err);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function loadInitialStaff() {
      try {
        const querySnapshot = await getDocs(collection(db, "staff"));
        if (isMounted) {
          const staffArray = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setStaffList(staffArray);
        }
      } catch (err) {
        if (isMounted) {
          console.error("Error fetching staff:", err);
        }
      }
    }

    loadInitialStaff();

    return () => {
      isMounted = false;
    };
  }, []);

  // Handle adding new staff member
  const handleAddStaff = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const firebaseConfig = auth.app.options;
      const secondaryAppName = "SecondaryStaffApp";
      const secondaryApp = !getApps().some(app => app.name === secondaryAppName) 
        ? initializeApp(firebaseConfig, secondaryAppName) 
        : getApp(secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);

      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const uid = userCredential.user.uid;

      await setDoc(doc(db, "staff", uid), {
        name: name,
        email: email,
        office: office,
        createdAt: serverTimestamp()
      });

      await signOut(secondaryAuth);

      setName('');
      setEmail('');
      setPassword('');
      setOffice('CLINIC');
      setSuccessMsg('Staff member successfully created and assigned!');

      fetchStaff();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle resetting staff password
  const handleResetPassword = async (staffEmail) => {
    if (!window.confirm(`Send a password reset link to ${staffEmail}?`)) return;

    setError('');
    setSuccessMsg('');

    try {
      await sendPasswordResetEmail(auth, staffEmail);
      setSuccessMsg(`Password reset email successfully sent to ${staffEmail}.`);
    } catch (err) {
      setError("Failed to send password reset email: " + err.message);
    }
  };

  // Handle deleting staff member
  const handleDeleteStaff = async (uid) => {
    if (!window.confirm("Are you sure you want to delete this staff member?")) return;

    try {
      await deleteDoc(doc(db, "staff", uid));
      setSuccessMsg('Staff record removed successfully.');
      fetchStaff();
    } catch (err) {
      setError("Failed to delete staff: " + err.message);
    }
  };

  // Filter staff list based on search term
  const filteredStaff = staffList.filter(staff => 
    staff.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    staff.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    staff.office?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl shadow-xs border border-slate-200/60">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldUser className="w-7 h-7 text-sky-600" />
            Staff Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Create administrative accounts, manage office assignments, and monitor active personnel.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-sky-50 text-sky-800 px-4 py-2 rounded-xl text-sm font-medium border border-sky-100 self-start sm:self-auto">
          <Users className="w-4 h-4" />
          <span>Total Staff: <strong>{staffList.length}</strong></span>
        </div>
      </div>

      {/* Feedback Alerts */}
      {error && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3.5 rounded-xl text-sm animate-in fade-in duration-200">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3.5 rounded-xl text-sm animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Grid Layout: Add Form & Staff Directory */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Add New Staff Form */}
        <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-xs border border-slate-200/60 h-fit">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <UserPlus className="w-5 h-5 text-sky-600" />
            Add Staff Member
          </h2>

          <form onSubmit={handleAddStaff} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Full Name</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </span>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="e.g. John Doe"
                  required 
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Email Address</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </span>
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  placeholder="staff@ssu.edu.ph"
                  required 
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="••••••••"
                  required 
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Assigned Office</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Building2 className="w-4 h-4" />
                </span>
                <select 
                  value={office} 
                  onChange={(e) => setOffice(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all cursor-pointer"
                >
                  <option value="CLINIC">CLINIC</option>
                  <option value="OSAS">OSAS</option>
                  <option value="SWDS">SWDS</option>
                </select>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2.5 px-4 rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Create Staff Account</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Staff List Table & Search */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-xs border border-slate-200/60 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-sky-600" />
              Registered Staff Directory
            </h2>
            
            {/* Search filter input */}
            <div className="relative w-full sm:w-64">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input 
                type="text"
                placeholder="Search staff..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="flex-1 mt-4">
            {filteredStaff.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                <Users className="w-12 h-12 stroke-1 mb-2 text-slate-300" />
                <p className="text-base font-semibold text-slate-600">No staff accounts found</p>
                <p className="text-xs text-slate-400 mt-1">Try adding a new staff member using the form on the left.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50/70">
                      <th className="py-3 px-4 rounded-l-xl">Name</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Office</th>
                      <th className="py-3 px-4 text-right rounded-r-xl">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredStaff.map((staff) => (
                      <tr key={staff.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                          {staff.name}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                          {staff.email}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-50 text-sky-700 border border-sky-100">
                            {staff.office}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => handleResetPassword(staff.email)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
                              title="Send Password Reset Email"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              <span>Reset</span>
                            </button>
                            <button 
                              onClick={() => handleDeleteStaff(staff.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                              title="Delete Staff Account"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}