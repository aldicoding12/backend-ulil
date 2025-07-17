import fs from "fs";
import asyncHandler from "../middlewares/asyncHandler.js";
import cloudinary from "../utils/uploadFileHandler.js";
import News from "../models/newsModel.js";
import mongoose from "mongoose";

// CREATE news + image
export const createNews = asyncHandler(async (req, res) => {
  const { title, content, author } = req.body;
  let imageUrl = null;
  let imagePublicId = null;

  // Validasi input wajib
  if (!title || !content || !author) {
    return res.status(400).json({
      message: "Title, content, dan author wajib diisi",
    });
  }

  // Untuk create, gambar wajib ada
  if (!req.file) {
    return res.status(400).json({
      message: "Gambar wajib diupload untuk berita baru",
    });
  }

  try {
    // Upload ke Cloudinary
    console.log("Uploading to Cloudinary:", req.file.path);
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "berita",
    });

    imageUrl = result.secure_url;
    imagePublicId = result.public_id;
    console.log("Upload success:", { imageUrl, imagePublicId });

    // Hapus file temporary
    fs.unlinkSync(req.file.path);

    // Simpan ke database
    const newNews = await News.create({
      title,
      content,
      author,
      image: imageUrl,
      imagePublicId,
    });

    console.log("News created:", newNews);
    res.status(201).json({
      message: "Berita berhasil dibuat",
      data: newNews,
    });
  } catch (error) {
    // Cleanup file jika ada error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error("Create news error:", error);
    throw error;
  }
});

// UPDATE news by ID
export const updateNews = asyncHandler(async (req, res) => {
  console.log("=== UPDATE NEWS DEBUG ===");
  console.log("Params:", req.params);
  console.log("Body:", req.body);
  console.log("File:", req.file);

  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid ID format" });
  }

  const { title, content, author } = req.body;

  const updateData = { title, content, author };

  // Cari berita yang akan diupdate
  const existingNews = await News.findById(id);
  if (!existingNews) {
    return res.status(404).json({ message: "Berita tidak ditemukan" });
  }

  console.log("Existing news:", {
    id: existingNews._id,
    title: existingNews.title,
    hasImage: !!existingNews.image,
    imagePublicId: existingNews.imagePublicId,
  });

  try {
    // Jika ada file gambar baru
    if (req.file) {
      console.log("Processing new image file:", req.file.path);

      // Hapus gambar lama dari Cloudinary jika ada
      if (existingNews.imagePublicId) {
        console.log(
          "Deleting old image from Cloudinary:",
          existingNews.imagePublicId
        );
        try {
          await cloudinary.uploader.destroy(existingNews.imagePublicId);
          console.log("Old image deleted successfully");
        } catch (deleteError) {
          console.error("Error deleting old image:", deleteError);
          // Lanjutkan proses meskipun gagal hapus gambar lama
        }
      }

      // Upload gambar baru
      console.log("Uploading new image to Cloudinary");
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "masjid",
      });

      updateData.image = result.secure_url;
      updateData.imagePublicId = result.public_id;
      console.log("New image uploaded:", {
        imageUrl: updateData.image,
        imagePublicId: updateData.imagePublicId,
      });

      // Hapus file temporary
      fs.unlinkSync(req.file.path);
    } else {
      console.log("No new image file, keeping existing image");
    }

    // Update data di database
    const updated = await News.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).lean();

    console.log("News updated successfully:", {
      id: updated._id,
      title: updated.title,
      hasImage: !!updated.image,
      imageUrl: updated.image,
    });

    res.status(200).json({
      message: "Berita berhasil diperbarui",
      data: updated,
    });
  } catch (error) {
    // Cleanup file jika ada error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error("Update news error:", error);
    throw error;
  }
});

// DELETE news + image
export const deleteNews = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid ID format" });
  }

  const news = await News.findById(id);
  if (!news) return res.status(404).json({ message: "Berita tidak ditemukan" });

  // Hapus gambar dari Cloudinary
  if (news.imagePublicId) {
    try {
      await cloudinary.uploader.destroy(news.imagePublicId);
      console.log("Image deleted from Cloudinary:", news.imagePublicId);
    } catch (error) {
      console.error("Error deleting image from Cloudinary:", error);
      // Lanjutkan menghapus data meskipun gagal hapus gambar
    }
  }

  // Hapus dokumen dari MongoDB
  await news.deleteOne();

  res.status(200).json({ message: "Berita berhasil dihapus" });
});

// LIST + pagination + search
export const getNews = asyncHandler(async (req, res) => {
  const queryObj = { ...req.query };
  ["page", "limit", "title"].forEach((f) => delete queryObj[f]);

  let query = req.query.title
    ? News.find({ title: { $regex: req.query.title, $options: "i" } })
    : News.find(queryObj);

  const page = Math.max(1, parseInt(req.query.page)) || 1;
  const limit = Math.max(1, parseInt(req.query.limit)) || 10;
  const skip = (page - 1) * limit;

  query = query.sort({ createdAt: -1 }).skip(skip).limit(limit);
  const total = await News.countDocuments(
    req.query.title
      ? { title: { $regex: req.query.title, $options: "i" } }
      : queryObj
  );

  if (req.query.page && skip >= total) {
    return res.status(404).json({ message: "Halaman tidak tersedia" });
  }

  const data = await query.lean();
  res.status(200).json({
    message: "Berhasil menampilkan berita",
    currentPage: page,
    totalPages: Math.ceil(total / limit),
    totalItems: total,
    data,
  });
});

// GET single news by ID
export const getNewsById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid ID format" });
  }

  const news = await News.findById(id).lean();
  if (!news) return res.status(404).json({ message: "Berita tidak ditemukan" });

  res.status(200).json({ message: "Berhasil menampilkan berita", data: news });
});
