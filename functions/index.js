
const crypto = require("crypto");

const { setGlobalOptions } = require("firebase-functions/v2");
const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");

const logger = require("firebase-functions/logger");

const { initializeApp, getApps } = require("firebase-admin/app");

const {
  getFirestore,
  FieldValue,
} = require("firebase-admin/firestore");

// Initialize Firebase Admin only once.
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
const RATING_COLLECTION = "rating";

const TOKEN_PATTERN = /^[a-f0-9]{48}$/;
const MAX_REVIEW_LENGTH = 1000;

// =========================================
// FEEDBACK REFERENCE UTILITIES
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
  if (!value) {
    return null;
  }

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
// RECOVER OR CREATE TOKEN RECORD
// =========================================
//
// WalkIn.jsx already generates feedbackReference
// and saves it directly inside appointments.
//
// The original code did not create a matching
// publicFeedbackTokens document when a reference
// already existed.
//
// This function recovers the appointment using
// its existing feedbackReference and creates the
// missing hashed token document.
//
// It does NOT generate a different reference.
//

async function getOrCreateTokenRecord (token) {
  if (!validateToken(token)) {
    return null;
  }

  const tokenRef = db
    .collection(TOKEN_COLLECTION)
    .doc(hashToken(token));

  // Check whether the token record already exists.
  const existingToken = await tokenRef.get();

  if (existingToken.exists) {
    return existingToken;
  }

  // Find the appointment containing this exact reference.
  const matchingAppointments = await db
    .collection(APPOINTMENT_COLLECTION)
    .where("feedbackReference", "==", token)
    .limit(2)
    .get();

  if (matchingAppointments.empty) {
    logger.warn("Feedback reference not found in appointments.");

    return null;
  }

  // A feedback reference must belong to one appointment only.
  if (matchingAppointments.size > 1) {
    logger.error("Duplicate feedback references detected.");

    return null;
  }

  const matchingAppointment = matchingAppointments.docs[0];

  const appointmentRef = db
    .collection(APPOINTMENT_COLLECTION)
    .doc(matchingAppointment.id);

  // Create the missing token document transactionally.
  await db.runTransaction(async (transaction) => {
    // Read the token document first.
    const currentToken = await transaction.get(tokenRef);

    if (currentToken.exists) {
      return;
    }

    // Read the appointment.
    const appointmentSnapshot =
      await transaction.get(appointmentRef);

    if (!appointmentSnapshot.exists) {
      return;
    }

    const appointment = appointmentSnapshot.data();

    // Confirm that the original reference still belongs
    // to this appointment.
    if (appointment.feedbackReference !== token) {
      return;
    }

    // Create the matching hashed token document.
    transaction.create(tokenRef, {
      appointmentId: matchingAppointment.id,
      createdAt: FieldValue.serverTimestamp(),
      used: false,
    });

    logger.info("Recovered missing feedback token record.", {
      appointmentId: matchingAppointment.id,
    });
  });

  // Retrieve the token document after the transaction.
  const finalToken = await tokenRef.get();

  if (!finalToken.exists) {
    return null;
  }

  // Make sure the token belongs to the expected appointment.
  if (
    finalToken.data().appointmentId !== matchingAppointment.id
  ) {
    logger.error("Feedback token is associated with another appointment.");

    return null;
  }

  return finalToken;
}

// =========================================
// AUTOMATIC FEEDBACK REFERENCE ISSUANCE
// =========================================
//
// Automatically processes an appointment when
// its status becomes completed.
//
// 1. Preserve an existing valid feedbackReference.
// 2. Generate a reference only if one is missing or invalid.
// 3. Create the corresponding hashed token document.
// 4. Never overwrite an existing valid reference.
//

exports.issuePublicFeedbackReference = onDocumentWritten(
  {
    document: "appointments/{appointmentId}",
    retry: false,
  },
  async (event) => {
    const after = event.data?.after;

    if (!after || !after.exists) {
      return;
    }

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
        // Read the current appointment.
        const current = await transaction.get(appointmentRef);

        if (!current.exists) {
          return;
        }

        const data = current.data();

        if (data.status !== "completed") {
          return;
        }

        // Preserve the reference generated by WalkIn.jsx.
        // Only generate a new reference if it is missing or invalid.
        let token = data.feedbackReference;

        if (!validateToken(token)) {
          token = makeToken();
        }

        const tokenHash = hashToken(token);

        const tokenRef = db
          .collection(TOKEN_COLLECTION)
          .doc(tokenHash);

        // Read the token document before writing.
        const existingToken = await transaction.get(tokenRef);

        if (existingToken.exists) {
          const existingData = existingToken.data();

          // Prevent one feedback reference from being
          // associated with multiple appointments.
          if (existingData.appointmentId !== appointmentId) {
            throw new Error("FEEDBACK_TOKEN_COLLISION");
          }

          // The token document already exists and is correct.
          return;
        }

        // Create the matching token document.
        transaction.create(tokenRef, {
          appointmentId,
          createdAt: FieldValue.serverTimestamp(),
          used: false,
        });

        // Only update the appointment if a new reference
        // was necessary.
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
//
// POST /verify
// POST /submit
//
// No Firebase Authentication is required for visitors.
//
// A valid feedback reference must belong to an
// existing completed appointment.
//

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

    // Normalize the endpoint path.
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
      // =========================================
      // VERIFY COMPLETED APPOINTMENT
      // =========================================

      if (route === "/verify") {
        // Retrieve the token.
        // If it is missing, recover it using the
        // original feedbackReference in appointments.
        const ticket = await getOrCreateTokenRecord(token);

        if (!ticket || !ticket.exists) {
          return respond(res, 404, {
            error: "Feedback reference not found.",
          });
        }

        const ticketData = ticket.data();

        if (
          ticketData.used === true ||
          ticketData.usedAt
        ) {
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

        // Ensure this reference belongs to the appointment.
        if (appointment.feedbackReference !== token) {
          return respond(res, 403, {
            error: "Feedback reference is no longer valid.",
          });
        }

        // Check ratings previously submitted through
        // the mobile application or public website.
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

      // =========================================
      // SUBMIT RATING AND REVIEW
      // =========================================

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

        // Recover a missing token record before submitting.
        // This supports references generated by WalkIn.jsx.
        const ticket = await getOrCreateTokenRecord(token);

        if (!ticket || !ticket.exists) {
          return respond(res, 404, {
            error: "Feedback reference not found.",
          });
        }

        await db.runTransaction(async (transaction) => {
          // All transaction reads happen before writes.
          const currentTicket = await transaction.get(tokenRef);

          if (!currentTicket.exists) {
            throw new Error("INVALID_REFERENCE");
          }

          const ticketData = currentTicket.data();

          if (
            ticketData.used === true ||
            ticketData.usedAt
          ) {
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

          // Deterministic ID prevents duplicate public
          // submissions for the same appointment.
          const ratingRef = db
            .collection(RATING_COLLECTION)
            .doc(`public_${appointmentId}`);

          const existingPublicRating =
            await transaction.get(ratingRef);

          if (existingPublicRating.exists) {
            throw new Error("ALREADY_RATED");
          }

          // Also check existing mobile-app ratings,
          // which may use automatically generated IDs.
          const existingQuery = db
            .collection(RATING_COLLECTION)
            .where("appointmentId", "==", appointmentId)
            .limit(1);

          const existingRatings =
            await transaction.get(existingQuery);

          if (!existingRatings.empty) {
            throw new Error("ALREADY_RATED");
          }

          // All reads are complete. Perform writes.
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

          // Mark the feedback reference as used.
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
