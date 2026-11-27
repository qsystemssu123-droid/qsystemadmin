
const crypto = require("crypto");

const { setGlobalOptions } = require("firebase-functions/v2");
const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");

const logger = require("firebase-functions/logger");

const { initializeApp, getApps } = require("firebase-admin/app");

const {
  getFirestore,
  FieldValue,
} = require("firebase-admin/firestore");

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

setGlobalOptions({
  region: "asia-southeast1",
  maxInstances: 10,
});

const TOKEN_COLLECTION = "publicFeedbackTokens";
const APPOINTMENT_COLLECTION = "appointments";
const SERVICE_TASK_COLLECTION = "appointment_services";
const RATING_COLLECTION = "rating";

const TOKEN_PATTERN = /^[a-f0-9]{48}$/;
const MAX_REVIEW_LENGTH = 1000;

const SWDS_OFFICE = "SWDS";
const SWDS_QUEUE_COLLECTION = "queues";
const SWDS_COUNTER_COLLECTION = "queue-counters";
const PHILIPPINE_TIME_ZONE = "Asia/Manila";

const GUIDANCE_COUNSELING_SERVICE_ID = "guidance_counseling";

const COUNSELING_SERVICES = [
  "Guidance & Counseling Services",
  "Guidance and Counseling Services",
  GUIDANCE_COUNSELING_SERVICE_ID,
];

// =========================================
// SHARED UTILITIES
// =========================================

function hashToken (token) {
  return crypto
    .createHash("sha256")
    .update(token, "utf8")
    .digest("hex");
}

function makeToken () {
  return crypto.randomBytes(24).toString("hex");
}

function respond (res, status, data) {
  return res.status(status).json(data);
}

function formatTimestamp (value) {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

function safeAppointment (data) {
  return {
    userName: data.userName || "Student",
    office: data.office || "",
    service: data.service || data.reason || "",
    queueNumber: data.queueNumber || "",
    appointmentDate: data.appointmentDate || "",
    appointmentTime: data.appointmentTime || "",
    scheduledAt: formatTimestamp(data.scheduledAt),
    status: "completed",
  };
}

function getErrorResponse (error) {
  const messages = {
    INVALID_REFERENCE: {
      status: 404,
      message: "Feedback reference not found.",
    },
    ALREADY_RATED: {
      status: 409,
      message: "This appointment has already been rated.",
    },
    APPOINTMENT_NOT_FOUND: {
      status: 404,
      message: "Appointment not found.",
    },
    NOT_COMPLETED: {
      status: 403,
      message: "Only completed appointments can be rated.",
    },
  };

  return messages[error.message] || null;
}

function validateToken (token) {
  return (
    typeof token === "string" &&
    TOKEN_PATTERN.test(token)
  );
}

function validateRating (rating) {
  return (
    Number.isInteger(rating) &&
    rating >= 1 &&
    rating <= 5
  );
}

function validateReview (reviewText) {
  return (
    typeof reviewText === "string" &&
    reviewText.trim().length > 0 &&
    reviewText.trim().length <= MAX_REVIEW_LENGTH
  );
}

// =========================================
// SWDS AUTOMATIC APPROVAL UTILITIES
// =========================================

function normalizeServiceName (value) {
  return typeof value === "string"
    ? value
      .trim()
      .replace(/&/g, "and")
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, " ")
      .toLowerCase()
    : "";
}

function getAppointmentServices (item) {
  const services = [];

  const addService = (value) => {
    if (typeof value === "string") {
      const normalized = value.trim();

      if (normalized) services.push(normalized);
      return;
    }

    if (value && typeof value === "object") {
      [
        value.serviceName,
        value.name,
        value.label,
        value.service,
        value.title,
        value.serviceId,
        value.service_id,
        value.id,
        value.value,
      ].forEach((name) => {
        if (typeof name === "string" && name.trim()) {
          services.push(name.trim());
        }
      });
    }
  };

  [
    "services",
    "selectedServices",
    "serviceNames",
    "serviceIds",
    "selectedServiceIds",
  ].forEach((field) => {
    if (Array.isArray(item?.[field])) {
      item[field].forEach(addService);
    }
  });

  if (typeof item?.service === "string") {
    item.service.split(",").forEach(addService);
  }

  [
    "serviceName",
    "selectedService",
    "serviceId",
    "service_id",
  ].forEach((field) => {
    if (typeof item?.[field] === "string") {
      addService(item[field]);
    }
  });

  return [...new Set(services)];
}

