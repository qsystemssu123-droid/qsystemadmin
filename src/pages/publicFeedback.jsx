
import { useState } from "react";
import {
  MessageSquareHeart,
  CalendarCheck,
  Star,
  Send,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ClipboardList,
  UserRound,
  Building2,
  Loader2,
} from "lucide-react";

const RATING_LABELS = [
  "",
  "Very Dissatisfied",
  "Dissatisfied",
  "Neutral",
  "Satisfied",
  "Very Satisfied",
];

const API_BASE_URL = (
  import.meta.env.VITE_PUBLIC_FEEDBACK_API_URL || ""
).replace(/\/+$/, "");

function getInitialReference() {
  if (typeof window === "undefined") {
    return "";
  }

  const params = new URLSearchParams(window.location.search);

  return (
    params.get("reference") ||
    params.get("token") ||
    params.get("appointmentId") ||
    params.get("ref") ||
    ""
  )
    .trim()
    .slice(0, 256);
}

function formatDate(value) {
  if (!value) return "Not available";

  let date;

  if (typeof value?.toDate === "function") {
    date = value.toDate();
  } else if (typeof value?.seconds === "number") {
    date = new Date(value.seconds * 1000);
  } else {
    date = new Date(value);
  }

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  });
}

async function requestFeedbackAPI(path, payload) {
  if (!API_BASE_URL) {
    throw new Error(
      "The public feedback API has not been configured. " +
      "Set VITE_PUBLIC_FEEDBACK_API_URL after deploying " +
      "the secure feedback backend."
    );
  }

  const response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error ||
      data.message ||
      "Unable to complete your request."
    );
  }

  return data;
}

