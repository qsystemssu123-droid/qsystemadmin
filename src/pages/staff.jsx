import { useState, useEffect } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail
} from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  getDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import {
  ShieldUser,
  UserPlus,
  Mail,
  Lock,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Users,
  Search,
  User,
  KeyRound,
  Briefcase,
  Save,
  RefreshCw,
  UserCheck
} from 'lucide-react';

// Automatically assigned office for all new staff accounts
const DEFAULT_STAFF_OFFICE = 'SWDS';

// SWDS services
const SWDS_SERVICES = [
  {
    id: 'admission_recruitment',
    name: 'Admission and Recruitment Services'
  },
  {
    id: 'psychological_wellness',
    name: 'Psychological and Wellness Services'
  },
  {
    id: 'guidance_counseling',
    name: 'Guidance and Counseling Services'
  },
  {
    id: 'information_orientation',
    name: 'Orientation and Information Services'
  },
  {
    id: 'career_placement_peso',
    name: 'Career and Placement Services and PESO'
  },
  {
    id: 'student_organizations',
    name: 'Student Organizations'
  },
  {
    id: 'special_needs_pwd',
    name: 'Services for Students with Special Needs & PWDs'
  },
  {
    id: 'economic_enterprise',
    name: 'Economic Enterprise Development'
  },
  {
    id: 'university_student_council',
    name: 'University Student Council'
  },
  {
    id: 'multi_faith',
    name: 'Multi-Faith Services'
  }
];

const ASSIGNMENT_DOC = 'swds_service_assignments';
const ASSIGNMENT_DOC_ID = 'current';

const normalizeOffice = (office) =>
  String(office || '').trim().toUpperCase();

