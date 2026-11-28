
import { useEffect, useState, useRef } from "react";
import emailjs from "@emailjs/browser";

import {
  collection,
  doc,
  getDocs,
  query,
  where,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "../../../services/firebase";

const OFFICE_NAME = "SWDS";
const PUBLIC_QUEUE_COLLECTION = "queues";
const SERVICE_TASKS_COLLECTION = "appointment_services";
const PHILIPPINE_TIME_ZONE = "Asia/Manila";

const CLOUD_AUTO_APPROVAL_ENABLED = true;

const COUNSELING_SERVICES = [
  "Guidance & Counseling Services",
  "Guidance and Counseling Services",
];

const EMAILJS_SERVICE_ID = "service_20wm2tz";
const EMAILJS_TEMPLATE_ID = "template_f57ki9i";
const EMAILJS_PUBLIC_KEY = "P8vS1-WoC60N-hGPD";
const FEEDBACK_LINK = "https://qsystem-admin.netlify.app/public-feedback";

const normalizeServiceName = (value) =>
  typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").toLowerCase()
    : "";

const getServiceTaskIds = (appointment) => {
  const ids = [
    ...(Array.isArray(appointment?.serviceTaskIds)
      ? appointment.serviceTaskIds
      : []),
    ...(Array.isArray(appointment?.services)
      ? appointment.services.map((service) => service?.serviceTaskId)
      : []),
  ];

  return [
    ...new Set(
      ids
        .filter((id) => typeof id === "string" && id.trim())
        .map((id) => id.trim())
    ),
  ];
};

/*
 * STAFF ASSIGNMENT CHECKS
 */

const normalizeStaffValue = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const getStaffAssignmentValues = (item) => {
  if (!item || typeof item !== "object") {
    return { ids: [], emails: [], hasAssignment: false };
  }

  const assignedStaff =
    item.assignedStaff && typeof item.assignedStaff === "object"
      ? item.assignedStaff
      : {};

  const staff =
    item.staff && typeof item.staff === "object"
      ? item.staff
      : {};

  const ids = [
    item.assignedStaffId,
    item.staffId,
    item.assignedToId,
    item.assignedToUserId,
    item.staffUid,
    item.assignedStaffUid,
    assignedStaff.uid,
    assignedStaff.id,
    assignedStaff.userId,
    staff.uid,
    staff.id,
    staff.userId,
  ]
    .map(normalizeStaffValue)
    .filter(Boolean);

  const emails = [
    item.assignedStaffEmail,
    item.staffEmail,
    item.assignedToEmail,
    assignedStaff.email,
    staff.email,
  ]
    .map(normalizeStaffValue)
    .filter(Boolean);

  const assignedTo = normalizeStaffValue(item.assignedTo);

  if (assignedTo) {
    if (assignedTo.includes("@")) emails.push(assignedTo);
    else ids.push(assignedTo);
  }

  const assignedStaffValue = normalizeStaffValue(
    typeof item.assignedStaff === "string" ? item.assignedStaff : ""
  );

  if (assignedStaffValue) {
    if (assignedStaffValue.includes("@")) emails.push(assignedStaffValue);
    else ids.push(assignedStaffValue);
  }

  const staffValue = normalizeStaffValue(
    typeof item.staff === "string" ? item.staff : ""
  );

  if (staffValue) {
    if (staffValue.includes("@")) emails.push(staffValue);
    else ids.push(staffValue);
  }

  return {
    ids: [...new Set(ids)],
    emails: [...new Set(emails)],
    hasAssignment: ids.length > 0 || emails.length > 0,
  };
};

const isAssignmentForStaff = (item, staff) => {
  if (!item || !staff) return false;

  const staffUid = normalizeStaffValue(staff.uid);
  const staffEmail = normalizeStaffValue(staff.email);

  if (!staffUid && !staffEmail) return false;

  const assignment = getStaffAssignmentValues(item);

  if (!assignment.hasAssignment) return false;

  return Boolean(
    (staffUid && assignment.ids.includes(staffUid)) ||
    (staffEmail && assignment.emails.includes(staffEmail))
  );
};

const isAssignedToCurrentStaff = (item, staff) => {
  if (!item || !staff) return false;

  const parentAssignment = getStaffAssignmentValues(item);
  const services = Array.isArray(item.services) ? item.services : [];

  const assignedServices = services.filter(
    (service) =>
      service &&
      typeof service === "object" &&
      getStaffAssignmentValues(service).hasAssignment
  );

  if (assignedServices.length > 0) {
    if (
      assignedServices.length !==
        services.filter(
          (service) =>
            service &&
            typeof service === "object" &&
            service.serviceTaskId
        ).length &&
      services.some(
        (service) =>
          service &&
          typeof service === "object" &&
          service.serviceTaskId &&
          !getStaffAssignmentValues(service).hasAssignment
      )
    ) {
      return false;
    }

    if (
      !assignedServices.every((service) =>
        isAssignmentForStaff(service, staff)
      )
    ) {
      return false;
    }

    if (parentAssignment.hasAssignment) {
      return isAssignmentForStaff(item, staff);
    }

    return true;
  }

  if (parentAssignment.hasAssignment) {
    return isAssignmentForStaff(item, staff);
  }

  return false;
};

const assertStaffOwnsAppointment = (item, staff) => {
  if (!staff) {
    throw new Error("Your session has expired. Please log in again.");
  }

  if (!isAssignedToCurrentStaff(item, staff)) {
    throw new Error(
      "You are not authorized to manage this appointment because the appointment or one of its services is not assigned to your account."
    );
  }
};

const belongsToOffice = (item, officeName = OFFICE_NAME) => {
  const appointmentOffice = String(
    item?.office || item?.officeName || item?.department || ""
  )
    .trim()
    .toLowerCase();

  const requestedOffice = String(officeName || "").trim().toLowerCase();

  if (!appointmentOffice || !requestedOffice) return false;

  return (
    appointmentOffice === requestedOffice ||
    appointmentOffice.startsWith(`${requestedOffice} -`) ||
    appointmentOffice.startsWith(`${requestedOffice} `) ||
    appointmentOffice.includes(requestedOffice)
  );
};

const getManilaDateTime = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PHILIPPINE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const value = (type) =>
    parts.find((part) => part.type === type)?.value || "";

  const hour = Number(value("hour"));

  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    hour,
    minutes: hour * 60 + Number(value("minute")),
  };
};

const getManilaDateKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PHILIPPINE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const value = (type) =>
    parts.find((part) => part.type === type)?.value || "";

  return `${value("year")}-${value("month")}-${value("day")}`;
};

const getManilaHour = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PHILIPPINE_TIME_ZONE,
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const hour = Number(parts.find((part) => part.type === "hour")?.value);

  return Number.isInteger(hour) ? hour : null;
};

const getScheduledDate = (item) => {
  const value = item?.rescheduledToDate || item?.appointmentDate || "";

  if (!value) return "";

  if (typeof value === "string") {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : value;
  }

  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : value instanceof Date
        ? value
        : null;

  return date && !Number.isNaN(date.getTime()) ? getManilaDateKey(date) : "";
};

const getScheduledTime = (item) =>
  item?.rescheduledToTime || item?.appointmentTime || "";

const convertTimeToMinutes = (time) => {
  if (typeof time !== "string" || !time.trim()) return null;

  const normalized = time.trim().toUpperCase();

  const twelveHourMatch = normalized.match(
    /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/
  );

  if (twelveHourMatch) {
    let hours = Number(twelveHourMatch[1]);
    const minutes = Number(twelveHourMatch[2]);
    const period = twelveHourMatch[3];

    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
      return null;
    }

    if (period === "AM") {
      if (hours === 12) hours = 0;
    } else if (hours !== 12) {
      hours += 12;
    }

    return hours * 60 + minutes;
  }

  const twentyFourHourMatch = normalized.match(
    /^(\d{1,2}):(\d{2})(?::\d{2})?$/
  );

  if (twentyFourHourMatch) {
    const hours = Number(twentyFourHourMatch[1]);
    const minutes = Number(twentyFourHourMatch[2]);

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return null;
    }

    return hours * 60 + minutes;
  }

  return null;
};

const hasValidAppointmentSchedule = (item) => {
  const date = getScheduledDate(item);
  const time = getScheduledTime(item);

  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    convertTimeToMinutes(time) !== null
  );
};

const isAheadOfTimeAppointment = (item, currentDateTime) => {
  if (isWalkInAppointment(item)) return false;
  if (!hasValidAppointmentSchedule(item)) return false;

  const scheduledDate = getScheduledDate(item);
  const scheduledMinutes = convertTimeToMinutes(getScheduledTime(item));

  if (scheduledDate > currentDateTime.date) return true;
  if (scheduledDate < currentDateTime.date) return false;

  return scheduledMinutes > currentDateTime.minutes;
};

const isAppointmentReadyForAutomaticApproval = (item, currentDateTime) => {
  if (isWalkInAppointment(item)) return false;
  if (!hasValidAppointmentSchedule(item)) return false;

  return !isAheadOfTimeAppointment(item, currentDateTime);
};

const getAppointmentServices = (item) => {
  const services = [];

  const addService = (value) => {
    if (typeof value === "string") {
      const normalized = value.trim();
      if (normalized) services.push(normalized);
      return;
    }

    if (value && typeof value === "object") {
      const serviceName =
        value.serviceName ||
        value.name ||
        value.label ||
        value.service ||
        value.title;

      if (typeof serviceName === "string" && serviceName.trim()) {
        services.push(serviceName.trim());
      }
    }
  };

  if (Array.isArray(item?.services)) item.services.forEach(addService);
  if (Array.isArray(item?.selectedServices)) item.selectedServices.forEach(addService);
  if (Array.isArray(item?.serviceNames)) item.serviceNames.forEach(addService);

  if (typeof item?.service === "string" && item.service.trim()) {
    item.service.split(",").forEach(addService);
  }

  if (typeof item?.serviceName === "string" && item.serviceName.trim()) {
    addService(item.serviceName);
  }

  return [...new Set(services)];
};

const getServiceLabel = (item) => {
  const services = getAppointmentServices(item);
  return services.length ? services.join(", ") : item?.reason || "Appointment";
};

const requiresCounselingConfirmation = (item) => {
  const selectedServices = getAppointmentServices(item).map(normalizeServiceName);
  const counselingNames = COUNSELING_SERVICES.map(normalizeServiceName);

  return selectedServices.some((service) => counselingNames.includes(service));
};

const isWalkInAppointment = (item) => {
  if (!item || typeof item !== "object") return false;
  if (item.isWalkIn === true) return true;

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

  if (hasWalkInType) return true;
  if (item.registeredBy || item.registeredByEmail) return true;

  return false;
};

const assertAutomaticApprovalAllowed = (appointmentData, currentDateTime) => {
  if (isWalkInAppointment(appointmentData)) {
    throw new Error(
      "Walk-in appointments are registered as approved and must not use automatic booking approval."
    );
  }

  if (requiresCounselingConfirmation(appointmentData)) {
    throw new Error(
      "This appointment includes Guidance and Counseling Services. It must remain pending until staff explicitly accepts it."
    );
  }

  if (!isAppointmentReadyForAutomaticApproval(appointmentData, currentDateTime)) {
    throw new Error(
      "This appointment is scheduled for a later time and cannot be automatically approved yet."
    );
  }
};

const getAppointmentEmail = (item) => {
  const possibleEmails = [
    item?.userEmail,
    item?.email,
    item?.user?.email,
    item?.studentEmail,
  ];

  const email = possibleEmails.find(
    (value) => typeof value === "string" && value.trim().length > 0
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
    (value) => typeof value === "string" && value.trim().length > 0
  );

  return reference ? reference.trim() : "";
};

const isValidFeedbackReference = (reference) =>
  typeof reference === "string" && /^[a-f0-9]{48}$/i.test(reference.trim());

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

  if (message) return message;

  return "Unknown EmailJS error. Check your EmailJS service and template configuration.";
};

