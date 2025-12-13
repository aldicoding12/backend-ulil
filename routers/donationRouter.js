// routes/donationRoutes.js
import express from "express";
import {
  createDonation,
  handleMidtransNotification,
  handleMidtransRedirect,
  getDonationHistory,
  getDonationById,
  getDonationStats,
  checkDonationStatus,
  getAllDonationStats,
} from "../controllers/donationController.js";

const router = express.Router();

// ✅ PENTING: Route spesifik HARUS DI ATAS route dengan parameter :id/:orderId

// 1. Route notification (paling atas karena paling penting)
router.post("/notification", handleMidtransNotification);
router.get("/notification", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Notification endpoint is working",
    timestamp: new Date().toISOString(),
  });
});

// 2. Route redirect dari Midtrans
router.get("/success", handleMidtransRedirect);
router.get("/error", handleMidtransRedirect);
router.get("/pending", handleMidtransRedirect);

// 3. Route stats (spesifik harus di atas :id)
router.get("/stats/all", getAllDonationStats);
router.get("/stats/:eventId", getDonationStats);

// 4. Route status check
router.get("/status/:orderId", checkDonationStatus);

// 5. Public routes
router.post("/", createDonation);
router.get("/", getDonationHistory);

// 6. ⚠️ Route dengan parameter :id HARUS PALING BAWAH
router.get("/:id", getDonationById);

export default router;