export default function PublicFeedback() {
  const [appointmentId, setAppointmentId] = useState(
    getInitialReference
  );

  const [selectedAppointment, setSelectedAppointment] =
    useState(null);

  // Stores the exact reference that was successfully verified.
  const [verifiedReference, setVerifiedReference] =
    useState("");

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState("");

  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleReferenceChange = (event) => {
    const newReference = event.target.value;

    setAppointmentId(newReference);

    // Changing the reference invalidates the previous verification.
    setSelectedAppointment(null);
    setVerifiedReference("");
    setError("");
  };

  const handleVerifyAppointment = async () => {
    const reference = appointmentId.trim();

    if (!reference) {
      setError("Please enter your appointment reference.");
      return;
    }

    try {
      setVerifying(true);
      setError("");
      setSelectedAppointment(null);
      setVerifiedReference("");

      const result = await requestFeedbackAPI(
        "/verify",
        {
          token: reference,
        }
      );

      if (!result.appointment) {
        throw new Error(
          "No verified appointment was returned."
        );
      }

      // Store both the verified appointment and its exact token.
      setSelectedAppointment(result.appointment);
      setVerifiedReference(reference);
      setError("");
    } catch (err) {
      setSelectedAppointment(null);
      setVerifiedReference("");

      setError(
        err.message ||
        "Unable to verify your appointment."
      );
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const reference = appointmentId.trim();

    if (!reference) {
      setError(
        "Please enter your completed appointment reference."
      );
      return;
    }

    // Ensure the appointment was verified using the current reference.
    if (
      !selectedAppointment ||
      !verifiedReference ||
      verifiedReference !== reference
    ) {
      setError(
        "Please verify your appointment before submitting."
      );
      return;
    }

    if (rating < 1 || rating > 5) {
      setError("Please select a rating from 1 to 5 stars.");
      return;
    }

    if (!feedback.trim()) {
      setError("Please write your review.");
      return;
    }

    try {
      setSubmitting(true);

      const result = await requestFeedbackAPI(
        "/submit",
        {
          // Submit the exact reference that was verified.
          token: verifiedReference,
          rating,
          reviewText: feedback.trim(),
        }
      );

      if (result.success !== true) {
        throw new Error(
          "The server did not confirm your submission."
        );
      }

      setSubmitted(true);
    } catch (err) {
      setError(
        err.message ||
        "Unable to submit your rating and review."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setAppointmentId("");
    setSelectedAppointment(null);
    setVerifiedReference("");
    setRating(0);
    setHoverRating(0);
    setFeedback("");
    setSubmitted(false);
    setSubmitting(false);
    setVerifying(false);
    setError("");
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-lg p-8 text-center">
          <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 className="w-11 h-11 text-emerald-600" />
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mb-3">
            Thank You!
          </h1>

          <p className="text-sm text-slate-600 leading-relaxed">
            Your rating and review have been submitted
            successfully. Thank you for helping us improve
            our student services.
          </p>

          <button
            type="button"
            onClick={resetForm}
            className="mt-7 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Back to Feedback
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-5 py-5 flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center">
            <MessageSquareHeart className="w-6 h-6 text-white" />
          </div>

          <div>
            <h1 className="text-xl font-extrabold text-slate-900">
              QueueMatrix
            </h1>

            <p className="text-xs text-slate-500">
              Student Ratings & Feedback Portal
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10">
        {/* INTRODUCTION */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MessageSquareHeart className="w-8 h-8 text-blue-600" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Rate Your Appointment
          </h2>

          <p className="text-sm text-slate-500 mt-3 leading-relaxed max-w-lg mx-auto">
            Tell us about your completed appointment.
            Your ratings and reviews help improve
            QueueMatrix student services.
          </p>
        </div>

        {/* FEEDBACK FORM */}
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden"
        >
          <div className="p-6 sm:p-8 space-y-7">
            {/* APPOINTMENT REFERENCE */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <CalendarCheck className="w-5 h-5 text-blue-600" />

                <label
                  htmlFor="appointment-reference"
                  className="font-bold text-sm text-slate-800"
                >
                  Completed Appointment
                  <span className="text-rose-500"> *</span>
                </label>
              </div>

              <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                Enter the feedback reference provided
                after your visit. A personalized QR code
                can fill this field automatically.
              </p>

              <div className="relative">
                <ClipboardList className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />

                <input
                  id="appointment-reference"
                  type="text"
                  value={appointmentId}
                  onChange={handleReferenceChange}
                  placeholder="Enter feedback reference"
                  maxLength={256}
                  required
                  autoComplete="off"
                  disabled={verifying || submitting}
                  className="w-full pl-11 pr-4 py-3.5 border border-slate-300 rounded-xl text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors disabled:bg-slate-100"
                />
              </div>

              <button
                type="button"
                onClick={handleVerifyAppointment}
                disabled={verifying || submitting || !appointmentId.trim()}
                className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-3 transition-colors disabled:opacity-60"
              >
                {verifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verifying Appointment...
                  </>
                ) : verifiedReference === appointmentId.trim() &&
                  selectedAppointment ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Appointment Verified
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Verify Appointment
                  </>
                )}
              </button>

              <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                <p className="text-xs font-semibold text-blue-800">
                  Where can I find my reference?
                </p>

                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Your feedback reference is issued for
                  a completed appointment. Ask the staff
                  if you have not received one.
                </p>
              </div>
            </section>

            {/* VERIFIED APPOINTMENT DETAILS */}
            {selectedAppointment &&
              verifiedReference === appointmentId.trim() && (
              <section className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <h3 className="text-sm font-bold text-slate-900">
                    Appointment Details
                  </h3>

                  <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-bold text-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    VERIFIED APPOINTMENT
                  </span>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <UserRound className="w-5 h-5 text-blue-600" />

                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {selectedAppointment.userName ||
                        "Student"}
                    </p>

                    {selectedAppointment.userEmail && (
                      <p className="text-xs text-slate-500">
                        {selectedAppointment.userEmail}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500 flex items-center gap-1">
                      <Building2 className="w-4 h-4" />
                      Office
                    </span>

                    <span className="font-semibold text-slate-900">
                      {selectedAppointment.office || "N/A"}
                    </span>
                  </div>

                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">
                      Service
                    </span>

                    <span className="font-semibold text-slate-900 text-right">
                      {selectedAppointment.service || "N/A"}
                    </span>
                  </div>

                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">
                      Queue Number
                    </span>

                    <span className="font-bold text-blue-600">
                      {selectedAppointment.queueNumber || "N/A"}
                    </span>
                  </div>

                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">
                      Scheduled
                    </span>

                    <span className="font-semibold text-slate-900 text-right">
                      {formatDate(
                        selectedAppointment.scheduledAt ||
                        selectedAppointment.appointmentDate
                      )}
                    </span>
                  </div>
                </div>
              </section>
            )}

            <div className="border-t border-slate-100" />

            {/* STAR RATING */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-5 h-5 text-amber-500" />

                <h3 className="font-bold text-sm text-slate-800">
                  User Rating
                  <span className="text-rose-500"> *</span>
                </h3>
              </div>

              <p className="text-xs text-slate-500 mb-4">
                How would you rate the service you received?
              </p>

              <div className="flex items-center justify-center gap-2 sm:gap-4">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(value)}
                    onMouseEnter={() => setHoverRating(value)}
                    onMouseLeave={() => setHoverRating(0)}
                    aria-label={`${value} star${value > 1 ? "s" : ""}`}
                    aria-pressed={rating === value}
                    className="p-1.5 sm:p-2 transition-transform hover:scale-110"
                  >
                    <Star
                      className={`w-9 h-9 sm:w-11 sm:h-11 ${
                        value <= (hoverRating || rating)
                          ? "text-amber-400 fill-amber-400"
                          : "text-slate-300"
                      }`}
                    />
                  </button>
                ))}
              </div>

              <p className="text-center text-sm font-semibold text-blue-700 mt-3 min-h-5">
                {rating > 0
                  ? `${RATING_LABELS[rating]} (${rating}/5)`
                  : "Tap a star to rate"}
              </p>
            </section>

            <div className="border-t border-slate-100" />

            {/* WRITTEN REVIEW */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <MessageSquareHeart className="w-5 h-5 text-blue-600" />

                <label
                  htmlFor="feedback-message"
                  className="font-bold text-sm text-slate-800"
                >
                  User Review
                  <span className="text-rose-500"> *</span>
                </label>
              </div>

              <p className="text-xs text-slate-500 mb-3">
                Tell us what you liked and what we can improve.
              </p>

              <textarea
                id="feedback-message"
                value={feedback}
                onChange={(event) => {
                  setFeedback(event.target.value);
                  setError("");
                }}
                placeholder="Write your review about the appointment..."
                rows={6}
                maxLength={1000}
                required
                className="w-full px-4 py-3.5 border border-slate-300 rounded-xl text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none transition-colors"
              />

              <p className="text-xs text-slate-400 text-right mt-1">
                {feedback.length}/1000 characters
              </p>
            </section>

            {/* ERROR */}
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3.5"
              >
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />

                <p className="text-xs text-rose-700 leading-relaxed">
                  {error}
                </p>
              </div>
            )}

            {/* SUBMIT */}
            <button
              type="submit"
              disabled={
                submitting ||
                verifying ||
                !selectedAppointment ||
                verifiedReference !== appointmentId.trim()
              }
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-colors shadow-sm"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Rating & Review
                </>
              )}
            </button>
          </div>
        </form>

        {/* PRIVACY */}
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-2xl p-4 mt-5">
          <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />

          <p className="text-xs text-slate-600 leading-relaxed">
            Your rating and review will help improve student
            services. Please avoid including passwords or
            other sensitive personal information.
          </p>
        </div>

        <p className="text-center text-xs text-slate-400 mt-8">
          © {new Date().getFullYear()} QueueMatrix
          <span className="mx-2">•</span>
          Student Ratings & Feedback
        </p>
      </main>
    </div>
  );
}
