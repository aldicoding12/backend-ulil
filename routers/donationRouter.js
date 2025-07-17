import express from "express";
import {
  createDonation,
  handleMidtransNotification,
  getDonationHistory,
  getDonationById,
  getDonationStats,
  checkDonationStatus,
} from "../controllers/donationController.js";
import { pengurus } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Public routes
router.post("/", createDonation); // Buat donasi baru
router.post("/notification", handleMidtransNotification); // Midtrans webhook
router.get("/status/:orderId", checkDonationStatus); // Check status by order ID

// Protected routes (Pengurus only)
router.get("/", getDonationHistory); // History dengan pagination
router.get("/:id", getDonationById); // Detail donasi
router.get("/stats/:eventId", getDonationStats); // Statistik per event

export default router;