function requiresCounselingConfirmation (item) {
  const selectedServices = getAppointmentServices(item).map(
    normalizeServiceName,
  );

  const counselingNames = COUNSELING_SERVICES.map(
    normalizeServiceName,
  );

  return selectedServices.some((service) =>
    counselingNames.includes(service),
  );
}

function belongsToSWDS (item) {
  const office = String(
    item?.office ||
      item?.officeName ||
      item?.department ||
      "",
  )
    .trim()
    .toLowerCase();

  return (
    office === "swds" ||
    office.startsWith("swds -") ||
    office.startsWith("swds ") ||
    office.includes("swds")
  );
}

function getManilaDateTime (date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PHILIPPINE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const value = (type) =>
    parts.find((part) => part.type === type)?.value || "";

  const hour = Number(value("hour"));
  const minute = Number(value("minute"));

  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    hour,
    minutes: hour * 60 + minute,
  };
}

function getScheduledDate (item) {
  const value =
    item?.rescheduledToDate ||
    item?.appointmentDate ||
    "";

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

  if (!date || Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PHILIPPINE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const valueOf = (type) =>
    parts.find((part) => part.type === type)?.value || "";

  return `${valueOf("year")}-${valueOf("month")}-${valueOf("day")}`;
}

function getScheduledTime (item) {
  return item?.rescheduledToTime || item?.appointmentTime || "";
}

function convertTimeToMinutes (time) {
  if (typeof time !== "string" || !time.trim()) {
    return null;
  }

  const normalized = time.trim().toUpperCase();

  const twelveHourMatch = normalized.match(
    /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/,
  );

  if (twelveHourMatch) {
    let hours = Number(twelveHourMatch[1]);
    const minutes = Number(twelveHourMatch[2]);
    const period = twelveHourMatch[3];

    if (
      hours < 1 ||
      hours > 12 ||
      minutes < 0 ||
      minutes > 59
    ) {
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
    /^(\d{1,2}):(\d{2})(?::\d{2})?$/,
  );

  if (twentyFourHourMatch) {
    const hours = Number(twentyFourHourMatch[1]);
    const minutes = Number(twentyFourHourMatch[2]);

    if (
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      return null;
    }

    return hours * 60 + minutes;
  }

  return null;
}

function isAppointmentReady (item, currentDateTime) {
  const scheduledDate = getScheduledDate(item);
  const scheduledMinutes = convertTimeToMinutes(
    getScheduledTime(item),
  );

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate) ||
    scheduledMinutes === null
  ) {
    return false;
  }

  if (scheduledDate > currentDateTime.date) return false;
  if (scheduledDate < currentDateTime.date) return true;

  return scheduledMinutes <= currentDateTime.minutes;
}

function readQueueTickets (data) {
  return Array.isArray(data?.tickets) ? data.tickets : [];
}

function getHighestQueueNumber (tickets) {
  return tickets.reduce((highest, ticket) => {
    const match = String(ticket?.queueNumber || "").match(
      /^SWDS-?(\d+)$/i,
    );

    return match
      ? Math.max(highest, Number(match[1]))
      : highest;
  }, 0);
}

function makePublicTicket (
  appointmentId,
  appointment,
  queueNumber,
  queueDate,
  queueHour,
  queuePosition,
) {
  return {
    appointmentId,
    queueNumber,
    status: "approved",
    isPriority: appointment.isPriority === true,
    queuePosition,
    queueDate,
    queueHour,
  };
}

// =========================================
// SWDS SERVICE TASK UTILITIES
// =========================================

