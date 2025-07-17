import jwt from "jsonwebtoken";
import User from "../models/userModels.js";
import asyncHandler from "./asyncHandler.js";

export const jamaah = asyncHandler(async (req, res, next) => {
  let token;

  token = req.cookies.jwt;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-password");
      next();
    } catch (error) {
      res.status(401);
      throw new Error("Token salah");
    }
  } else {
    res.status(401);
    throw new Error("Tidak ada token");
  }
});

export const pengurus = (req, res, next) => {
  if (req.user && req.user.role === "pengurus") {
    next();
  } else {
    res.status(403).json({
      message: "Anda tidak memiliki akses",
    });
  }
};

// <-- Default export
