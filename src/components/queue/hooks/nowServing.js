import { useMemo } from "react";
import emailjs from "@emailjs/browser";

import {
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "../../../services/firebase";

const PUBLIC_QUEUE_COLLECTION = "queues";

const EMAILJS_SERVICE_ID = "service_20wm2tz";
const EMAILJS_TEMPLATE_ID = "template_f57ki9i";
const EMAILJS_PUBLIC_KEY = "P8vS1-WoC60N-hGPD";

const FEEDBACK_LINK =
  "https://qsystem-admin.netlify.app/public-feedback";

const isWalkInAppointment = (item) => {
  if (!item || typeof item !== "object") {
    return false;
  }

  if (item.isWalkIn === true) {
    return true;
  }

  const possibleTypes = [
    item.source,
    item.bookingType,
    item.channel,
    item.type,
  ];

  const hasWalkInType = possibleTypes.some((value) => {
    const normalized = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, "-");

    return (
      normalized === "walk-in" ||
      normalized === "walkin" ||
      normalized.includes("walk-in") ||
      normalized.includes("walkin")
    );
  });

  if (hasWalkInType) {
    return true;
  }

  return Boolean(
    item.registeredBy || item.registeredByEmail
  );
};

const getAppointmentEmail = (item) => {
  const possibleEmails = [
    item?.userEmail,
    item?.email,
    item?.user?.email,
    item?.studentEmail,
  ];

  const email = possibleEmails.find(
    (value) =>
      typeof value === "string" &&
      value.trim().length > 0
  );

  return email ? email.trim() : "";
};

const getFeedbackReference = (item) => {
  const possibleReferences = [
    item?.feedbackReference,
    item?.feedbackRef,
    item?.feedbackCode,
    item?.reference,
    item?.feedback?.reference,
    item?.feedback?.feedbackReference,
    item?.feedback?.feedbackRef,
    item?.feedback?.code,
  ];

  const reference = possibleReferences.find(
    (value) =>
      typeof value === "string" &&
      value.trim().length > 0
  );

  return reference ? reference.trim() : "";
};

const isValidFeedbackReference = (reference) =>
  typeof reference === "string" &&
  /^[a-f0-9]{48}$/i.test(reference.trim());

const buildPersonalizedFeedbackLink = (item) => {
  const reference = getFeedbackReference(item);

  if (!reference) {
    throw new Error(
      "The walk-in appointment does not contain a feedbackReference. " +
        "The appointment must have a generated feedback reference saved " +
        "in its Firestore record."
    );
  }

  if (!isValidFeedbackReference(reference)) {
    throw new Error(
      "The appointment has an invalid feedbackReference. " +
        "The reference must contain exactly 48 hexadecimal characters."
    );
  }

  const url = new URL(FEEDBACK_LINK);
  url.searchParams.set("reference", reference);

  return url.toString();
};