function getServiceTaskIds (appointment) {
  const ids = new Set();

  if (Array.isArray(appointment?.serviceTaskIds)) {
    appointment.serviceTaskIds.forEach((id) => {
      if (typeof id === "string" && id.trim()) {
        ids.add(id.trim());
      }
    });
  }

  if (Array.isArray(appointment?.services)) {
    appointment.services.forEach((service) => {
      if (!service || typeof service !== "object") return;

      const id =
        service.serviceTaskId ||
        service.serviceTaskID ||
        service.taskId ||
        "";

      if (typeof id === "string" && id.trim()) {
        ids.add(id.trim());
      }
    });
  }

  return [...ids];
}

function belongsToAppointment (task, appointmentId) {
  const taskAppointmentId =
    task?.appointmentId ||
    task?.parentAppointmentId ||
    "";

  return !taskAppointmentId || taskAppointmentId === appointmentId;
}

function isApprovableTaskStatus (task) {
  const status = String(task?.status || "pending")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  return ["pending", "waiting"].includes(status);
}

function updateEmbeddedServices (
  services,
  queueNumber,
  queuePosition,
  queueDate,
  queueHour,
) {
  if (!Array.isArray(services)) return services;

  return services.map((service) => {
    if (!service || typeof service !== "object") {
      return service;
    }

    const serviceName = normalizeServiceName(
      service.serviceName ||
      service.name ||
      service.label ||
      service.service ||
      service.serviceId ||
      service.id ||
      "",
    );

    const counselingNames = COUNSELING_SERVICES.map(
      normalizeServiceName,
    );

    if (counselingNames.includes(serviceName)) {
      return service;
    }

    const status = String(service.status || "pending")
      .trim()
      .toLowerCase();

    if (!["pending", "waiting"].includes(status)) {
      return service;
    }

    return {
      ...service,
      status: "approved",
      queueNumber,
      queuePosition,
      queueDate,
      queueHour,
      approvedAt: new Date(),
      approvedBy: "system",
      approvedByEmail: "",
    };
  });
}

// =========================================
// SWDS AUTOMATIC APPROVAL PROCESSOR
// =========================================
//
// Runs every minute, independently of staff dashboards.
//
// Non-Guidance SWDS appointments are approved when their
// scheduled Manila date and time arrive.
//
// Guidance & Counseling remains pending for manual approval.
//
// Queue allocation uses the same office-wide counter and
// public queue documents used by the SWDS staff application.
//
// Parent appointments, child service tasks, and embedded
// services are updated together in one Firestore transaction.
//