const sendWalkInCompletionEmail = async (item, officeName) => {
  if (!isWalkInAppointment(item)) {
    return { sent: false, reason: "Not a walk-in appointment." };
  }

  const recipientEmail = getAppointmentEmail(item);

  if (!recipientEmail) {
    throw new Error(
      "The walk-in appointment has no recipient email. " +
        "Expected the userEmail field in the appointment record."
    );
  }

  const personalizedFeedbackLink = buildPersonalizedFeedbackLink(item);

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
          response.text || "Email delivery request was unsuccessful."
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

    throw new Error(getEmailJSErrorMessage(error), { cause: error });
  }
};

const getAppointmentQueueDate = (item) => {
  if (typeof item?.queueDate === "string" && item.queueDate) {
    return item.queueDate;
  }

  const approvedAt = item?.approvedAt;

  const date =
    typeof approvedAt?.toDate === "function"
      ? approvedAt.toDate()
      : typeof approvedAt?.seconds === "number"
        ? new Date(approvedAt.seconds * 1000)
        : approvedAt instanceof Date
          ? approvedAt
          : approvedAt
            ? new Date(approvedAt)
            : null;

  return date && !Number.isNaN(date.getTime()) ? getManilaDateKey(date) : null;
};

const getAppointmentQueueHour = (item) => {
  if (
    item?.queueHour !== undefined &&
    item?.queueHour !== null &&
    item?.queueHour !== ""
  ) {
    const hour = Number(item.queueHour);

    if (Number.isInteger(hour) && hour >= 0 && hour <= 23) return hour;
  }

  const possibleTimestamps = [
    item?.approvedAt,
    item?.createdAt,
    item?.queueCreatedAt,
  ];

  for (const value of possibleTimestamps) {
    const date =
      typeof value?.toDate === "function"
        ? value.toDate()
        : typeof value?.seconds === "number"
          ? new Date(value.seconds * 1000)
          : value instanceof Date
            ? value
            : typeof value === "string" || typeof value === "number"
              ? new Date(value)
              : null;

    const hour = getManilaHour(date);

    if (hour !== null) return hour;
  }

  return null;
};

const isTicketForDay = (item, dateKey) =>
  getAppointmentQueueDate(item) === dateKey;

const isTicketForCurrentHour = (item, dateKey, hour) =>
  isTicketForDay(item, dateKey) &&
  getAppointmentQueueHour(item) === Number(hour);

const publicTicket = (item, status, queueNumber) => ({
  appointmentId: item.id,
  queueNumber: String(queueNumber || item.queueNumber || ""),
  status,
  isPriority: item.isPriority === true,
  queuePosition: Number(item.queuePosition || 0),
  queueDate: item.queueDate || "",
  queueHour:
    item.queueHour !== undefined && item.queueHour !== null
      ? Number(item.queueHour)
      : null,
});

const readTickets = (data) =>
  Array.isArray(data?.tickets) ? data.tickets : [];

const withoutTicket = (tickets, appointmentId) =>
  tickets.filter((ticket) => ticket.appointmentId !== appointmentId);

/*
 * VALIDATES THE PUBLIC NOW-SERVING VALUE.
 *
 * A nowServing value is valid only when a matching public ticket exists
 * and that ticket is actually marked as serving.
 *
 * This prevents an old value such as SWDS-001 from remaining active
 * when the actual public queue only contains an approved SWDS-003.
 */
