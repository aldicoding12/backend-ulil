// controllers/galeri.controller.js
import fs from "fs";
import asyncHandler from "../middlewares/asyncHandler.js";
import cloudinary from "../utils/uploadFileHandler.js";
import Galeri from "../models/galeriModal.js";

// @desc    Get all galeri items
// @route   GET /api/galeri
// @access  Public
export const getAllGaleri = asyncHandler(async (req, res) => {
  const { category } = req.query;

  const filter = category && category !== "Semua" ? { category } : {};

  const galeriItems = await Galeri.find(filter).sort({ date: -1 });

  res.status(200).json({
    success: true,
    count: galeriItems.length,
    data: galeriItems,
  });
});

// @desc    Get single galeri item
// @route   GET /api/galeri/:id
// @access  Public
export const getGaleriById = asyncHandler(async (req, res) => {
  const galeri = await Galeri.findById(req.params.id);

  if (!galeri) {
    return res.status(404).json({
      success: false,
      message: "Galeri tidak ditemukan",
    });
  }

  res.status(200).json({
    success: true,
    data: galeri,
  });
});

// @desc    Create new galeri item
// @route   POST /api/galeri
// @access  Private/Admin
export const createGaleri = asyncHandler(async (req, res) => {
  const { title, category, description, date } = req.body;

  // Validasi input wajib
  if (!title || !category || !date || !description) {
    return res.status(400).json({
      success: false,
      message: "Title, category, dan date wajib diisi",
    });
  }

  // Validasi kategori
  const validCategories = ["Kegiatan", "Pembelajaran", "Prestasi", "Fasilitas"];
  if (!validCategories.includes(category)) {
    return res.status(400).json({
      success: false,
      message: "Kategori tidak valid",
    });
  }

  // Validasi minimal 1 gambar
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Minimal 1 gambar wajib diupload",
    });
  }

  const uploadedImages = [];

  try {
    // Upload semua gambar ke Cloudinary
    for (const file of req.files) {
      // Upload versi full
      const fullResult = await cloudinary.uploader.upload(file.path, {
        folder: "galeri",
        transformation: [
          { width: 800, height: 800, crop: "limit", quality: 80 },
        ],
      });

      // Upload versi thumbnail
      const thumbResult = await cloudinary.uploader.upload(file.path, {
        folder: "galeri/thumbs",
        transformation: [
          { width: 400, height: 400, crop: "limit", quality: 60 },
        ],
      });

      uploadedImages.push({
        full: fullResult.secure_url,
        thumb: thumbResult.secure_url,
        publicId: fullResult.public_id,
      });

      // Hapus file temporary
      fs.unlinkSync(file.path);
    }

    // Simpan ke database
    const newGaleri = await Galeri.create({
      title,
      category,
      description,
      date,
      images: uploadedImages,
    });

    res.status(201).json({
      success: true,
      message: "Galeri berhasil dibuat",
      data: newGaleri,
    });
  } catch (error) {
    // Cleanup files jika ada error
    if (req.files) {
      req.files.forEach((file) => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }

    // Cleanup uploaded images from Cloudinary jika ada
    if (uploadedImages.length > 0) {
      for (const image of uploadedImages) {
        try {
          await cloudinary.uploader.destroy(image.publicId);
          // Hapus juga thumbnail
          const thumbPublicId = image.publicId.replace(
            "galeri/",
            "galeri/thumbs/"
          );
          await cloudinary.uploader.destroy(thumbPublicId);
        } catch (cleanupError) {
          console.error("Error cleaning up image:", cleanupError);
        }
      }
    }

    throw error;
  }
});

