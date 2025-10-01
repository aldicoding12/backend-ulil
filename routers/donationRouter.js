// routes/donationRoutes.js
import express from "express";
import {
  createDonation,
  handleMidtransNotification,
  handleMidtransRedirect, // Import fungsi baru
  getDonationHistory,
  getDonationById,
  getDonationStats,
  checkDonationStatus,
  getAllDonationStats,
} from "../controllers/donationController.js";

const router = express.Router();

// Public routes
router.post("/", createDonation);
router.post("/notification", handleMidtransNotification);
router.get("/status/:orderId", checkDonationStatus);

// TAMBAHAN: Route untuk handle redirect dari Midtrans
router.get("/success", handleMidtransRedirect);
router.get("/error", handleMidtransRedirect);
router.get("/pending", handleMidtransRedirect);

// Private routes (tambahkan middleware auth jika diperlukan)
router.get("/", getDonationHistory);
router.get("/stats/:eventId", getDonationStats);
router.get("/:id", getDonationById);

router.get("/stats/all", getAllDonationStats);

export default router;