async function automaticallyApproveSWDSAppointment (
  appointmentRef,
) {
  const counterRef = db
    .collection(SWDS_COUNTER_COLLECTION)
    .doc(SWDS_OFFICE);

  const publicQueueRef = db
    .collection(SWDS_QUEUE_COLLECTION)
    .doc(SWDS_OFFICE);

  return db.runTransaction(async (transaction) => {
    // =========================================
    // READ PARENT, COUNTER, AND PUBLIC QUEUE
    // =========================================

    const appointmentSnapshot = await transaction.get(
      appointmentRef,
    );

    const counterSnapshot = await transaction.get(counterRef);
    const publicSnapshot = await transaction.get(publicQueueRef);

    if (!appointmentSnapshot.exists) {
      return { approved: false, reason: "not-found" };
    }

    const appointment = appointmentSnapshot.data();

    const status = String(appointment.status || "pending")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

    if (!["pending", "waiting"].includes(status)) {
      return { approved: false, reason: "already-processed" };
    }

    if (!belongsToSWDS(appointment)) {
      return { approved: false, reason: "different-office" };
    }

    if (requiresCounselingConfirmation(appointment)) {
      return {
        approved: false,
        reason: "manual-guidance-approval",
      };
    }

    const approvalDateTime = getManilaDateTime();

    if (!isAppointmentReady(appointment, approvalDateTime)) {
      return { approved: false, reason: "not-yet-scheduled" };
    }

    const dateKey = approvalDateTime.date;
    const hourKey = approvalDateTime.hour;

    // =========================================
    // READ CHILD SERVICE TASKS
    // =========================================

    const appointmentId = appointmentRef.id;
    const serviceTaskIds = getServiceTaskIds(appointment);

    const serviceTaskRefs = serviceTaskIds.map((taskId) =>
      db.collection(SERVICE_TASK_COLLECTION).doc(taskId),
    );

    const serviceTaskSnapshots = [];

    for (const taskRef of serviceTaskRefs) {
      const taskSnapshot = await transaction.get(taskRef);
      serviceTaskSnapshots.push(taskSnapshot);
    }

    // Find tasks linked through appointmentId.
    const appointmentTaskQuery = db
      .collection(SERVICE_TASK_COLLECTION)
      .where("appointmentId", "==", appointmentId);

    const queriedAppointmentTasks = await transaction.get(
      appointmentTaskQuery,
    );

    // Also find tasks linked through parentAppointmentId.
    const parentTaskQuery = db
      .collection(SERVICE_TASK_COLLECTION)
      .where("parentAppointmentId", "==", appointmentId);

    const queriedParentTasks = await transaction.get(
      parentTaskQuery,
    );

    const serviceTaskMap = new Map();

    const addTaskSnapshot = (snapshot) => {
      if (!snapshot.exists) return;

      const task = snapshot.data();

      if (!belongsToAppointment(task, appointmentId)) {
        return;
      }

      serviceTaskMap.set(snapshot.id, snapshot);
    };

    serviceTaskSnapshots.forEach(addTaskSnapshot);
    queriedAppointmentTasks.docs.forEach(addTaskSnapshot);
    queriedParentTasks.docs.forEach(addTaskSnapshot);

    // Only update tasks that are still pending or waiting.
    const eligibleServiceTasks = [...serviceTaskMap.values()]
      .filter((snapshot) =>
        isApprovableTaskStatus(snapshot.data()),
      );

    // =========================================
    // CALCULATE QUEUE NUMBER
    // =========================================

    const counterData = counterSnapshot.exists
      ? counterSnapshot.data()
      : {};

    const sameHourCounter =
      counterData.queueDate === dateKey &&
      Number(counterData.queueHour) === hourKey
        ? Number(counterData.lastNumber || 0)
        : 0;

    const publicData = publicSnapshot.exists
      ? publicSnapshot.data()
      : {};

    const sameHourPublicQueue =
      publicData.queueDate === dateKey &&
      Number(publicData.queueHour) === hourKey;

    const existingTickets = sameHourPublicQueue
      ? readQueueTickets(publicData)
      : [];

    const highestPublicNumber =
      getHighestQueueNumber(existingTickets);

    const nextNumber =
      Math.max(sameHourCounter, highestPublicNumber) + 1;

    const queueNumber = `SWDS-${String(nextNumber).padStart(3, "0")}`;

    const updatedTickets = [
      ...existingTickets.filter(
        (ticket) => ticket.appointmentId !== appointmentId,
      ),
      makePublicTicket(
        appointmentId,
        appointment,
        queueNumber,
        dateKey,
        hourKey,
        nextNumber,
      ),
    ];

    // =========================================
    // UPDATE QUEUE COUNTER
    // =========================================

    transaction.set(
      counterRef,
      {
        office: SWDS_OFFICE,
        queueDate: dateKey,
        queueHour: hourKey,
        lastNumber: nextNumber,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    // =========================================
    // UPDATE PUBLIC QUEUE
    // =========================================

    transaction.set(
      publicQueueRef,
      {
        office: SWDS_OFFICE,
        queueDate: dateKey,
        queueHour: hourKey,
        nowServing: sameHourPublicQueue
          ? publicData.nowServing || ""
          : "",
        tickets: updatedTickets,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    // =========================================
    // UPDATE CHILD SERVICE TASKS
    // =========================================

    let updatedServiceTaskCount = 0;

    eligibleServiceTasks.forEach((snapshot) => {
      transaction.update(snapshot.ref, {
        status: "approved",
        queueNumber,
        queuePosition: nextNumber,
        queueDate: dateKey,
        queueHour: hourKey,
        approvedAt: FieldValue.serverTimestamp(),
        approvedBy: "system",
        approvedByEmail: "",
        updatedAt: FieldValue.serverTimestamp(),
      });

      updatedServiceTaskCount++;
    });

    // =========================================
    // UPDATE PARENT APPOINTMENT
    // =========================================

    const parentUpdate = {
      status: "approved",
      queueNumber,
      queuePosition: nextNumber,
      queueDate: dateKey,
      queueHour: hourKey,
      approvedAt: FieldValue.serverTimestamp(),
      approvedBy: "system",
      approvedByEmail: "",
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (Array.isArray(appointment.services)) {
      parentUpdate.services = updateEmbeddedServices(
        appointment.services,
        queueNumber,
        nextNumber,
        dateKey,
        hourKey,
      );
    }

    if (typeof appointment.pendingServices === "number") {
      parentUpdate.pendingServices = Math.max(
        0,
        appointment.pendingServices - updatedServiceTaskCount,
      );
    }

    transaction.update(appointmentRef, parentUpdate);

    return {
      approved: true,
      appointmentId,
      queueNumber,
      updatedServiceTaskCount,
    };
  });
}

// =========================================
// SWDS AUTOMATIC APPROVAL SCHEDULE
// =========================================

exports.autoApproveSWDSAppointments = onSchedule(
  {
    schedule: "every 1 minutes",
    timeZone: PHILIPPINE_TIME_ZONE,
    retryCount: 0,
    maxInstances: 1,
  },
  async () => {
    logger.info("Starting SWDS automatic appointment approval.");

    const [pendingSnapshot, waitingSnapshot] = await Promise.all([
      db
        .collection(APPOINTMENT_COLLECTION)
        .where("status", "==", "pending")
        .get(),

      db
        .collection(APPOINTMENT_COLLECTION)
        .where("status", "==", "waiting")
        .get(),
    ]);

    const appointments = new Map();

    pendingSnapshot.docs.forEach((snapshot) => {
      appointments.set(snapshot.id, snapshot);
    });

    waitingSnapshot.docs.forEach((snapshot) => {
      appointments.set(snapshot.id, snapshot);
    });

    let approvedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const snapshot of appointments.values()) {
      const appointment = snapshot.data();

      if (!belongsToSWDS(appointment)) continue;

      if (requiresCounselingConfirmation(appointment)) {
        skippedCount++;
        continue;
      }

      if (!isAppointmentReady(appointment, getManilaDateTime())) {
        continue;
      }

      try {
        const result = await automaticallyApproveSWDSAppointment(
          snapshot.ref,
        );

        if (result.approved) {
          approvedCount++;

          logger.info("SWDS appointment automatically approved.", {
            appointmentId: result.appointmentId,
            queueNumber: result.queueNumber,
            updatedServiceTaskCount: result.updatedServiceTaskCount,
          });
        } else {
          skippedCount++;

          logger.info("SWDS appointment skipped during approval.", {
            appointmentId: snapshot.id,
            reason: result.reason,
          });
        }
      } catch (error) {
        failedCount++;

        logger.error("SWDS automatic approval failed.", {
          appointmentId: snapshot.id,
          error: error.message,
        });
      }
    }

    logger.info("SWDS automatic approval finished.", {
      approvedCount,
      skippedCount,
      failedCount,
    });
  },
);

// =========================================
// RECOVER OR CREATE TOKEN RECORD
// =========================================

async function getOrCreateTokenRecord (token) {
  if (!validateToken(token)) return null;

  const tokenRef = db
    .collection(TOKEN_COLLECTION)
    .doc(hashToken(token));

  const existingToken = await tokenRef.get();

  if (existingToken.exists) return existingToken;

  const matchingAppointments = await db
    .collection(APPOINTMENT_COLLECTION)
    .where("feedbackReference", "==", token)
    .limit(2)
    .get();

  if (matchingAppointments.empty) {
    logger.warn("Feedback reference not found in appointments.");
    return null;
  }

  if (matchingAppointments.size > 1) {
    logger.error("Duplicate feedback references detected.");
    return null;
  }

  const matchingAppointment = matchingAppointments.docs[0];

  const appointmentRef = db
    .collection(APPOINTMENT_COLLECTION)
    .doc(matchingAppointment.id);

  await db.runTransaction(async (transaction) => {
    const currentToken = await transaction.get(tokenRef);

    if (currentToken.exists) return;

    const appointmentSnapshot =
      await transaction.get(appointmentRef);

    if (!appointmentSnapshot.exists) return;

    const appointment = appointmentSnapshot.data();

    if (appointment.feedbackReference !== token) return;

    transaction.create(tokenRef, {
      appointmentId: matchingAppointment.id,
      createdAt: FieldValue.serverTimestamp(),
      used: false,
    });

    logger.info("Recovered missing feedback token record.", {
      appointmentId: matchingAppointment.id,
    });
  });

  const finalToken = await tokenRef.get();

  if (!finalToken.exists) return null;

  if (
    finalToken.data().appointmentId !== matchingAppointment.id
  ) {
    logger.error(
      "Feedback token is associated with another appointment.",
    );
    return null;
  }

  return finalToken;
}

// =========================================
// AUTOMATIC FEEDBACK REFERENCE ISSUANCE
// =========================================

exports.issuePublicFeedbackReference = onDocumentWritten(
  {
    document: "appointments/{appointmentId}",
    retry: false,
  },
  async (event) => {
    const after = event.data?.after;

    if (!after || !after.exists) return;

    const appointment = after.data();

    if (!appointment || appointment.status !== "completed") {
      return;
    }

    const appointmentId = event.params.appointmentId;

    const appointmentRef = db
      .collection(APPOINTMENT_COLLECTION)
      .doc(appointmentId);

    try {
      await db.runTransaction(async (transaction) => {
        const current = await transaction.get(appointmentRef);

        if (!current.exists) return;

        const data = current.data();

        if (data.status !== "completed") return;

        let token = data.feedbackReference;

        if (!validateToken(token)) {
          token = makeToken();
        }

        const tokenHash = hashToken(token);

        const tokenRef = db
          .collection(TOKEN_COLLECTION)
          .doc(tokenHash);

        const existingToken = await transaction.get(tokenRef);

        if (existingToken.exists) {
          const existingData = existingToken.data();

          if (existingData.appointmentId !== appointmentId) {
            throw new Error("FEEDBACK_TOKEN_COLLISION");
          }

          return;
        }

        transaction.create(tokenRef, {
          appointmentId,
          createdAt: FieldValue.serverTimestamp(),
          used: false,
        });

        if (data.feedbackReference !== token) {
          transaction.update(appointmentRef, {
            feedbackReference: token,
            feedbackReferenceIssuedAt:
              FieldValue.serverTimestamp(),
          });
        }

        logger.info("Feedback reference processed successfully.", {
          appointmentId,
        });
      });
    } catch (error) {
      logger.error(
        "Failed to generate or register feedback reference.",
        {
          appointmentId,
          error: error.message,
        },
      );

      throw error;
    }
  },
);

// =========================================
// PUBLIC FEEDBACK API
// =========================================

exports.publicFeedbackApi = onRequest(
  {
    cors: true,
    maxInstances: 10,
    timeoutSeconds: 30,
    memory: "256MiB",
  },
  async (req, res) => {
    res.set("Cache-Control", "no-store");

    if (req.method !== "POST") {
      return respond(res, 405, {
        error: "Method not allowed.",
      });
    }

    const route = (req.path || "/").replace(/\/+$/, "") || "/";
    const token = req.body?.token;

    if (route !== "/verify" && route !== "/submit") {
      return respond(res, 404, {
        error: "Endpoint not found.",
      });
    }

    if (!validateToken(token)) {
      return respond(res, 400, {
        error: "Invalid feedback reference.",
      });
    }

    const tokenRef = db
      .collection(TOKEN_COLLECTION)
      .doc(hashToken(token));

    try {
      if (route === "/verify") {
        const ticket = await getOrCreateTokenRecord(token);

        if (!ticket || !ticket.exists) {
          return respond(res, 404, {
            error: "Feedback reference not found.",
          });
        }

        const ticketData = ticket.data();

        if (ticketData.used === true || ticketData.usedAt) {
          return respond(res, 409, {
            error: "This appointment has already been rated.",
          });
        }

        const appointmentId = ticketData.appointmentId;

        if (
          typeof appointmentId !== "string" ||
          !appointmentId
        ) {
          return respond(res, 404, {
            error: "Invalid appointment reference.",
          });
        }

        const appointmentRef = db
          .collection(APPOINTMENT_COLLECTION)
          .doc(appointmentId);

        const appointmentSnap = await appointmentRef.get();

        if (!appointmentSnap.exists) {
          return respond(res, 404, {
            error: "Appointment not found.",
          });
        }

        const appointment = appointmentSnap.data();

        if (appointment.status !== "completed") {
          return respond(res, 403, {
            error: "Only completed appointments can be rated.",
          });
        }

        if (appointment.feedbackReference !== token) {
          return respond(res, 403, {
            error: "Feedback reference is no longer valid.",
          });
        }

        const existingRatings = await db
          .collection(RATING_COLLECTION)
          .where("appointmentId", "==", appointmentId)
          .limit(1)
          .get();

        if (!existingRatings.empty) {
          return respond(res, 409, {
            error: "A rating already exists for this appointment.",
          });
        }

        return respond(res, 200, {
          success: true,
          appointment: safeAppointment(appointment),
        });
      }

      if (route === "/submit") {
        const rating = req.body?.rating;
        const reviewText = req.body?.reviewText;

        if (!validateRating(rating)) {
          return respond(res, 400, {
            error: "Please select a rating from 1 to 5.",
          });
        }

        if (!validateReview(reviewText)) {
          return respond(res, 400, {
            error: "Review must contain 1 to 1000 characters.",
          });
        }

        const cleanReview = reviewText.trim();

        const ticket = await getOrCreateTokenRecord(token);

        if (!ticket || !ticket.exists) {
          return respond(res, 404, {
            error: "Feedback reference not found.",
          });
        }

        await db.runTransaction(async (transaction) => {
          const currentTicket = await transaction.get(tokenRef);

          if (!currentTicket.exists) {
            throw new Error("INVALID_REFERENCE");
          }

          const ticketData = currentTicket.data();

          if (ticketData.used === true || ticketData.usedAt) {
            throw new Error("ALREADY_RATED");
          }

          const appointmentId = ticketData.appointmentId;

          if (
            typeof appointmentId !== "string" ||
            !appointmentId
          ) {
            throw new Error("INVALID_REFERENCE");
          }

          const appointmentRef = db
            .collection(APPOINTMENT_COLLECTION)
            .doc(appointmentId);

          const appointmentSnap =
            await transaction.get(appointmentRef);

          if (!appointmentSnap.exists) {
            throw new Error("APPOINTMENT_NOT_FOUND");
          }

          const appointment = appointmentSnap.data();

          if (appointment.status !== "completed") {
            throw new Error("NOT_COMPLETED");
          }

          if (appointment.feedbackReference !== token) {
            throw new Error("INVALID_REFERENCE");
          }

          const ratingRef = db
            .collection(RATING_COLLECTION)
            .doc(`public_${appointmentId}`);

          const existingPublicRating =
            await transaction.get(ratingRef);

          if (existingPublicRating.exists) {
            throw new Error("ALREADY_RATED");
          }

          const existingQuery = db
            .collection(RATING_COLLECTION)
            .where("appointmentId", "==", appointmentId)
            .limit(1);

          const existingRatings =
            await transaction.get(existingQuery);

          if (!existingRatings.empty) {
            throw new Error("ALREADY_RATED");
          }

          transaction.create(ratingRef, {
            appointmentId,
            createdAt: FieldValue.serverTimestamp(),
            office: appointment.office || "",
            queueNumber: appointment.queueNumber || "",
            rating,
            reviewText: cleanReview,
            service:
              appointment.service ||
              appointment.reason ||
              "",
            userId: appointment.userId || "",
          });

          transaction.update(tokenRef, {
            used: true,
            usedAt: FieldValue.serverTimestamp(),
          });
        });

        return respond(res, 200, {
          success: true,
          message: "Rating submitted successfully.",
        });
      }
    } catch (error) {
      logger.error("Public feedback API error.", {
        route,
        message: error.message,
      });

      const knownError = getErrorResponse(error);

      if (knownError) {
        return respond(res, knownError.status, {
          error: knownError.message,
        });
      }

      return respond(res, 500, {
        error: "Unable to process feedback. Please try again.",
      });
    }
  },
);