// @desc    Update galeri item
// @route   PUT /api/galeri/:id
// @access  Private/Admin
export const updateGaleri = asyncHandler(async (req, res) => {
  const { title, category, description, date } = req.body;

  const galeri = await Galeri.findById(req.params.id);

  if (!galeri) {
    return res.status(404).json({
      success: false,
      message: "Galeri tidak ditemukan",
    });
  }

  // Validasi kategori jika diubah
  if (category) {
    const validCategories = [
      "Kegiatan",
      "Pembelajaran",
      "Prestasi",
      "Fasilitas",
    ];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: "Kategori tidak valid",
      });
    }
  }

  const uploadedImages = [];
  const oldImages = [...galeri.images]; // Simpan referensi gambar lama

  try {
    // Jika ada gambar baru diupload
    if (req.files && req.files.length > 0) {
      // Upload gambar baru terlebih dahulu
      for (const file of req.files) {
        // Upload versi full
        const fullResult = await cloudinary.uploader.upload(file.path, {
          folder: "galeri",
          transformation: [
            { width: 800, height: 800, crop: "limit", quality: 80 },
          ],
        });

        // Upload versi thumbnail
        const thumbResult = await cloudinary.uploader.upload(file.path, {
          folder: "galeri/thumbs",
          transformation: [
            { width: 400, height: 400, crop: "limit", quality: 60 },
          ],
        });

        uploadedImages.push({
          full: fullResult.secure_url,
          thumb: thumbResult.secure_url,
          publicId: fullResult.public_id,
        });

        // Hapus file temporary
        fs.unlinkSync(file.path);
      }

      // Setelah upload berhasil, hapus gambar lama dari Cloudinary
      for (const image of oldImages) {
        try {
          await cloudinary.uploader.destroy(image.publicId);
          // Hapus juga thumbnail
          const thumbPublicId = image.publicId.replace(
            "galeri/",
            "galeri/thumbs/"
          );
          await cloudinary.uploader.destroy(thumbPublicId);
        } catch (cleanupError) {
          console.error("Error deleting old image:", cleanupError);
        }
      }
    }

    // Update data
    galeri.title = title || galeri.title;
    galeri.category = category || galeri.category;
    galeri.description = description || galeri.category;
    galeri.date = date || galeri.date;
    if (uploadedImages.length > 0) {
      galeri.images = uploadedImages;
    }

    const updatedGaleri = await galeri.save();

    res.status(200).json({
      success: true,
      message: "Galeri berhasil diupdate",
      data: updatedGaleri,
    });
  } catch (error) {
    // Cleanup temporary files jika ada error
    if (req.files) {
      req.files.forEach((file) => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }

    // Cleanup uploaded images from Cloudinary jika ada error
    if (uploadedImages.length > 0) {
      for (const image of uploadedImages) {
        try {
          await cloudinary.uploader.destroy(image.publicId);
          const thumbPublicId = image.publicId.replace(
            "galeri/",
            "galeri/thumbs/"
          );
          await cloudinary.uploader.destroy(thumbPublicId);
        } catch (cleanupError) {
          console.error("Error cleaning up uploaded image:", cleanupError);
        }
      }
    }

    throw error;
  }
});

// @desc    Delete galeri item
// @route   DELETE /api/galeri/:id
// @access  Private/Admin
export const deleteGaleri = asyncHandler(async (req, res) => {
  const galeri = await Galeri.findById(req.params.id);

  if (!galeri) {
    return res.status(404).json({
      success: false,
      message: "Galeri tidak ditemukan",
    });
  }

  try {
    // Hapus semua gambar dari Cloudinary
    for (const image of galeri.images) {
      await cloudinary.uploader.destroy(image.publicId);
      // Hapus juga thumbnail
      const thumbPublicId = image.publicId.replace("galeri/", "galeri/thumbs/");
      await cloudinary.uploader.destroy(thumbPublicId);
    }

    await galeri.deleteOne();

    res.status(200).json({
      success: true,
      message: "Galeri berhasil dihapus",
    });
  } catch (error) {
    throw error;
  }
});

// @desc    Get galeri categories
// @route   GET /api/galeri/categories
// @access  Public
export const getCategories = asyncHandler(async (req, res) => {
  const categories = [
    "Semua",
    "Kegiatan",
    "Pembelajaran",
    "Prestasi",
    "Fasilitas",
  ];

  res.status(200).json({
    success: true,
    data: categories,
  });
});