const getValidNowServing = (publicData, tickets = readTickets(publicData)) => {
  const nowServing = String(publicData?.nowServing || "").trim();

  if (!nowServing) return "";

  const servingTicket = tickets.find((ticket) => {
    if (!ticket || typeof ticket !== "object") return false;

    const ticketQueueNumber = String(ticket.queueNumber || "").trim();

    const ticketStatus = String(ticket.status || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

    return (
      ticketQueueNumber === nowServing &&
      ["in-progress", "serving", "now-serving"].includes(ticketStatus)
    );
  });

  return servingTicket ? nowServing : "";
};

const getStatus = (item) =>
  String(item?.status || "pending")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const isPending = (item) => ["pending", "waiting"].includes(getStatus(item));

const isApproved = (item) =>
  ["approved", "confirmed", "approved - waiting"].includes(getStatus(item));

const isServing = (item) =>
  ["in-progress", "serving", "now-serving"].includes(getStatus(item));

const getQueueNumber = (item) => {
  if (isPending(item)) return "Pending";

  return item?.queueNumber ? String(item.queueNumber) : "Not Assigned";
};

const getTimestamp = (item) => {
  const value = item?.approvedAt || item?.createdAt;

  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Date.parse(value) || 0;

  return 0;
};

/*
 * MATCHES A PUBLIC QUEUE TO THE APPOINTMENT'S ORIGINAL QUEUE SLOT.
 *
 * Do not compare against the current clock here. An appointment can
 * finish after its queue hour has changed.
 */
const isSameAppointmentQueue = (publicData, appointmentData) => {
  const appointmentDate = getAppointmentQueueDate(appointmentData);
  const appointmentHour = getAppointmentQueueHour(appointmentData);

  if (!appointmentDate || appointmentHour === null) return false;

  return (
    publicData?.queueDate === appointmentDate &&
    Number(publicData?.queueHour) === appointmentHour
  );
};

/*
 * FETCH CHILD SERVICE REFERENCES BEFORE THE TRANSACTION.
 */
const getLinkedServiceTaskQueryRefs = async (appointmentId) => {
  if (typeof appointmentId !== "string" || !appointmentId.trim()) {
    throw new Error("Invalid appointment ID.");
  }

  const tasksCollection = collection(db, SERVICE_TASKS_COLLECTION);

  const appointmentTasksQuery = query(
    tasksCollection,
    where("appointmentId", "==", appointmentId)
  );

  const parentAppointmentTasksQuery = query(
    tasksCollection,
    where("parentAppointmentId", "==", appointmentId)
  );

  const [
    appointmentTaskQuerySnapshot,
    parentTaskQuerySnapshot,
  ] = await Promise.all([
    getDocs(appointmentTasksQuery),
    getDocs(parentAppointmentTasksQuery),
  ]);

  const taskRefs = new Map();

  [appointmentTaskQuerySnapshot, parentTaskQuerySnapshot].forEach(
    (querySnapshot) => {
      querySnapshot.forEach((snapshot) => {
        if (snapshot?.ref?.path) {
          taskRefs.set(snapshot.id, snapshot.ref);
        }
      });
    }
  );

  return [...taskRefs.values()];
};

/*
 * FINDS EVERY CHILD SERVICE DOCUMENT CONNECTED TO THIS APPOINTMENT.
 */
const getLinkedServiceTaskSnapshots = async (
  transaction,
  appointmentData,
  appointmentId,
  staff,
  queriedTaskRefs = [],
  allowedStatuses = ["pending", "waiting", "approved", "confirmed"]
) => {
  const taskRefs = new Map();

  getServiceTaskIds(appointmentData).forEach((taskId) => {
    if (typeof taskId !== "string" || !taskId.trim()) return;

    const ref = doc(db, SERVICE_TASKS_COLLECTION, taskId.trim());

    if (ref?.path) {
      taskRefs.set(taskId.trim(), ref);
    }
  });

  queriedTaskRefs.forEach((ref) => {
    if (
      ref &&
      typeof ref.path === "string" &&
      ref.path.startsWith(`${SERVICE_TASKS_COLLECTION}/`) &&
      ref.id
    ) {
      taskRefs.set(ref.id, ref);
    }
  });

  if (!taskRefs.size) {
    throw new Error(
      `No linked service documents were found in "${SERVICE_TASKS_COLLECTION}" for appointment "${appointmentId}". The appointment was not updated.`
    );
  }

  const directTaskSnapshots = await Promise.all(
    [...taskRefs.entries()].map(async ([id, ref]) => {
      if (!ref || typeof ref.path !== "string") {
        throw new Error(
          `Invalid Firestore reference for service task "${id}".`
        );
      }

      return {
        id,
        ref,
        snapshot: await transaction.get(ref),
      };
    })
  );

  const linkedTasks = new Map();

  directTaskSnapshots.forEach(({ id, ref, snapshot }) => {
    if (!snapshot.exists()) {
      throw new Error(
        `The linked service task "${id}" could not be found in "${SERVICE_TASKS_COLLECTION}".`
      );
    }

    linkedTasks.set(id, {
      id,
      ref,
      data: snapshot.data(),
    });
  });

  const expectedTaskIds = getServiceTaskIds(appointmentData);

  expectedTaskIds.forEach((taskId) => {
    if (!linkedTasks.has(taskId)) {
      throw new Error(
        `The service task "${taskId}" linked to this appointment is missing.`
      );
    }
  });

  const serviceTasks = [];

  linkedTasks.forEach(({ id, ref, data }) => {
    const linkedAppointmentId =
      data.parentAppointmentId || data.appointmentId;

    if (linkedAppointmentId !== appointmentId) {
      throw new Error(
        `Service task "${id}" does not belong to appointment "${appointmentId}".`
      );
    }

    if (!belongsToOffice(data, OFFICE_NAME)) {
      throw new Error(`Service task "${id}" does not belong to SWDS.`);
    }

    if (!isAssignmentForStaff(data, staff)) {
      throw new Error(
        `You are not authorized to manage service task "${id}" because it is assigned to another staff member or has no valid staff assignment.`
      );
    }

    const taskStatus = getStatus(data);

    if (!allowedStatuses.includes(taskStatus)) {
      throw new Error(
        `Service task "${id}" cannot be updated because its current status is "${taskStatus}".`
      );
    }

    serviceTasks.push({ id, ref, data });
  });

  const embeddedServiceTaskIds = Array.isArray(appointmentData?.services)
    ? appointmentData.services
        .filter(
          (service) =>
            service &&
            typeof service === "object" &&
            service.serviceTaskId
        )
        .map((service) => String(service.serviceTaskId).trim())
        .filter(Boolean)
    : [];

  if (
    embeddedServiceTaskIds.length &&
    embeddedServiceTaskIds.some((id) => !linkedTasks.has(id))
  ) {
    throw new Error(
      "One or more service tasks linked in the appointment's services list are missing."
    );
  }

  return serviceTasks;
};

/*
 * BUILDS THE PARENT APPOINTMENT SYNCHRONIZATION DATA.
 */
const buildParentServiceSyncData = (
  appointmentData,
  serviceTasks,
  updates
) => {
  const existingServices = Array.isArray(appointmentData?.services)
    ? appointmentData.services
    : [];

  const embeddedUpdates = { ...updates };

  Object.keys(embeddedUpdates).forEach((key) => {
    if (/At$/.test(key) && embeddedUpdates[key] != null) {
      embeddedUpdates[key] = new Date();
    }
  });

  const taskUpdatesById = new Map(
    serviceTasks.map(({ id }) => [id, embeddedUpdates])
  );

  const synchronizedServices = existingServices.map((service) => {
    if (!service || typeof service !== "object" || Array.isArray(service)) {
      return service;
    }

    const serviceTaskId = service.serviceTaskId;

    if (serviceTaskId && taskUpdatesById.has(serviceTaskId)) {
      return {
        ...service,
        ...taskUpdatesById.get(serviceTaskId),
      };
    }

    return {
      ...service,
      ...embeddedUpdates,
    };
  });

  const taskCount = serviceTasks.length;
  const pendingCount =
    updates.status === "pending" || updates.status === "waiting"
      ? taskCount
      : 0;

  const completedCount =
    updates.status === "completed" ? taskCount : 0;

  return {
    services: synchronizedServices,
    pendingServices: pendingCount,
    completedServices: completedCount,
  };
};

/*
 * UPDATES EVERY LINKED CHILD TASK AND THE PARENT'S EMBEDDED SERVICES.
 */
const synchronizeServiceTaskWrites = (
  transaction,
  appointmentRef,
  appointmentData,
  serviceTasks,
  updates
) => {
  const parentSyncData = buildParentServiceSyncData(
    appointmentData,
    serviceTasks,
    updates
  );

  transaction.update(appointmentRef, {
    ...updates,
    ...parentSyncData,
  });

  serviceTasks.forEach(({ ref }) => {
    transaction.update(ref, updates);
  });
};

export default function useSWDS({
  appointments = [],
}) {
  const officeName = OFFICE_NAME;

  const [todayKey, setTodayKey] = useState(() => getManilaDateKey());
  const [currentDateTime, setCurrentDateTime] = useState(
    () => getManilaDateTime()
  );

  const autoApprovalAttempted = useRef(new Set());
  const appointmentsRef = useRef(appointments);

  const currentStaff = auth.currentUser;
  const currentStaffUid = currentStaff?.uid || "";
  const currentStaffEmail = currentStaff?.email || "";

  useEffect(() => {
    appointmentsRef.current = appointments;
  }, [appointments]);

  useEffect(() => {
    const updatePhilippineTime = () => {
      setTodayKey(getManilaDateKey());
      setCurrentDateTime(getManilaDateTime());
    };

    updatePhilippineTime();

    const interval = setInterval(updatePhilippineTime, 5000);

    return () => clearInterval(interval);
  }, []);

  const [appointmentToReject, setAppointmentToReject] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionError, setRejectionError] = useState("");

  const [processingId, setProcessingId] = useState(null);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const currentQueueHour = currentDateTime.hour;

  const allOfficeAppointments = (appointments || []).filter((item) =>
    belongsToOffice(item, officeName)
  );

  const officeAppointments = allOfficeAppointments.filter((item) =>
    isAssignedToCurrentStaff(item, {
      uid: currentStaffUid,
      email: currentStaffEmail,
    })
  );

  const validAppointments = officeAppointments.filter(
    (item) =>
      !["completed", "rejected", "cancelled", "canceled"].includes(
        getStatus(item)
      )
  );

  const completedCount = officeAppointments.filter(
    (item) => getStatus(item) === "completed"
  ).length;

  const allPendingAppointments = validAppointments
    .filter(isPending)
    .sort((a, b) => getTimestamp(a) - getTimestamp(b));

  const pendingAppointments = allPendingAppointments.filter(
    (item) =>
      requiresCounselingConfirmation(item) &&
      !isAheadOfTimeAppointment(item, currentDateTime)
  );

  const priorityLaneQueue = pendingAppointments.filter(
    (item) => item.isPriority
  );

  const normalPendingAppointments = pendingAppointments.filter(
    (item) => !item.isPriority
  );

  const automaticApprovalAppointments = allPendingAppointments.filter(
    (item) =>
      !isWalkInAppointment(item) &&
      !requiresCounselingConfirmation(item) &&
      isAppointmentReadyForAutomaticApproval(item, currentDateTime)
  );

  const approvedPriority = validAppointments
    .filter(
      (item) =>
        item.isPriority &&
        isApproved(item) &&
        isTicketForCurrentHour(item, todayKey, currentQueueHour) &&
        item.queueNumber &&
        !isAheadOfTimeAppointment(item, currentDateTime)
    )
    .sort((a, b) => getTimestamp(a) - getTimestamp(b));

  const normalAppointments = validAppointments
    .filter(
      (item) =>
        !item.isPriority &&
        isApproved(item) &&
        isTicketForCurrentHour(item, todayKey, currentQueueHour) &&
        item.queueNumber &&
        !isAheadOfTimeAppointment(item, currentDateTime)
    )
    .sort((a, b) => getTimestamp(a) - getTimestamp(b));

  const currentServing =
    validAppointments.find(
      (item) =>
        isServing(item) &&
        isTicketForCurrentHour(item, todayKey, currentQueueHour) &&
        !isAheadOfTimeAppointment(item, currentDateTime)
    ) || null;

  const officeHasCurrentlyServingAppointment = allOfficeAppointments.some(
    (item) =>
      isServing(item) &&
      isTicketForCurrentHour(item, todayKey, currentQueueHour) &&
      !isAheadOfTimeAppointment(item, currentDateTime)
  );

  const upcomingQueue = [...approvedPriority, ...normalAppointments];

  const laterDisplayAppointments = validAppointments.map((item) => {
    const isFuture = isAheadOfTimeAppointment(item, currentDateTime);

    if (isFuture && isApproved(item)) {
      return { ...item, status: "approved - waiting" };
    }

    return item;
  });

  const clearMessages = () => {
    setActionError("");
    setActionSuccess("");
  };

  const handleAcceptAppointment = async (item, options = {}) => {
    if (processingId) return;

    const isAutomatic = options.automatic === true;
    const staff = auth.currentUser;

    if (!staff) {
      setActionError("Your session has expired. Please log in again.");
      return;
    }

    if (isWalkInAppointment(item)) {
      setActionError(
        "Walk-in appointments are already approved during registration and cannot be accepted again."
      );
      return;
    }

    if (!isAssignedToCurrentStaff(item, staff)) {
      setActionError(
        "You cannot accept this appointment because it or one of its services is assigned to another staff member."
      );
      return;
    }

    setProcessingId(item.id);
    clearMessages();

    try {
      const queriedServiceTaskRefs =
        await getLinkedServiceTaskQueryRefs(item.id);

      const appointmentRef = doc(db, "appointments", item.id);
      const counterRef = doc(db, "queue-counters", officeName);
      const publicQueueRef = doc(
        db,
        PUBLIC_QUEUE_COLLECTION,
        officeName
      );

      const assignedNumber = await runTransaction(
        db,
        async (transaction) => {
          const appointmentSnapshot = await transaction.get(appointmentRef);
          const counterSnapshot = await transaction.get(counterRef);
          const publicSnapshot = await transaction.get(publicQueueRef);

          if (!appointmentSnapshot.exists()) {
            throw new Error("The appointment could not be found.");
          }

          const appointmentData = appointmentSnapshot.data();

          if (!belongsToOffice(appointmentData, officeName)) {
            throw new Error("This appointment does not belong to SWDS.");
          }

          assertStaffOwnsAppointment(appointmentData, staff);

          const currentStatus = String(appointmentData.status || "pending")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, " ");

          if (!["pending", "waiting"].includes(currentStatus)) {
            throw new Error("Only pending appointments can be accepted.");
          }

          const approvalDateTime = getManilaDateTime();

          if (isAutomatic) {
            assertAutomaticApprovalAllowed(
              appointmentData,
              approvalDateTime
            );
          }

          const serviceTaskSnapshots =
            await getLinkedServiceTaskSnapshots(
              transaction,
              appointmentData,
              item.id,
              staff,
              queriedServiceTaskRefs,
              ["pending", "waiting", "approved", "confirmed"]
            );

          const dateKey = approvalDateTime.date;
          const hourKey = approvalDateTime.hour;

          const counterData = counterSnapshot.exists()
            ? counterSnapshot.data()
            : {};

          const sameHourCounter =
            counterData.queueDate === dateKey &&
            Number(counterData.queueHour) === hourKey
              ? Number(counterData.lastNumber || 0)
              : 0;

          const highestCurrentHour = Math.max(
            0,
            ...appointmentsRef.current
              .filter(
                (appointment) =>
                  appointment.id !== item.id &&
                  belongsToOffice(appointment, officeName) &&
                  isTicketForCurrentHour(appointment, dateKey, hourKey)
              )
              .map((appointment) => {
                const match = String(
                  appointment.queueNumber || ""
                ).match(/^SWDS-?(\d+)$/i);

                return match ? Number(match[1]) : 0;
              })
          );

          const nextNumber =
            Math.max(sameHourCounter, highestCurrentHour) + 1;

          const queueNumber = `SWDS-${String(nextNumber).padStart(3, "0")}`;

          transaction.set(
            counterRef,
            {
              office: officeName,
              queueDate: dateKey,
              queueHour: hourKey,
              lastNumber: nextNumber,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          const publicData = publicSnapshot.exists()
            ? publicSnapshot.data()
            : {};

          const sameHourPublicQueue =
            publicData.queueDate === dateKey &&
            Number(publicData.queueHour) === hourKey;

          const tickets = sameHourPublicQueue
            ? readTickets(publicData)
            : [];

          /*
           * FIX:
           * Preserve nowServing only if it matches a ticket that is
           * genuinely marked as serving. Stale values are cleared.
           */
          const validNowServing = sameHourPublicQueue
            ? getValidNowServing(publicData, tickets)
            : "";

          const approvedAppointment = {
            ...appointmentData,
            id: item.id,
            queueDate: dateKey,
            queueHour: hourKey,
            queuePosition: nextNumber,
          };

          transaction.set(
            publicQueueRef,
            {
              office: officeName,
              queueDate: dateKey,
              queueHour: hourKey,
              nowServing: validNowServing,
              tickets: [
                ...withoutTicket(tickets, item.id),
                publicTicket(
                  approvedAppointment,
                  "approved",
                  queueNumber
                ),
              ],
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          const approvalUpdates = {
            status: "approved",
            queueNumber,
            queuePosition: nextNumber,
            queueDate: dateKey,
            queueHour: hourKey,
            approvedAt: serverTimestamp(),
            approvedBy: staff.uid,
            approvedByEmail: staff.email || "",
            updatedAt: serverTimestamp(),
          };

          synchronizeServiceTaskWrites(
            transaction,
            appointmentRef,
            appointmentData,
            serviceTaskSnapshots,
            approvalUpdates
          );

          return queueNumber;
        }
      );

      setActionSuccess(
        `Appointment accepted. Queue number ${assignedNumber} assigned successfully.`
      );
    } catch (error) {
      console.error("Failed to accept appointment:", error);
      setActionError(error?.message || "Failed to accept appointment.");
    } finally {
      setProcessingId(null);
    }
  };

  useEffect(() => {
    if (CLOUD_AUTO_APPROVAL_ENABLED) return;
    if (processingId) return;
    if (!currentStaffUid) return;

    const nextAppointment = automaticApprovalAppointments.find(
      (item) => !autoApprovalAttempted.current.has(item.id)
    );

    if (!nextAppointment) return;

    autoApprovalAttempted.current.add(nextAppointment.id);

    handleAcceptAppointment(nextAppointment, {
      automatic: true,
    });
  }, [
    appointments,
    processingId,
    currentDateTime.date,
    currentDateTime.hour,
    currentDateTime.minutes,
    currentStaffUid,
  ]);

  const handleStartServing = async (item) => {
    if (processingId) return;

    if (officeHasCurrentlyServingAppointment) {
      setActionError(
        "Please complete the currently serving appointment first."
      );
      return;
    }

    const staff = auth.currentUser;

    if (!staff) {
      setActionError("Your session has expired. Please log in again.");
      return;
    }

    if (!isAssignedToCurrentStaff(item, staff)) {
      setActionError(
        "You cannot serve this appointment because it or one of its services is assigned to another staff member."
      );
      return;
    }

    setProcessingId(item.id);
    clearMessages();

    try {
      const queriedServiceTaskRefs =
        await getLinkedServiceTaskQueryRefs(item.id);

      const appointmentRef = doc(db, "appointments", item.id);
      const publicQueueRef = doc(
        db,
        PUBLIC_QUEUE_COLLECTION,
        officeName
      );

      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(appointmentRef);
        const publicSnapshot = await transaction.get(publicQueueRef);

        if (!snapshot.exists()) {
          throw new Error("Appointment not found.");
        }

        const data = snapshot.data();

        if (!belongsToOffice(data, officeName)) {
          throw new Error("This appointment does not belong to SWDS.");
        }

        assertStaffOwnsAppointment(data, staff);

        if (getStatus(data) !== "approved") {
          throw new Error(
            "Only approved appointments or registered walk-ins can be served."
          );
        }

        const serviceTaskSnapshots =
          await getLinkedServiceTaskSnapshots(
            transaction,
            data,
            item.id,
            staff,
            queriedServiceTaskRefs,
            ["approved", "confirmed"]
          );

        const dateTime = getManilaDateTime();
        const dateKey = dateTime.date;
        const hourKey = dateTime.hour;

        if (!isTicketForDay(data, dateKey)) {
          throw new Error(
            "This ticket belongs to a previous day and cannot be served today."
          );
        }

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
          throw new Error("This appointment has no assigned queue number.");
        }

        const publicData = publicSnapshot.data() || {};

        const sameHourPublicQueue =
          publicData.queueDate === dateKey &&
          Number(publicData.queueHour) === hourKey;

        const tickets = sameHourPublicQueue
          ? readTickets(publicData)
          : [];

        /*
         * FIX:
         * Do not block serving because of a stale nowServing value.
         * Only a matching ticket with an active serving status counts.
         */
        const validNowServing = sameHourPublicQueue
          ? getValidNowServing(publicData, tickets)
          : "";

        if (
          validNowServing &&
          validNowServing !== String(data.queueNumber).trim()
        ) {
          throw new Error("Another ticket is currently being served.");
        }

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
                {
                  ...data,
                  id: item.id,
                  queueDate: dateKey,
                  queueHour: hourKey,
                },
                "in-progress"
              ),
            ],
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        const servingUpdates = {
          status: "in-progress",
          servingAt: serverTimestamp(),
          servingBy: staff.uid,
          servingByEmail: staff.email || "",
          updatedAt: serverTimestamp(),
        };

        synchronizeServiceTaskWrites(
          transaction,
          appointmentRef,
          data,
          serviceTaskSnapshots,
          servingUpdates
        );
      });

      setActionSuccess(`Now serving ${item.queueNumber}.`);
    } catch (error) {
      console.error("Failed to start serving:", error);
      setActionError(error?.message || "Failed to start serving.");
    } finally {
      setProcessingId(null);
    }
  };

  /*
   * COMPLETION WORKFLOW
   *
   * The public queue is cleaned using the completed appointment's
   * saved queueDate, queueHour, and queueNumber.
   *
   * It no longer compares the queue against the current clock.
   * This prevents an old hourly queue from keeping a stale nowServing.
   */
    const handleCompleteAppointment = async (item) => {
      if (processingId) return;

      const staff = auth.currentUser;

      if (!staff) {
        setActionError("Your session has expired. Please log in again.");
        return;
      }

      if (!isAssignedToCurrentStaff(item, staff)) {
        setActionError(
          "You cannot complete this appointment because it or one of its services is assigned to another staff member."
        );
        return;
      }

      setProcessingId(item.id);
      clearMessages();

      try {
        const appointmentRef = doc(db, "appointments", item.id);

        const queriedServiceTaskRefs =
          await getLinkedServiceTaskQueryRefs(item.id);

        /*
        * COMPLETE THE PARENT APPOINTMENT AND ALL LINKED CHILD TASKS
        * IN ONE TRANSACTION.
        *
        * Do not call completeAppointment(item.id) here.
        * That callback performs a separate completion write and can
        * trigger Firestore permission errors before this transaction.
        */
        await runTransaction(db, async (transaction) => {
          const latestSnapshot = await transaction.get(appointmentRef);

          if (!latestSnapshot.exists()) {
            throw new Error("The appointment could not be found.");
          }

          const latestData = latestSnapshot.data();

          if (!belongsToOffice(latestData, officeName)) {
            throw new Error("This appointment does not belong to SWDS.");
          }

          assertStaffOwnsAppointment(latestData, staff);

          if (getStatus(latestData) === "completed") {
            throw new Error("This appointment has already been completed.");
          }

          if (
            ![
              "in-progress",
              "serving",
              "now-serving",
            ].includes(getStatus(latestData))
          ) {
            throw new Error(
              "Only an appointment currently being served can be completed."
            );
          }

          const serviceTaskSnapshots =
            await getLinkedServiceTaskSnapshots(
              transaction,
              latestData,
              item.id,
              staff,
              queriedServiceTaskRefs,
              [
                "in-progress",
                "serving",
                "now-serving",
              ]
            );

          const completionUpdates = {
            status: "completed",
            completedAt: serverTimestamp(),
            completedBy: staff.uid,
            completedByEmail: staff.email || "",
            updatedAt: serverTimestamp(),
          };

          synchronizeServiceTaskWrites(
            transaction,
            appointmentRef,
            latestData,
            serviceTaskSnapshots,
            completionUpdates
          );
        });

        /*
        * CLEAN THE PUBLIC QUEUE USING THE APPOINTMENT'S ORIGINAL
        * QUEUE DATE AND HOUR, NOT THE CURRENT DATE AND HOUR.
        */
        const publicQueueRef = doc(
          db,
          PUBLIC_QUEUE_COLLECTION,
          officeName
        );

        await runTransaction(db, async (transaction) => {
          const [completedAppointmentSnapshot, publicSnapshot] =
            await Promise.all([
              transaction.get(appointmentRef),
              transaction.get(publicQueueRef),
            ]);

          if (!completedAppointmentSnapshot.exists()) {
            throw new Error("The completed appointment could not be found.");
          }

          const completedData = completedAppointmentSnapshot.data();

          if (getStatus(completedData) !== "completed") {
            throw new Error(
              "The appointment has not been marked as completed."
            );
          }

          if (!belongsToOffice(completedData, officeName)) {
            throw new Error("This appointment does not belong to SWDS.");
          }

          const publicData = publicSnapshot.data() || {};
          const existingTickets = readTickets(publicData);

          const completedQueueNumber = String(
            completedData.queueNumber || item.queueNumber || ""
          ).trim();

          const sameQueue = isSameAppointmentQueue(
            publicData,
            completedData
          );

          const isCurrentlyServing =
            sameQueue &&
            completedQueueNumber &&
            String(publicData.nowServing || "").trim() ===
              completedQueueNumber;

          const remainingTickets = withoutTicket(
            existingTickets,
            item.id
          );

          /*
          * Clear nowServing if the completed ticket was serving.
          * Otherwise, retain it only if a remaining ticket confirms
          * that it is genuinely being served.
          */
          const nextNowServing = sameQueue
            ? isCurrentlyServing
              ? ""
              : getValidNowServing(publicData, remainingTickets)
            : publicData.nowServing || "";

          transaction.set(
            publicQueueRef,
            {
              office: officeName,
              nowServing: nextNowServing,
              tickets: remainingTickets,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        });

        let emailMessage = "";

        if (isWalkInAppointment(item)) {
          try {
            const emailResult = await sendWalkInCompletionEmail(
              item,
              officeName
            );

            if (emailResult.sent) {
              emailMessage =
                ` A completion email was successfully sent to ${emailResult.email}.`;
            }
          } catch (emailError) {
            console.error("Walk-in completion email failed:", emailError);

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
        setActionError(error?.message || "Failed to complete appointment.");
      } finally {
        setProcessingId(null);
      }
    };

  const openRejectModal = (appointment) => {
    const staff = auth.currentUser;

    if (!isAssignedToCurrentStaff(appointment, staff)) {
      setActionError(
        "You cannot reject this appointment because it or one of its services is assigned to another staff member."
      );
      return;
    }

    setAppointmentToReject(appointment);
    setRejectionReason("");
    setRejectionError("");
  };

  const closeRejectModal = () => {
    if (isRejecting) return;

    setAppointmentToReject(null);
    setRejectionReason("");
    setRejectionError("");
  };

  const handleConfirmRejection = async () => {
    const reason = rejectionReason.trim();

    if (!appointmentToReject) return;

    if (!reason) {
      setRejectionError(
        "Please provide a reason for rejecting this appointment."
      );
      return;
    }

    if (reason.length > 500) {
      setRejectionError(
        "The rejection reason cannot exceed 500 characters."
      );
      return;
    }

    if (isRejecting) return;

    const staff = auth.currentUser;

    if (!staff) {
      setRejectionError("Your session has expired. Please log in again.");
      return;
    }

    if (!isAssignedToCurrentStaff(appointmentToReject, staff)) {
      setRejectionError(
        "You cannot reject this appointment because it or one of its services is assigned to another staff member."
      );
      return;
    }

    setIsRejecting(true);
    setRejectionError("");

    try {
      const appointmentId = appointmentToReject.id;
      const appointmentRef = doc(db, "appointments", appointmentId);
      const rejectedAppointmentRef = doc(
        db,
        "rejected-appointments",
        appointmentId
      );
      const publicQueueRef = doc(
        db,
        PUBLIC_QUEUE_COLLECTION,
        officeName
      );

      const queriedServiceTaskRefs =
        await getLinkedServiceTaskQueryRefs(appointmentId);

      await runTransaction(db, async (transaction) => {
        const appointmentSnapshot = await transaction.get(appointmentRef);
        const publicSnapshot = await transaction.get(publicQueueRef);

        if (!appointmentSnapshot.exists()) {
          throw new Error("The appointment could not be found.");
        }

        const appointmentData = appointmentSnapshot.data();

        if (!belongsToOffice(appointmentData, officeName)) {
          throw new Error("This appointment does not belong to SWDS.");
        }

        assertStaffOwnsAppointment(appointmentData, staff);

        const currentStatus = getStatus(appointmentData);

        if (
          ["rejected", "completed", "cancelled", "canceled"].includes(
            currentStatus
          )
        ) {
          throw new Error("This appointment has already been processed.");
        }

        const serviceTaskSnapshots =
          await getLinkedServiceTaskSnapshots(
            transaction,
            appointmentData,
            appointmentId,
            staff,
            queriedServiceTaskRefs,
            [
              "pending",
              "waiting",
              "approved",
              "confirmed",
              "in-progress",
              "serving",
              "now-serving",
            ]
          );

        const rejectionDetails = {
          status: "rejected",
          rejectionReason: reason,
          rejectedAt: serverTimestamp(),
          rejectedBy: staff.uid,
          rejectedByEmail: staff.email || "",
          updatedAt: serverTimestamp(),
        };

        synchronizeServiceTaskWrites(
          transaction,
          appointmentRef,
          appointmentData,
          serviceTaskSnapshots,
          rejectionDetails
        );

        transaction.set(rejectedAppointmentRef, {
          ...appointmentData,
          id: appointmentId,
          appointmentId,
          ...rejectionDetails,
          ...buildParentServiceSyncData(
            appointmentData,
            serviceTaskSnapshots,
            rejectionDetails
          ),
        });

        /*
         * Use the rejected appointment's original queue slot.
         * Do not use today's date alone to decide whether to clear
         * the currently serving ticket.
         */
        const publicData = publicSnapshot.data() || {};
        const publicTickets = readTickets(publicData);

        const rejectedQueueNumber = String(
          appointmentData.queueNumber || ""
        ).trim();

        const sameQueue = isSameAppointmentQueue(
          publicData,
          appointmentData
        );

        const isCurrentlyServing =
          sameQueue &&
          rejectedQueueNumber &&
          String(publicData.nowServing || "").trim() ===
            rejectedQueueNumber;

        const remainingTickets = withoutTicket(
          publicTickets,
          appointmentId
        );

        /*
         * Preserve a serving value only when a remaining public ticket
         * confirms that it is actually being served.
         */
        const nextNowServing = sameQueue
          ? isCurrentlyServing
            ? ""
            : getValidNowServing(publicData, remainingTickets)
          : publicData.nowServing || "";

        transaction.set(
          publicQueueRef,
          {
            office: officeName,
            nowServing: nextNowServing,
            tickets: remainingTickets,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      });

      setAppointmentToReject(null);
      setRejectionReason("");
      setRejectionError("");

      setActionSuccess("Appointment rejected successfully.");
    } catch (error) {
      console.error("Failed to reject appointment:", error);

      setRejectionError(
        error?.message ||
          "Failed to reject the appointment. Please try again."
      );
    } finally {
      setIsRejecting(false);
    }
  };

  return {
    officeName,
    todayKey,
    currentDateTime,
    currentQueueHour,

    officeAppointments,
    validAppointments,
    completedCount,

    pendingAppointments,
    priorityLaneQueue,
    normalPendingAppointments,
    automaticApprovalAppointments,

    approvedPriority,
    normalAppointments,
    currentServing,
    upcomingQueue,
    laterDisplayAppointments,

    appointmentToReject,
    rejectionReason,
    isRejecting,
    rejectionError,

    processingId,
    actionError,
    actionSuccess,

    setActionError,
    setActionSuccess,
    setRejectionReason,
    setRejectionError,

    handleAcceptAppointment,
    handleStartServing,
    handleCompleteAppointment,

    openRejectModal,
    closeRejectModal,
    handleConfirmRejection,

    getServiceLabel,
    getQueueNumber,
    getStatus,
    isPending,
    isApproved,
    isServing,
  };
}
