import express from "express";
import {
  userRegistration,
  userLogin,
  userLogout,
  getAllUsers,
  updateUser,
  getUserById,
  getUserStats,
  updateUserPassword,
  deleteUser,
  verifyToken,
} from "../controllers/userController.js";

const router = express.Router();

// Auth routes
router.post("/register", userRegistration);
router.post("/login", userLogin);
router.post("/logout", userLogout);
router.post("/verify-token", verifyToken);

// Stats route - harus diletakkan SEBELUM route /:id
router.get("/stats", getUserStats);

// User management routes
router.get("/", getAllUsers); // Fixed: geAlltUser -> "/"
router.get("/:id", getUserById);
router.put("/:id", updateUser);
router.put("/:id/password", updateUserPassword);
router.delete("/:id", deleteUser);

export default router;
