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
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "berita",
    });

    imageUrl = result.secure_url;
    imagePublicId = result.public_id;

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
  } catch (error) {
    // Cleanup file jika ada error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    throw error;
  }
});

// UPDATE news by ID
export const updateNews = asyncHandler(async (req, res) => {
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

  try {
    // Jika ada file gambar baru
    if (req.file) {
      // Hapus gambar lama dari Cloudinary jika ada
      if (existingNews.imagePublicId) {
        try {
          await cloudinary.uploader.destroy(existingNews.imagePublicId);
        } catch (deleteError) {}
      }

      // Upload gambar baru
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "masjid",
      });

      updateData.image = result.secure_url;
      updateData.imagePublicId = result.public_id;

      // Hapus file temporary
      fs.unlinkSync(req.file.path);
    } else {
    }

    // Update data di database
    const updated = await News.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).lean();

    res.status(200).json({
      message: "Berita berhasil diperbarui",
      data: updated,
    });
  } catch (error) {
    // Cleanup file jika ada error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
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
    } catch (error) {
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

/////////////////
export const getNewsStats = asyncHandler(async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    // Total news
    const totalNews = await News.countDocuments();

    // Published news
    const publishedNews = await News.countDocuments({
      status: "published",
    });

    // Draft news
    const draftNews = await News.countDocuments({
      status: "draft",
    });

    // Total views (asumsi ada field views di News model)
    const viewsAgg = await News.aggregate([
      { $group: { _id: null, total: { $sum: "$views" } } },
    ]);
    const totalViews = viewsAgg[0]?.total || 0;

    // Views today (asumsi ada array viewHistory dengan tanggal)
    const todayViewsAgg = await News.aggregate([
      { $unwind: "$viewHistory" },
      {
        $match: {
          "viewHistory.date": { $gte: startOfDay },
        },
      },
      { $group: { _id: null, total: { $sum: 1 } } },
    ]);
    const todayViews = todayViewsAgg[0]?.total || 0;

    // Calculate views growth (compare dengan bulan lalu)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const lastMonthViewsAgg = await News.aggregate([
      { $unwind: "$viewHistory" },
      {
        $match: {
          "viewHistory.date": { $gte: lastMonthStart, $lte: lastMonthEnd },
        },
      },
      { $group: { _id: null, total: { $sum: 1 } } },
    ]);
    const lastMonthViews = lastMonthViewsAgg[0]?.total || 0;

    const thisMonthViewsAgg = await News.aggregate([
      { $unwind: "$viewHistory" },
      {
        $match: {
          "viewHistory.date": { $gte: startOfMonth },
        },
      },
      { $group: { _id: null, total: { $sum: 1 } } },
    ]);
    const thisMonthViews = thisMonthViewsAgg[0]?.total || 0;

    const viewsGrowth =
      lastMonthViews > 0
        ? (((thisMonthViews - lastMonthViews) / lastMonthViews) * 100).toFixed(
            1
          )
        : 100;

    res.status(200).json({
      success: true,
      data: {
        totalNews,
        publishedNews,
        draftNews,
        totalViews,
        todayViews,
        viewsGrowth: parseFloat(viewsGrowth),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching news statistics",
      error: error.message,
    });
  }
});