export default function Staff() {
  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // UI states
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // SWDS assignment states
  const [serviceAssignments, setServiceAssignments] = useState({});
  const [originalAssignments, setOriginalAssignments] = useState({});
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [savingAssignments, setSavingAssignments] = useState(false);

  // Dynamically get every registered SWDS staff member.
  // No specific staff names, emails, or UIDs are hardcoded.
  const assignableStaff = staffList.filter(
    (staff) => normalizeOffice(staff.office) === DEFAULT_STAFF_OFFICE
  );

  // Reusable fetch logic for manual refreshes
  const fetchStaff = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'staff'));

      const staffArray = querySnapshot.docs.map((staffDoc) => ({
        id: staffDoc.id,
        ...staffDoc.data()
      }));

      setStaffList(staffArray);

      return staffArray;
    } catch (err) {
      console.error('Error fetching staff:', err);
      throw err;
    }
  };

  // Fetch saved SWDS service assignments
  const fetchAssignments = async () => {
    try {
      setLoadingAssignments(true);

      const assignmentRef = doc(
        db,
        ASSIGNMENT_DOC,
        ASSIGNMENT_DOC_ID
      );

      const assignmentSnapshot = await getDoc(assignmentRef);

      if (assignmentSnapshot.exists()) {
        const savedAssignments =
          assignmentSnapshot.data().assignments || {};

        setServiceAssignments(savedAssignments);
        setOriginalAssignments(savedAssignments);
      } else {
        setServiceAssignments({});
        setOriginalAssignments({});
      }
    } catch (err) {
      console.error('Error fetching SWDS assignments:', err);
      setError('Failed to load SWDS service assignments: ' + err.message);
    } finally {
      setLoadingAssignments(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      try {
        const staffSnapshot = await getDocs(collection(db, 'staff'));

        if (!isMounted) return;

        const staffArray = staffSnapshot.docs.map((staffDoc) => ({
          id: staffDoc.id,
          ...staffDoc.data()
        }));

        setStaffList(staffArray);

        await fetchAssignments();
      } catch (err) {
        if (isMounted) {
          console.error('Error loading staff management:', err);
          setError('Failed to load staff management data: ' + err.message);
          setLoadingAssignments(false);
        }
      }
    }

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Handle adding new staff member
  const handleAddStaff = async (e) => {
    e.preventDefault();

    setError('');
    setSuccessMsg('');

    // Office is automatically assigned as SWDS.
    // No office selection is required from the user.
    setLoading(true);

    let secondaryAuth = null;

    try {
      const firebaseConfig = auth.app.options;
      const secondaryAppName = 'SecondaryStaffApp';

      const secondaryApp = !getApps().some(
        (app) => app.name === secondaryAppName
      )
        ? initializeApp(firebaseConfig, secondaryAppName)
        : getApp(secondaryAppName);

      secondaryAuth = getAuth(secondaryApp);

      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        email.trim(),
        password
      );

      const uid = userCredential.user.uid;

      // Automatically save SWDS as the staff office in Firestore.
      await setDoc(doc(db, 'staff', uid), {
        name: name.trim(),
        email: email.trim(),
        office: DEFAULT_STAFF_OFFICE,
        createdAt: serverTimestamp()
      });

      await signOut(secondaryAuth);

      setName('');
      setEmail('');
      setPassword('');

      setSuccessMsg('Staff member successfully created and assigned!');

      await fetchStaff();
    } catch (err) {
      setError(err.message);

      if (secondaryAuth) {
        try {
          await signOut(secondaryAuth);
        } catch (signOutError) {
          console.error('Secondary authentication sign-out error:', signOutError);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle resetting staff password
  const handleResetPassword = async (staffEmail) => {
    if (!window.confirm(`Send a password reset link to ${staffEmail}?`)) {
      return;
    }

    setError('');
    setSuccessMsg('');

    try {
      await sendPasswordResetEmail(auth, staffEmail);

      setSuccessMsg(
        `Password reset email successfully sent to ${staffEmail}.`
      );
    } catch (err) {
      setError(
        'Failed to send password reset email: ' + err.message
      );
    }
  };

  // Handle deleting staff member
  const handleDeleteStaff = async (uid) => {
    const staffToDelete = staffList.find((staff) => staff.id === uid);

    if (!staffToDelete) {
      setError('Staff member not found.');
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to delete ${staffToDelete.name}? Any SWDS services assigned to this staff member will also become unassigned.`
      )
    ) {
      return;
    }

    setError('');
    setSuccessMsg('');

    try {
      // Remove the staff member from all SWDS service assignments
      const assignmentRef = doc(
        db,
        ASSIGNMENT_DOC,
        ASSIGNMENT_DOC_ID
      );

      const assignmentSnapshot = await getDoc(assignmentRef);

      if (assignmentSnapshot.exists()) {
        const currentAssignments =
          assignmentSnapshot.data().assignments || {};

        const updatedAssignments = { ...currentAssignments };

        Object.keys(updatedAssignments).forEach((serviceId) => {
          if (updatedAssignments[serviceId]?.staffId === uid) {
            delete updatedAssignments[serviceId];
          }
        });

        await setDoc(
          assignmentRef,
          {
            assignments: updatedAssignments,
            updatedAt: serverTimestamp()
          },
          { merge: true }
        );
      }

      // Remove staff record
      await deleteDoc(doc(db, 'staff', uid));

      setServiceAssignments((prev) => {
        const updated = { ...prev };

        Object.keys(updated).forEach((serviceId) => {
          if (updated[serviceId]?.staffId === uid) {
            delete updated[serviceId];
          }
        });

        return updated;
      });

      setOriginalAssignments((prev) => {
        const updated = { ...prev };

        Object.keys(updated).forEach((serviceId) => {
          if (updated[serviceId]?.staffId === uid) {
            delete updated[serviceId];
          }
        });

        return updated;
      });

      setSuccessMsg(
        'Staff record removed successfully. Related service assignments have been cleared.'
      );

      await fetchStaff();
    } catch (err) {
      setError('Failed to delete staff: ' + err.message);
    }
  };

  // Handle changing the assigned staff member for a service
  const handleServiceAssignmentChange = (serviceId, staffId) => {
    setServiceAssignments((prev) => {
      const updated = { ...prev };

      if (!staffId) {
        delete updated[serviceId];
        return updated;
      }

      const selectedStaff = assignableStaff.find(
        (staff) => staff.id === staffId
      );

      if (!selectedStaff) {
        return prev;
      }

      updated[serviceId] = {
        staffId: selectedStaff.id,
        staffName: selectedStaff.name,
        staffEmail: selectedStaff.email
      };

      return updated;
    });

    setError('');
    setSuccessMsg('');
  };

  // Save all SWDS service assignments to Firestore
  const handleSaveAssignments = async () => {
    setError('');
    setSuccessMsg('');

    setSavingAssignments(true);

    try {
      // Refresh the staff directory before saving to ensure
      // assignments reference currently registered SWDS staff.
      const latestStaffList = await getDocs(collection(db, 'staff'));

      const latestAssignableStaff = latestStaffList.docs
        .map((staffDoc) => ({
          id: staffDoc.id,
          ...staffDoc.data()
        }))
        .filter(
          (staff) =>
            normalizeOffice(staff.office) === DEFAULT_STAFF_OFFICE
        );

      setStaffList(
        latestStaffList.docs.map((staffDoc) => ({
          id: staffDoc.id,
          ...staffDoc.data()
        }))
      );

      const updatedAssignments = {};

      // Validate each selected staff member before saving
      for (const service of SWDS_SERVICES) {
        const assignment = serviceAssignments[service.id];

        if (!assignment?.staffId) {
          continue;
        }

        const selectedStaff = latestAssignableStaff.find(
          (staff) => staff.id === assignment.staffId
        );

        if (!selectedStaff) {
          throw new Error(
            `The assigned staff member for "${service.name}" is no longer available or is not registered under SWDS. Please select another staff member.`
          );
        }

        updatedAssignments[service.id] = {
          staffId: selectedStaff.id,
          staffName: selectedStaff.name || '',
          staffEmail: selectedStaff.email || ''
        };
      }

      const assignmentRef = doc(
        db,
        ASSIGNMENT_DOC,
        ASSIGNMENT_DOC_ID
      );

      await setDoc(assignmentRef, {
        office: DEFAULT_STAFF_OFFICE,
        assignments: updatedAssignments,
        updatedAt: serverTimestamp()
      });

      setServiceAssignments(updatedAssignments);
      setOriginalAssignments(updatedAssignments);

      setSuccessMsg(
        'SWDS service assignments successfully saved!'
      );
    } catch (err) {
      console.error('Error saving SWDS assignments:', err);
      setError('Failed to save service assignments: ' + err.message);
    } finally {
      setSavingAssignments(false);
    }
  };

  // Reset unsaved assignment changes
  const handleResetAssignments = () => {
    setServiceAssignments(originalAssignments);
    setError('');
    setSuccessMsg('Unsaved assignment changes have been discarded.');
  };

  // Check if there are unsaved changes
  const hasAssignmentChanges =
    JSON.stringify(serviceAssignments) !==
    JSON.stringify(originalAssignments);

  // Count assignments per staff member
  const getStaffAssignmentCount = (staffId) => {
    return Object.values(serviceAssignments).filter(
      (assignment) => assignment?.staffId === staffId
    ).length;
  };

  // Filter staff list based on search term
  const filteredStaff = staffList.filter(
    (staff) =>
      staff.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      staff.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      staff.office?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const assignedServiceCount = Object.keys(serviceAssignments).filter(
    (serviceId) =>
      SWDS_SERVICES.some((service) => service.id === serviceId) &&
      serviceAssignments[serviceId]?.staffId
  ).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-[fadeIn_2s_ease-in-out]">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl shadow-xs border border-slate-200/60">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldUser className="w-7 h-7 text-sky-600" />
            Staff Management
          </h1>

          <p className="text-sm text-slate-500 mt-1">
            Create administrative accounts, manage office assignments, assign SWDS services, and monitor active personnel.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-sky-50 text-sky-800 px-4 py-2 rounded-xl text-sm font-medium border border-sky-100 self-start sm:self-auto">
          <Users className="w-4 h-4" />
          <span>
            Total Staff: <strong>{staffList.length}</strong>
          </span>
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

      {/* SWDS Service Assignment Management */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200/60 space-y-6">

        {/* Assignment Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-sky-600" />
              SWDS Service Assignments
            </h2>

            <p className="text-sm text-slate-500 mt-1">
              Assign registered SWDS staff members to manage the different services.
              A staff member can handle multiple services, and assignments can be changed at any time.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-sky-50 text-sky-800 px-4 py-2 rounded-xl text-sm font-semibold border border-sky-100">
            <UserCheck className="w-4 h-4" />
            {assignedServiceCount} / {SWDS_SERVICES.length} Assigned
          </div>
        </div>

        {/* Staff Assignment Summary */}
        <div>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-sm font-bold text-slate-800">
              SWDS Staff Assignment Summary
            </h3>

            <span className="text-xs text-slate-400">
              {assignableStaff.length} Registered SWDS Staff
            </span>
          </div>

          {assignableStaff.length === 0 ? (
            <div className="p-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center">
              <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />

              <p className="text-sm font-semibold text-slate-600">
                No SWDS staff members found
              </p>

              <p className="text-xs text-slate-400 mt-1">
                Create a staff account and assign it to the SWDS office to make it available here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {assignableStaff.map((staff) => {
                const assignmentCount = getStaffAssignmentCount(staff.id);

                return (
                  <div
                    key={staff.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/70"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4" />
                        </div>

                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">
                            {staff.name || 'Unnamed Staff'}
                          </p>

                          <p className="text-xs text-slate-500 truncate">
                            {staff.email || 'No email available'}
                          </p>
                        </div>
                      </div>

                      <span className="text-xs font-bold text-sky-700 bg-sky-100 px-2.5 py-1 rounded-lg whitespace-nowrap">
                        {assignmentCount} {assignmentCount === 1 ? 'Service' : 'Services'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Service Assignment List */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Service Assignment Directory
              </h3>

              <p className="text-xs text-slate-500 mt-1">
                Select which registered SWDS staff member is responsible for each service.
              </p>
            </div>

            <span className="text-xs text-slate-400">
              {SWDS_SERVICES.length} SWDS Services
            </span>
          </div>

          {loadingAssignments ? (
            <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-sky-600" />
              <span className="text-sm">Loading service assignments...</span>
            </div>
          ) : (
            <div className="space-y-3">
              {SWDS_SERVICES.map((service, index) => {
                const currentAssignment =
                  serviceAssignments[service.id];

                const assignedStaff = assignableStaff.find(
                  (staff) => staff.id === currentAssignment?.staffId
                );

                return (
                  <div
                    key={service.id}
                    className="flex flex-col md:flex-row md:items-center gap-3 p-4 rounded-xl border border-slate-200 hover:border-sky-200 hover:bg-sky-50/30 transition-all"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center text-sm font-bold shrink-0">
                        {index + 1}
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800">
                          {service.name}
                        </p>

                        <p className="text-xs text-slate-400 mt-0.5">
                          {assignedStaff
                            ? `Assigned to ${assignedStaff.name}`
                            : currentAssignment?.staffName
                              ? 'Previously assigned staff is unavailable'
                              : 'No staff assigned yet'}
                        </p>
                      </div>
                    </div>

                    <div className="w-full md:w-72 shrink-0">
                      <select
                        value={assignedStaff?.id || ''}
                        onChange={(e) =>
                          handleServiceAssignmentChange(
                            service.id,
                            e.target.value
                          )
                        }
                        disabled={assignableStaff.length === 0}
                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <option value="">
                          -- Unassigned --
                        </option>

                        {assignableStaff.map((staff) => (
                          <option
                            key={staff.id}
                            value={staff.id}
                          >
                            {staff.name || 'Unnamed Staff'} ({staff.email || 'No email'})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Assignment Actions */}
          {!loadingAssignments && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-6 pt-5 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                Changes will only take effect after saving.
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetAssignments}
                  disabled={!hasAssignmentChanges || savingAssignments}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reset Changes
                </button>

                <button
                  type="button"
                  onClick={handleSaveAssignments}
                  disabled={!hasAssignmentChanges || savingAssignments || assignableStaff.length === 0}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 transition-all shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingAssignments ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Assignments
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Grid Layout: Add Form & Staff Directory */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Column: Add New Staff Form */}
        <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-xs border border-slate-200/60 h-fit">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <UserPlus className="w-5 h-5 text-sky-600" />
            Add Staff Member
          </h2>

          <form onSubmit={handleAddStaff} className="space-y-4">

            {/* Full Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Full Name
              </label>

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

            {/* Email Address */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Email Address
              </label>

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

            {/* Password */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Password
              </label>

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

            {/*
              Assigned Office dropdown removed from the UI.

              All newly created staff accounts are automatically
              assigned to SWDS through DEFAULT_STAFF_OFFICE.

              The office field is still saved in Firestore.
            */}

            {/* Create Staff Button */}
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

                <p className="text-base font-semibold text-slate-600">
                  No staff accounts found
                </p>

                <p className="text-xs text-slate-400 mt-1">
                  Try adding a new staff member using the form on the left.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50/70">
                      <th className="py-3 px-4 rounded-l-xl">
                        Name
                      </th>

                      <th className="py-3 px-4">
                        Email
                      </th>

                      <th className="py-3 px-4">
                        Office
                      </th>

                      <th className="py-3 px-4 text-right rounded-r-xl">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredStaff.map((staff) => (
                      <tr
                        key={staff.id}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
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

                            {/* Reset Password */}
                            <button
                              onClick={() =>
                                handleResetPassword(staff.email)
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
                              title="Send Password Reset Email"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              <span>Reset</span>
                            </button>

                            {/* Delete Staff */}
                            <button
                              onClick={() =>
                                handleDeleteStaff(staff.id)
                              }
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