import express from "express";
import {
  createNews,
  getNews,
  getNewsById,
  updateNews,
  deleteNews,
} from "../controllers/newsController.js";
import { upload } from "../middlewares/upload.js";
import { jamaah, pengurus } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Create
router.post("/", upload.single("image"), createNews);

// List with pagination & search
router.get("/", getNews);

// Get one by ID
router.get("/:id", getNewsById);

// Update by ID - PENTING: Tambahkan upload middleware
router.put("/:id", upload.single("image"), updateNews);

// Delete by ID
router.delete("/:id", deleteNews);

export default router;
