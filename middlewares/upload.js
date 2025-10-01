import multer from "multer";
import path from "path";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";

// Pastikan folder uploads ada
const uploadDir = "public/uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log("Setting destination to:", uploadDir); // Debug log
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    console.log("Generated filename:", filename); // Debug log
    cb(null, filename);
  },
});

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    console.log("File received:", file); // Debug log

    // ✅ Perbaikan regex: hapus || ganda
    const allowedTypes = /jpeg|jpg|png|gif|webp|pdf/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(
        new Error(
          "Hanya file gambar (jpeg, jpg, png, gif, webp) atau PDF yang diperbolehkan"
        )
      );
    }
  },
});

// Fungsi upload ke Cloudinary (gambar & PDF)
export const uploadToCloudinary = async (filePath, mimetype) => {
  const isPDF = mimetype === "application/pdf";
  const result = await cloudinary.uploader.upload(filePath, {
    resource_type: isPDF ? "raw" : "image",
    type: "upload", // pastikan ini public
    access_mode: "public", // langsung public
  });

  // Hapus file lokal setelah diupload
  fs.unlinkSync(filePath);

  return result.secure_url;
};
