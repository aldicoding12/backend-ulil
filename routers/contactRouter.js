// routes/contactRoutes.js
import express from "express";
import {
  submitContact,
  getContacts,
  getContact,
  updateContactStatus,
  deleteContact,
  getContactStats,
} from "../controllers/contactController.js";

const router = express.Router();

// Public routes
router.post("/", submitContact);

// Admin routes (require authentication)
router.get("/", getContacts);
router.get("/stats", getContactStats);
router.get("/:id", getContact);
router.put("/:id/status", updateContactStatus);
router.delete("/:id", deleteContact);

export default router;
