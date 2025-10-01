import express from "express";
import {
  createProfile,
  getProfile,
  updateProfile,
  deleteProfile,
} from "../controllers/profileController.js";
import { upload } from "../middlewares/upload.js";
import { jamaah, pengurus } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Create profile with logo upload (hanya pengurus yang bisa)
router.post("/", upload.single("image"), createProfile);

// Get profile (dapat diakses semua orang)
router.get("/", getProfile);

// Update profile by ID with optional logo upload (hanya pengurus yang bisa)
router.put("/:id", upload.single("image"), updateProfile);

// Delete profile by ID (hanya pengurus yang bisa)
router.delete("/:id", deleteProfile);

export default router;
