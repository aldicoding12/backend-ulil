// routes/eventsRoutes.js - FIXED ROUTING ORDER
import express from "express";
import {
  // ========== EXISTING EVENT FUNCTIONS ==========
  createEvent,
  getEvents,
  getEvent,
  updateEvent,
  updateEventStatus,
  deleteEvent,
  addParticipant,
  updateParticipantStatus,
  removeParticipant,
  getEventsByCategory,
  getUpcomingEvents,
  getEventsStats,
  getEventsByDateRange,

  // ========== NEW: DONATION EVENT FUNCTIONS ==========
  createDonationEvent,
  updateDonationEvent,
  deleteDonationEvent,
  getActiveDonationEvents,
  getDonationId,
  getDonationEvents,
  getDonorsByEventId,
  getDonationStatistics,
  updateDonorStatus,
  getDonationEventDetails,
} from "../controllers/eventController.js";
import upload from "../middlewares/upload.js";
import { pengurus, jamaah } from "../middlewares/authMiddleware.js";

const router = express.Router();

// ========== IMPORTANT: SPECIFIC ROUTES FIRST (before /:id) ==========

// Stats route - MUST be before /:id route
router.get("/stats", getEventsStats);

// Other specific routes before /:id
router.get("/upcoming", getUpcomingEvents);
router.get("/category/:category", getEventsByCategory);
router.get("/date-range", getEventsByDateRange);

// ========== DONATION EVENT ROUTES (specific routes) ==========
// Public routes untuk donation events
router.get("/donations/active", getActiveDonationEvents); // Untuk frontend publik

// Protected routes untuk donation events only)
router.post("/donations", upload.single("image"), createDonationEvent);
router.get("/donations", getDonationEvents); // List dengan pagination
router.get("/donations/:id", getDonationId); // ambil berdasarkan id
router.put("/donations/:id", upload.single("image"), updateDonationEvent);
router.delete("/donations/:id", deleteDonationEvent);

// ========== GENERAL EVENT ROUTES ==========

// List and create events
router.get("/", getEvents);
router.post("/", upload.single("image"), createEvent);

// Participant management (specific routes before /:id)
router.post("/:id/participants", addParticipant); // Public registration
router.put("/:id/participants/:participantId", updateParticipantStatus);
router.delete("/:id/participants/:participantId", removeParticipant);

// Status management (specific route before /:id)
router.put("/:id/status", updateEventStatus);

// ========== DYNAMIC ROUTES (/:id) - MUST BE LAST ==========
router.get("/:id", getEvent);
router.put("/:id", upload.single("image"), updateEvent);
router.delete("/:id", deleteEvent);

///////////////////////
// Get donors by event ID
router.get("/donations/donors/:eventId", getDonorsByEventId);

// Get donation statistics by event ID
router.get("/donations/:eventId/statistics", getDonationStatistics);

// Update donor status
router.put("/donations/donor/:donorId/status", updateDonorStatus);

// Get donation event details with aggregated data
router.get("/donations/:eventId/details", getDonationEventDetails);

export default router;
