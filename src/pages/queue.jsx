
import { useEffect, useState } from "react";
import { useAppointments } from "../hooks/useAppointments";
import { X } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { auth, db } from "../services/firebase";
import Swds from "../components/queue/swds";

const ADMIN_EMAIL = "qsystemssu123@gmail.com";
const OFFICE_NAME = "SWDS";

export default function Queue() {
  const {
    appointments,
    loading: appointmentsLoading,
    completeAppointment,
  } = useAppointments();

  const [currentUser, setCurrentUser] = useState(null);
  const [staffOffice, setStaffOffice] = useState(null);
  const [accessLoading, setAccessLoading] = useState(true);
  const [accessError, setAccessError] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);

  const isAdmin =
    currentUser?.email?.toLowerCase() ===
    ADMIN_EMAIL.toLowerCase();

  const isSwdsStaff =
    staffOffice?.toLowerCase() ===
    OFFICE_NAME.toLowerCase();

  const hasAccess = isAdmin || isSwdsStaff;

  useEffect(() => {
    let isMounted = true;

    const loadUserAccess = async (user) => {
      if (!isMounted) return;

      setCurrentUser(user);
      setStaffOffice(null);
      setAccessError("");
      setAccessLoading(true);

      if (!user) {
        setAccessLoading(false);
        return;
      }

      if (
        user.email?.toLowerCase() ===
        ADMIN_EMAIL.toLowerCase()
      ) {
        setAccessLoading(false);
        return;
      }

      try {
        if (!user.email) {
          throw new Error(
            "The current account does not have an email address."
          );
        }

        const staffQuery = query(
          collection(db, "staff"),
          where("email", "==", user.email)
        );

        const staffSnapshot = await getDocs(staffQuery);

        if (!isMounted) return;

        if (!staffSnapshot.empty) {
          const staffData = staffSnapshot.docs[0].data();

          const assignedOffice = String(
            staffData.office || ""
          )
            .trim()
            .toUpperCase();

          if (assignedOffice) {
            setStaffOffice(assignedOffice);
          }
        }
      } catch (error) {
        console.error(
          "Failed to load staff access:",
          error
        );

        if (isMounted) {
          setAccessError(
            error?.message ||
              "Unable to verify staff office access."
          );
        }
      } finally {
        if (isMounted) {
          setAccessLoading(false);
        }
      }
    };

    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        void loadUserAccess(user);
      },
      (error) => {
        console.error(
          "Authentication state error:",
          error
        );

        if (isMounted) {
          setCurrentUser(null);
          setStaffOffice(null);
          setAccessError(
            "Unable to verify your authentication session."
          );
          setAccessLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const swdsAppointments = (appointments || []).filter(
    (appointment) =>
      String(appointment?.office || "")
        .trim()
        .toUpperCase() === OFFICE_NAME
  );

  if (appointmentsLoading || accessLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm font-medium text-slate-500 animate-pulse">
          Loading live SWDS queue data...
        </p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="max-w-7xl mx-auto px-1 sm:px-0">
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 text-center">
          <h2 className="text-lg font-bold text-slate-900">
            Authentication Required
          </h2>

          <p className="text-sm text-slate-500 mt-2">
            Please log in to access SWDS Queue Management.
          </p>
        </div>
      </div>
    );
  }

  if (accessError) {
    return (
      <div className="max-w-7xl mx-auto px-1 sm:px-0">
        <div className="bg-white rounded-2xl shadow-xs border border-rose-200 p-6 text-center">
          <h2 className="text-lg font-bold text-rose-700">
            Unable to Verify Access
          </h2>

          <p className="text-sm text-slate-600 mt-2">
            {accessError}
          </p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="max-w-7xl mx-auto px-1 sm:px-0">
        <div className="bg-white rounded-2xl shadow-xs border border-amber-200 p-6 text-center">
          <h2 className="text-lg font-bold text-slate-900">
            Access Restricted
          </h2>

          <p className="text-sm text-slate-500 mt-2">
            This queue management page is exclusively for
            SWDS staff and authorized administrators.
          </p>

          {staffOffice && (
            <p className="text-xs text-slate-500 mt-3">
              Your assigned office:{" "}
              <span className="font-semibold text-slate-700">
                {staffOffice}
              </span>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-1 sm:px-0">
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }

          to {
            opacity: 1;
          }
        }

        .animate-fade-in-slow {
          animation: fadeIn 1s ease-in-out;
        }
      `}</style>

      {/* SWDS Queue Management Header */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-4 sm:p-5 animate-fade-in-slow">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Live Queue Management
            </h1>

            <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
              Manage, approve, complete, or reject student
              appointments in real-time for{" "}
              <span className="font-semibold text-slate-700">
                {OFFICE_NAME}
              </span>
              .
            </p>
          </div>

          {/* Only SWDS is displayed */}
          {isAdmin ? (
            <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 w-full lg:w-auto shadow-inner">
              <div className="w-full lg:w-auto px-5 py-2.5 text-center text-xs font-bold rounded-xl bg-white text-blue-700 shadow-md border-2 border-blue-500">
                {OFFICE_NAME}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-inner">
              Office Assignment:{" "}
              <span className="text-blue-600">
                {staffOffice || OFFICE_NAME}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* SWDS Queue Component */}
      <div
        key={OFFICE_NAME}
        className="animate-fade-in-slow"
      >
        <Swds
          appointments={swdsAppointments}
          completeAppointment={completeAppointment}
          setSelectedImage={setSelectedImage}
        />
      </div>

      {/* Priority ID Image Viewer */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in-slow"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedImage(null);
            }
          }}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 relative shadow-xl border border-slate-200 flex flex-col items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="swds-priority-image-title"
          >
            <div className="flex items-center justify-between w-full mb-4">
              <h3
                id="swds-priority-image-title"
                className="text-sm sm:text-base font-bold text-slate-900"
              >
                PWD / Senior Citizen ID
              </h3>

              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                aria-label="Close priority ID image"
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="w-full bg-slate-100 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center max-h-[350px] sm:max-h-[400px]">
              <img
                src={selectedImage}
                alt="Priority ID Verification"
                className="object-contain max-h-[350px] sm:max-h-[400px] w-full"
              />
            </div>

            <div className="mt-5 w-full flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