const getEmailJSErrorMessage = (error) => {
  const status = error?.status;
  const text = error?.text;
  const message = error?.message;

  if (status || text) {
    return [
      status ? `EmailJS status: ${status}.` : "",
      text ? `Details: ${text}` : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (message) {
    return message;
  }

  return "Unknown EmailJS error. Check your EmailJS service and template configuration.";
};

const sendWalkInCompletionEmail = async (
  item,
  officeName,
  getServiceLabel
) => {
  if (!isWalkInAppointment(item)) {
    return {
      sent: false,
      reason: "Not a walk-in appointment.",
    };
  }

  const recipientEmail = getAppointmentEmail(item);

  if (!recipientEmail) {
    throw new Error(
      "The walk-in appointment has no recipient email. " +
        "Expected the userEmail field in the appointment record."
    );
  }

  const personalizedFeedbackLink =
    buildPersonalizedFeedbackLink(item);

  const templateParams = {
    to_email: recipientEmail,
    to_name: item?.userName || "Valued Client",
    user_name: item?.userName || "Valued Client",
    queue_number: item?.queueNumber || "N/A",
    office: officeName,
    services: getServiceLabel(item),
    feedback_link: personalizedFeedbackLink,
  };

  try {
    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams,
      EMAILJS_PUBLIC_KEY
    );

    if (response?.status && response.status !== 200) {
      throw new Error(
        `EmailJS returned status ${response.status}: ${
          response.text ||
          "Email delivery request was unsuccessful."
        }`
      );
    }

    return {
      sent: true,
      email: recipientEmail,
      feedbackLink: personalizedFeedbackLink,
      status: response?.status || 200,
      responseText: response?.text || "OK",
    };
  } catch (error) {
    console.error("EmailJS send request failed:", {
      status: error?.status || null,
      text: error?.text || null,
      message: error?.message || null,
    });

    throw new Error(getEmailJSErrorMessage(error), {
      cause: error,
    });
  }
};

export default function useNowServing({
  officeName,
  validAppointments,
  todayKey,
  currentQueueHour,
  currentDateTime,
  processingId,
  setProcessingId,
  setActionError,
  setActionSuccess,
  clearMessages,
  completeAppointment,
  helpers,
}) {
  const {
    isServing,
    isTicketForCurrentHour,
    isAheadOfTimeAppointment,
    belongsToOffice,
    getStatus,
    readTickets,
    withoutTicket,
    publicTicket,
    getManilaDateTime,
    getServiceLabel,
  } = helpers;

  const currentServing = useMemo(
    () =>
      validAppointments.find(
        (item) =>
          isServing(item) &&
          isTicketForCurrentHour(
            item,
            todayKey,
            currentQueueHour
          ) &&
          !isAheadOfTimeAppointment(item, currentDateTime)
      ) || null,
    [
      validAppointments,
      todayKey,
      currentQueueHour,
      currentDateTime,
      isServing,
      isTicketForCurrentHour,
      isAheadOfTimeAppointment,
    ]
  );

  const handleStartServing = async (item) => {
    if (processingId) return;

    if (currentServing) {
      setActionError(
        "Please complete the currently serving appointment first."
      );
      return;
    }

    setProcessingId(item.id);
    clearMessages();

    try {
      const currentStaff = auth.currentUser;

      if (!currentStaff) {
        throw new Error(
          "Your session has expired. Please log in again."
        );
      }

      const appointmentRef = doc(
        db,
        "appointments",
        item.id
      );

      const publicQueueRef = doc(
        db,
        PUBLIC_QUEUE_COLLECTION,
        officeName
      );

      await runTransaction(
        db,
        async (transaction) => {
          const snapshot =
            await transaction.get(appointmentRef);

          const publicSnapshot =
            await transaction.get(publicQueueRef);

          if (!snapshot.exists()) {
            throw new Error("Appointment not found.");
          }

          const data = snapshot.data();

          if (!belongsToOffice(data, officeName)) {
            throw new Error(
              "This appointment does not belong to SWDS."
            );
          }

          if (getStatus(data) !== "approved") {
            throw new Error(
              "Only approved appointments or registered walk-ins can be served."
            );
          }

          const dateTime = getManilaDateTime();
          const dateKey = dateTime.date;
          const hourKey = dateTime.hour;

          if (!isTicketForCurrentHour(data, dateKey, hourKey)) {
            throw new Error(
              "This ticket belongs to a previous hour's queue and cannot be served in the current hourly queue."
            );
          }

          if (isAheadOfTimeAppointment(data, dateTime)) {
            throw new Error(
              "This appointment is scheduled for a later time and cannot be served yet."
            );
          }

          if (!data.queueNumber) {
            throw new Error(
              "This appointment has no assigned queue number."
            );
          }

          const publicData =
            publicSnapshot.data() || {};

          const sameHourPublicQueue =
            publicData.queueDate === dateKey &&
            Number(publicData.queueHour) === hourKey;

          if (
            sameHourPublicQueue &&
            publicData.nowServing &&
            publicData.nowServing !== data.queueNumber
          ) {
            throw new Error(
              "Another ticket is currently being served."
            );
          }

          const tickets = sameHourPublicQueue
            ? readTickets(publicData)
            : [];

          transaction.set(
            publicQueueRef,
            {
              office: officeName,
              queueDate: dateKey,
              queueHour: hourKey,
              nowServing: data.queueNumber,
              tickets: [
                ...withoutTicket(tickets, item.id),
                publicTicket(
                  { ...data, id: item.id },
                  "in-progress"
                ),
              ],
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          transaction.update(appointmentRef, {
            status: "in-progress",
            servingAt: serverTimestamp(),
            servingBy: currentStaff.uid,
            servingByEmail: currentStaff.email || "",
          });
        }
      );

      setActionSuccess(
        `Now serving ${item.queueNumber}.`
      );
    } catch (error) {
      console.error("Failed to start serving:", error);

      setActionError(
        error?.message || "Failed to start serving."
      );
    } finally {
      setProcessingId(null);
    }
  };

  const handleCompleteAppointment = async (item) => {
    if (processingId) return;

    setProcessingId(item.id);
    clearMessages();

    try {
      if (typeof completeAppointment !== "function") {
        throw new Error(
          "The completion handler is unavailable."
        );
      }

      await completeAppointment(item.id);

      const publicQueueRef = doc(
        db,
        PUBLIC_QUEUE_COLLECTION,
        officeName
      );

      await runTransaction(
        db,
        async (transaction) => {
          const publicSnapshot =
            await transaction.get(publicQueueRef);

          const publicData =
            publicSnapshot.data() || {};

          const currentDateTime = getManilaDateTime();

          const sameHour =
            publicData.queueDate === currentDateTime.date &&
            Number(publicData.queueHour) ===
              currentDateTime.hour;

          const existingTickets = readTickets(publicData);

          const matchingServingTicket =
            existingTickets.some(
              (ticket) =>
                ticket.appointmentId === item.id &&
                ticket.queueNumber === publicData.nowServing
            );

          transaction.set(
            publicQueueRef,
            {
              office: officeName,
              nowServing:
                sameHour && matchingServingTicket
                  ? ""
                  : publicData.nowServing || "",
              tickets: withoutTicket(
                existingTickets,
                item.id
              ),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }
      );

      let emailMessage = "";

      if (isWalkInAppointment(item)) {
        try {
          const emailResult =
            await sendWalkInCompletionEmail(
              item,
              officeName,
              getServiceLabel
            );

          if (emailResult.sent) {
            emailMessage =
              ` A completion email was successfully sent to ${emailResult.email}.`;
          }
        } catch (emailError) {
          console.error(
            "Walk-in completion email failed:",
            emailError
          );

          emailMessage =
            ` However, the completion email failed: ${
              emailError?.message || "Unknown email error"
            }`;
        }
      }

      setActionSuccess(
        `Appointment ${item.queueNumber || ""} completed successfully.${emailMessage}`
      );
    } catch (error) {
      console.error("Failed to complete appointment:", error);

      setActionError(
        error?.message || "Failed to complete appointment."
      );
    } finally {
      setProcessingId(null);
    }
  };

  return {
    currentServing,
    handleStartServing,
    handleCompleteAppointment,
  };
}