// routes/galeri.routes.js
import express from "express";
import {
  getAllGaleri,
  getGaleriById,
  createGaleri,
  updateGaleri,
  deleteGaleri,
  getCategories,
} from "../controllers/GaleriController.js";
import upload from "../middlewares/upload.js";
import { jamaah, pengurus } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Public routes
router.get("/", getAllGaleri);
router.get("/categories", getCategories);
router.get("/:id", getGaleriById);

// Protected routes (Admin only)
// Gunakan .array("images", 10) untuk multiple upload, max 10 files
router.post("/", upload.array("images", 10), createGaleri);
router.put("/:id", upload.array("images", 10), updateGaleri);
router.delete("/:id", deleteGaleri);

export default router;
