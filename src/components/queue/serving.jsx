
import {
  CheckCheck,
  Users,
  Loader2,
} from "lucide-react";

import {
  ReasonForVisit,
  ViewPriorityImage,
} from "./pending";

export default function Serving({
  currentServing,
  officeName,
  getServiceLabel,
  processingId,
  handleCompleteAppointment,
  setSelectedImage,
}) {
  return (
    <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-xs border border-slate-200 text-center flex flex-col items-center justify-between">
      <div className="w-full">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
          Now Serving ({officeName})
        </span>

        {currentServing ? (
          <div className="flex flex-col items-center">
            <span className="text-4xl sm:text-5xl font-black text-purple-600 my-2 font-mono break-all">
              {currentServing.queueNumber || "N/A"}
            </span>

            <p className="font-semibold text-slate-800 text-base sm:text-lg mt-1 px-2 break-words">
              {currentServing.userName || "Unknown Student"}
            </p>

            <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100 my-1 max-w-full break-words">
              {currentServing.office} -{" "}
              {getServiceLabel(currentServing)}
            </span>

            <ReasonForVisit
              item={currentServing}
              className="mt-3"
            />

            {currentServing.isPriority && (
              <div className="mt-3 mb-1 flex flex-col items-center gap-2">
                <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  Priority Lane Active
                </span>

                <ViewPriorityImage
                  item={currentServing}
                  setSelectedImage={setSelectedImage}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 sm:py-12">
            <Users className="w-10 h-10 sm:w-12 sm:h-12 text-slate-300 mx-auto mb-2" />

            <p className="text-slate-500 text-sm font-medium px-2">
              No active ticket being served for {officeName}.
            </p>
          </div>
        )}
      </div>

      {currentServing && (
        <div className="flex items-center gap-2 mt-6 w-full justify-center">
          <button
            type="button"
            onClick={() =>
              handleCompleteAppointment(currentServing)
            }
            disabled={Boolean(processingId)}
            className="w-full inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors shadow-xs text-xs sm:text-sm disabled:opacity-50"
          >
            {processingId === currentServing.id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCheck className="w-4 h-4" />
            )}
            Next
          </button>
        </div>
      )}
    </div>
  );
}
