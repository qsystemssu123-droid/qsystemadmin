import { useEffect, useState } from 'react';
import { 
  getFirestore, 
  collection, 
  query, 
  orderBy,
  onSnapshot,
  doc,
  deleteDoc 
} from 'firebase/firestore';

function Feedback() {
  const [feedbackList, setFeedbackList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Inject keyframe animation for the 2-second fade-in effect
    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = `
      @keyframes fadeInSmooth {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `;
    document.head.appendChild(styleSheet);

    const db = getFirestore();
    // Query feedback sorted by creation date descending (newest first)
    const q = query(collection(db, 'feedback'), orderBy('createdAt', 'desc'));

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      q, 
      (querySnapshot) => {
        const feedbacks = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        
        setFeedbackList(feedbacks);
        setLoading(false);
      },
      (error) => {
        console.error('Error listening to feedback:', error);
        setLoading(false);
      }
    );

    // Cleanup subscription and injected style on unmount
    return () => {
      unsubscribe();
      if (styleSheet.parentNode) {
        styleSheet.parentNode.removeChild(styleSheet);
      }
    };
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this feedback?')) {
      try {
        const db = getFirestore();
        await deleteDoc(doc(db, 'feedback', id));
      } catch (error) {
        console.error('Error deleting feedback:', error);
        alert('Failed to delete feedback. Please try again.');
      }
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-50 p-[clamp(15px,3vw,30px)] box-border font-['Segoe_UI',Tahoma,Geneva,Verdana,sans-serif] animate-[fadeInSmooth_2s_ease-in-out]">
      <div className="mb-6">
        <h1 className="text-[clamp(22px,2.5vw,28px)] font-bold text-slate-900 mb-1.5">User Feedback Dashboard</h1>
        <p className="text-[clamp(13px,1.5vw,15px)] text-slate-500 m-0">Review what users are saying about the application.</p>
      </div>

      {loading ? (
        <div className="text-center py-[60px] px-5 text-base text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-sm">Loading feedback...</div>
      ) : feedbackList.length === 0 ? (
        <div className="text-center py-[60px] px-5 text-base text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-sm">No feedback found yet.</div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5 w-full">
          {feedbackList.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl p-5 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05),0_2px_4px_-2px_rgba(0,0,0,0.05)] flex flex-col justify-between border border-slate-200 transition-all duration-200 ease-in-out box-border hover:shadow-md">
              <div className="flex items-center mb-4 gap-3">
                {item.userPhoto ? (
                  <img src={item.userPhoto} alt={item.userName} className="w-12 h-12 rounded-full object-cover border-2 border-slate-200 shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold text-lg shrink-0">
                    {item.userName ? item.userName.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-semibold text-slate-800 m-0 mb-0.5 truncate">{item.userName || 'Anonymous User'}</h3>
                  <p className="text-[13px] text-slate-500 m-0 truncate">{item.userEmail || 'No email provided'}</p>
                </div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 border-l-4 border-l-sky-600 mb-4 grow">
                <p className="text-[14px] text-slate-700 leading-relaxed m-0 break-words">"{item.feedback}"</p>
              </div>

              <div className="flex justify-between items-center border-t border-slate-100 pt-3 gap-2">
                <span className="text-[12px] text-slate-500 bg-slate-100 py-1 px-2.5 rounded-full font-medium">
                  {item.createdAt?.toDate 
                    ? item.createdAt.toDate().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) 
                    : 'Just now'}
                </span>
                <button 
                  onClick={() => handleDelete(item.id)}
                  className="bg-red-100 text-red-600 border-none py-1.5 px-3 rounded-lg text-[12px] font-semibold cursor-pointer transition-colors duration-200 hover:bg-red-200"
                  title="Delete Feedback"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Feedback;