import { useState, useEffect } from 'react';
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  onSnapshot 
} from 'firebase/firestore';

export default function Ratings() {
  const [completedAppointments, setCompletedAppointments] = useState([]);
  const [ratingsMap, setRatingsMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = getFirestore();

    // Query completed appointments
    const qAppointments = query(
      collection(db, "appointments"),
      where("status", "==", "completed")
    );

    const unsubscribeAppointments = onSnapshot(
      qAppointments,
      (snapshot) => {
        const appointmentsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        
        // Sort by createdAt descending if available
        appointmentsData.sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return timeB - timeA;
        });

        setCompletedAppointments(appointmentsData);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching completed appointments:", error);
        setLoading(false);
      }
    );

    // Query all ratings to map them by appointmentId / userId
    const qRatings = collection(db, "rating");
    const unsubscribeRatings = onSnapshot(
      qRatings,
      (snapshot) => {
        const map = {};
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          if (data.appointmentId) {
            map[data.appointmentId] = data;
          }
        });
        setRatingsMap(map);
      },
      (error) => {
        console.error("Error fetching ratings:", error);
      }
    );

    return () => {
      unsubscribeAppointments();
      unsubscribeRatings();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] bg-slate-50 animate-fade-in-1s">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-semibold text-slate-500">Loading user ratings and appointments...</p>
      </div>
    );
  }

  return (
    <div className="p-8 bg-slate-50 min-h-screen font-sans animate-fade-in-1s">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-slate-900 m-0">User Ratings & Feedback</h1>
        <p className="text-sm text-slate-500 mt-1.5 mb-0">Monitor completed appointments and user reviews in real time.</p>
      </div>

      {completedAppointments.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center border border-slate-200">
          <p className="text-base text-slate-500 font-semibold m-0">No completed appointments found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-5">
          {completedAppointments.map((item) => {
            const ratingData = ratingsMap[item.id];

            return (
              <div key={item.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-start mb-4 gap-2.5">
                  <div className="flex items-center gap-3">
                    {item.userPhoto ? (
                      <img src={item.userPhoto} alt={item.userName || "User"} className="w-11 h-11 rounded-full object-cover border-2 border-slate-200" />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg">
                        {(item.userName || item.userEmail || "U").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h3 className="text-[15px] font-bold text-slate-800 m-0">{item.userName || "Anonymous User"}</h3>
                      <p className="text-xs text-slate-500 mt-0.5 mb-0">{item.userEmail || "No email provided"}</p>
                    </div>
                  </div>
                  <span className="bg-emerald-50 text-emerald-600 text-[10px] font-extrabold px-2 py-1.5 rounded-lg border border-emerald-100 whitespace-nowrap">
                    ✓ COMPLETED
                  </span>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 mb-4 flex flex-col gap-2">
                  <div className="flex justify-between items-center text-[13px]">
                    <span className="text-slate-500 font-semibold">Office:</span>
                    <span className="text-slate-900 font-bold">{item.office}</span>
                  </div>
                  <div className="flex justify-between items-center text-[13px]">
                    <span className="text-slate-500 font-semibold">Service:</span>
                    <span className="text-slate-900 font-bold">{item.service}</span>
                  </div>
                  <div className="flex justify-between items-center text-[13px]">
                    <span className="text-slate-500 font-semibold">Queue Number:</span>
                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-bold text-xs">{item.queueNumber}</span>
                  </div>
                  <div className="flex justify-between items-center text-[13px]">
                    <span className="text-slate-500 font-semibold">Scheduled:</span>
                    <span className="text-slate-900 font-bold">
                      {item.appointmentDate ? `${item.appointmentDate} at ${item.appointmentTime}` : 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3.5">
                  <h4 className="text-[13px] font-bold text-slate-700 mb-2 mt-0">User Rating & Review</h4>
                  {ratingData ? (
                    <div>
                      <div className="flex items-center gap-1 mb-1.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span key={star} className={`text-lg ${star <= ratingData.rating ? 'text-amber-500' : 'text-slate-300'}`}>
                            {star <= ratingData.rating ? '★' : '☆'}
                          </span>
                        ))}
                        <span className="text-[13px] font-bold text-slate-600 ml-1.5">({ratingData.rating}/5)</span>
                      </div>
                      <p className="text-[13px] text-slate-600 italic my-1 leading-normal">
                        "{ratingData.reviewText || "No review text provided."}"
                      </p>
                      <span className="text-[11px] text-slate-400">
                        Rated on: {ratingData.createdAt?.toDate ? ratingData.createdAt.toDate().toLocaleString() : 'Recent'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-amber-50 px-3 py-2.5 rounded-lg border border-amber-100">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      <span className="text-xs text-amber-800 font-semibold">No rating submitted yet by this user.</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Inject keyframes globally for the smooth 1-second Tailwind fade-in animation
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = `
    @keyframes fadeInOneSecond {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
    .animate-fade-in-1s {
      animation: fadeInOneSecond 1s ease-in-out forwards;
    }
  `;
  document.head.appendChild(styleSheet);
}