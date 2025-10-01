import express from "express";
import {
  getRecentActivities,
  logActivity,
} from "../controllers/activityController.js";

const router = express.Router();
router.get("/recent", getRecentActivities);
router.post("/", logActivity);

export default router;
