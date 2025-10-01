import express from "express";
import {
  createItem,
  getItems,
  getItemById,
  updateItem,
  deleteItem,
  getAvailableItems,
  submitBorrowingRequest,
  approveBorrowing,
  rejectBorrowing,
  markAsReturned,
  getBorrowingRequests,
  getUserBorrowingHistory,
  getDashboardStats,
} from "../controllers/inventoryController.js";
import upload from "../middlewares/upload.js";
import { jamaah, pengurus } from "../middlewares/authMiddleware.js";

const router = express.Router();

// ======================== ADMIN ROUTES ========================
// Perlu middleware pengurus untuk akses admin

// Dashboard stats
router.get("/admin", getDashboardStats);

// Inventory management
router.post("/", upload.single("image"), createItem);
router.get("/available", getAvailableItems);
router.get("/", getItems);
router.get("/:id", getItemById);
router.put("/:id", upload.single("image"), updateItem);
router.delete("/:id", deleteItem);

// Borrowing management
router.get("/borrowing-requests", getBorrowingRequests);
router.patch("/:itemId/borrowings/:borrowingId/approve", approveBorrowing);
router.patch("/:itemId/borrowings/:borrowingId/reject", rejectBorrowing);
router.patch("/:itemId/borrowings/:borrowingId/return", markAsReturned);

// ======================== USER/JAMAAH ROUTES ========================
// Untuk jamaah yang ingin melihat dan meminjam

// Browse available items for borrowing

// Get single item details
router.get("/items/:id", getItemById);

// Submit borrowing request - FIXED: Use document field name for file upload
router.post(
  "/items/:id/borrow",
  upload.single("document"),
  submitBorrowingRequest
);

// Get user's borrowing history
router.get("/users/:phoneNumber/history", getUserBorrowingHistory);

// ======================== SHARED ROUTES ========================
// Routes yang bisa diakses oleh admin dan user

// Health check
router.get("/health", (req, res) => {
  res.status(200).json({
    message: "Inventory service is running",
    timestamp: new Date().toISOString(),
  });
});

export default router;
