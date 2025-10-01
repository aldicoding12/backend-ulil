import fs from "fs";
import asyncHandler from "./../middlewares/asyncHandler.js";
import cloudinary from "../utils/uploadFileHandler.js";
import Inventory from "../models/Inventory.js";
import mongoose from "mongoose";

// CREATE inventory item + image
export const createItem = asyncHandler(async (req, res) => {
  const { itemName, quantity, condition, isLendable, description } = req.body;
  let imageUrl = null;
  let imagePublicId = null;

  // Validasi input wajib
  if (!itemName || !quantity) {
    return res.status(400).json({
      message: "Nama barang dan jumlah wajib diisi",
    });
  }

  // Untuk create, gambar wajib ada
  if (!req.file) {
    return res.status(400).json({
      message: "Gambar wajib diupload untuk barang baru",
    });
  }

  try {
    imageUrl = result.secure_url;
    imagePublicId = result.public_id;

    // Hapus file temporary
    fs.unlinkSync(req.file.path);

    // Simpan ke database
    const newItem = await Inventory.create({
      itemName,
      quantity: parseInt(quantity),
      condition: condition || "good",
      imageUrl: imageUrl,
      imagePublicId,
      isLendable: isLendable === "true",
      description,
      availableQuantity: parseInt(quantity), // Set initial available quantity
      borrowings: [], // Initialize empty borrowings array
    });
    res.status(201).json({
      message: "Barang berhasil ditambahkan",
      data: newItem,
    });
  } catch (error) {
    // Cleanup file jika ada error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    throw error;
  }
});

// UPDATE inventory item by ID
export const updateItem = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid ID format" });
  }

  const { itemName, quantity, condition, isLendable, description } = req.body;

  const updateData = {
    itemName,
    quantity: quantity ? parseInt(quantity) : undefined,
    condition,
    isLendable: isLendable ? isLendable === "true" : undefined,
    description,
  };

  // Remove undefined values
  Object.keys(updateData).forEach((key) => {
    if (updateData[key] === undefined) {
      delete updateData[key];
    }
  });

  // Cari item yang akan diupdate
  const existingItem = await Inventory.findById(id);
  if (!existingItem) {
    return res.status(404).json({ message: "Barang tidak ditemukan" });
  }

  // Check if item has pending borrowings
  const hasPendingBorrowings = existingItem.borrowings.some(
    (borrowing) =>
      borrowing.status === "pending" || borrowing.status === "approved"
  );

  // Jika ada peminjaman aktif, tidak boleh ubah isLendable menjadi false
  if (hasPendingBorrowings && updateData.isLendable === false) {
    return res.status(400).json({
      message:
        "Tidak dapat mengubah status peminjaman karena ada peminjaman yang sedang berlangsung",
    });
  }

  try {
    // Jika ada file gambar baru
    if (req.file) {
      // Hapus gambar lama dari Cloudinary jika ada
      if (existingItem.imagePublicId) {
        try {
          await cloudinary.uploader.destroy(existingItem.imagePublicId);
        } catch (deleteError) {}
      }

      // Upload gambar baru
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "inventaris",
      });

      updateData.imageUrl = result.secure_url;
      updateData.imagePublicId = result.public_id;
      // Hapus file temporary
      fs.unlinkSync(req.file.path);
    } else {
    }

    // Update data di database
    const updated = await Inventory.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).lean();

    res.status(200).json({
      message: "Barang berhasil diperbarui",
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

// DELETE inventory item + image
export const deleteItem = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid ID format" });
  }

  const item = await Inventory.findById(id);
  if (!item) return res.status(404).json({ message: "Barang tidak ditemukan" });

  // Check if item has pending or approved borrowings
  const hasActiveBorrowings = item.borrowings.some(
    (borrowing) =>
      borrowing.status === "pending" || borrowing.status === "approved"
  );

  if (hasActiveBorrowings) {
    return res.status(400).json({
      message:
        "Tidak dapat menghapus barang yang sedang dipinjam atau ada permintaan peminjaman",
    });
  }

  // Hapus gambar dari Cloudinary
  if (item.imagePublicId) {
    try {
      await cloudinary.uploader.destroy(item.imagePublicId);
    } catch (error) {}
  }

  // Hapus dokumen dari MongoDB
  await item.deleteOne();

  res.status(200).json({ message: "Barang berhasil dihapus" });
});

// LIST + pagination + search + filter
export const getItems = asyncHandler(async (req, res) => {
  const queryObj = { ...req.query };
  ["page", "limit", "itemName", "condition", "isLendable"].forEach(
    (f) => delete queryObj[f]
  );

  let query = {};

  // Search by item name
  if (req.query.itemName) {
    query.itemName = { $regex: req.query.itemName, $options: "i" };
  }

  // Filter by condition
  if (req.query.condition) {
    query.condition = req.query.condition;
  }

  // Filter by lendable status
  if (req.query.isLendable !== undefined) {
    query.isLendable = req.query.isLendable === "true";
  }

  const page = Math.max(1, parseInt(req.query.page)) || 1;
  const limit = Math.max(1, parseInt(req.query.limit)) || 10;
  const skip = (page - 1) * limit;

  const total = await Inventory.countDocuments(query);

  if (req.query.page && skip >= total) {
    return res.status(404).json({ message: "Halaman tidak tersedia" });
  }

  const data = await Inventory.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  res.status(200).json({
    message: "Berhasil menampilkan inventaris",
    currentPage: page,
    totalPages: Math.ceil(total / limit),
    totalItems: total,
    data,
  });
});

// GET available items for borrowing (user view)
export const getAvailableItems = asyncHandler(async (req, res) => {
  const queryObj = { ...req.query };
  ["page", "limit", "itemName"].forEach((f) => delete queryObj[f]);

  let query = {
    isLendable: true,
    condition: { $in: ["good", "needs_repair"] },
  };

  // Search by item name
  if (req.query.itemName) {
    query.itemName = { $regex: req.query.itemName, $options: "i" };
  }

  const page = Math.max(1, parseInt(req.query.page)) || 1;
  const limit = Math.max(1, parseInt(req.query.limit)) || 10;
  const skip = (page - 1) * limit;

  const total = await Inventory.countDocuments(query);

  if (req.query.page && skip >= total) {
    return res.status(404).json({ message: "Halaman tidak tersedia" });
  }

  const data = await Inventory.find(query)
    .select("itemName imageUrl condition description quantity")
    .sort({ itemName: 1 })
    .skip(skip)
    .limit(limit)
    .lean();

  // Add calculated available quantity for each item
  const dataWithAvailability = await Promise.all(
    data.map(async (item) => {
      const fullItem = await Inventory.findById(item._id);
      return {
        ...item,
        currentlyAvailable: fullItem.currentlyAvailable || 0,
      };
    })
  );

  res.status(200).json({
    message: "Berhasil menampilkan barang yang tersedia",
    currentPage: page,
    totalPages: Math.ceil(total / limit),
    totalItems: total,
    data: dataWithAvailability,
  });
});

// GET single inventory item by ID
export const getItemById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid ID format" });
  }

  const item = await Inventory.findById(id).lean();
  if (!item) return res.status(404).json({ message: "Barang tidak ditemukan" });

  res.status(200).json({ message: "Berhasil menampilkan barang", data: item });
});

// SUBMIT borrowing request
// FIXED VERSION - submitBorrowingRequest function
export const submitBorrowingRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    borrowerName,
    phoneNumber,
    institution,
    borrowDate,
    returnDate,
    notes,
  } = req.body;

  let documentUrl = null;
  let documentPublicId = null;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid ID format" });
  }

  // Validasi input wajib
  if (!borrowerName || !phoneNumber || !borrowDate || !returnDate) {
    return res.status(400).json({
      message:
        "Nama peminjam, nomor HP, tanggal pinjam, dan tanggal kembali wajib diisi",
    });
  }

  // Untuk borrowing request, dokumen wajib ada
  if (!req.file) {
    return res.status(400).json({
      message: "Dokumen wajib diupload untuk permintaan peminjaman",
    });
  }

  // ✅ VALIDASI: Pastikan file adalah PDF
  if (req.file.mimetype !== "application/pdf") {
    return res.status(400).json({
      message: "Dokumen harus berupa file PDF",
    });
  }

  const item = await Inventory.findById(id);
  if (!item) {
    // ✅ CLEANUP: Hapus file jika item tidak ditemukan
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(404).json({ message: "Barang tidak ditemukan" });
  }

  if (!item.isLendable) {
    // ✅ CLEANUP: Hapus file jika tidak bisa dipinjam
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(400).json({ message: "Barang tidak dapat dipinjam" });
  }

  // Check if item is available using virtual
  if (item.currentlyAvailable <= 0) {
    // ✅ CLEANUP: Hapus file jika tidak tersedia
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(400).json({ message: "Barang sedang tidak tersedia" });
  }

  try {
    const result = await cloudinary.uploader.upload(req.file.path, {
      resource_type: "raw", // ✅ PERBAIKAN: Gunakan "raw" untuk PDF, bukan "auto"
      type: "upload", // ✅ PERBAIKAN: Eksplisit set type
      access_mode: "public", // ✅ PERBAIKAN: Pastikan public access
      folder: "borrowing-documents", // Folder khusus untuk dokumen peminjaman
      use_filename: true, // Gunakan nama file asli
      unique_filename: true, // Tambah suffix unik
      // ✅ HAPUS upload_preset jika ada
    });

    documentUrl = result.secure_url;
    documentPublicId = result.public_id;

    // Hapus file temporary
    fs.unlinkSync(req.file.path);

    // Buat data peminjaman
    const borrowingData = {
      borrowerName,
      phoneNumber,
      institution,
      borrowDate: new Date(borrowDate),
      returnDate: new Date(returnDate),
      documentUrl, // Menggunakan documentUrl yang sudah diupload
      documentPublicId, // Simpan public_id untuk keperluan delete nanti
      notes,
      status: "pending",
    };

    // Tambahkan ke array borrowings
    item.borrowings.push(borrowingData);
    await item.save();

    // Get the newly added borrowing with its generated ID
    const newBorrowing = item.borrowings[item.borrowings.length - 1];

    // ✅ TAMBAHAN: Return dengan informasi lengkap untuk debugging
    res.status(201).json({
      message: "Permintaan peminjaman berhasil diajukan",
      data: {
        ...newBorrowing.toObject(),
        // Tambahan info untuk testing
        testUrl: documentUrl, // Frontend bisa test URL ini
        uploadInfo: {
          resource_type: result.resource_type,
          access_mode: result.access_mode,
          type: result.type,
        },
      },
    });
  } catch (error) {
    // ✅ PERBAIKAN: Cleanup yang lebih baik
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    // ✅ TAMBAHAN: Error response yang lebih informatif
    res.status(500).json({
      message: "Gagal mengupload dokumen",
      error: error.message,
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

// APPROVE borrowing request
export const approveBorrowing = asyncHandler(async (req, res) => {
  const { itemId, borrowingId } = req.params;
  const { approvedBy, notes } = req.body;

  if (
    !mongoose.Types.ObjectId.isValid(itemId) ||
    !mongoose.Types.ObjectId.isValid(borrowingId)
  ) {
    return res.status(400).json({ message: "Invalid ID format" });
  }

  const item = await Inventory.findById(itemId);
  if (!item) {
    return res.status(404).json({ message: "Barang tidak ditemukan" });
  }

  const borrowing = item.borrowings.id(borrowingId);
  if (!borrowing) {
    return res
      .status(404)
      .json({ message: "Permintaan peminjaman tidak ditemukan" });
  }

  if (borrowing.status !== "pending") {
    return res
      .status(400)
      .json({ message: "Permintaan peminjaman sudah diproses" });
  }

  // Check availability before approving
  if (item.currentlyAvailable <= 0) {
    return res.status(400).json({
      message: "Barang sudah tidak tersedia untuk dipinjam",
    });
  }

  borrowing.status = "approved";
  borrowing.approvedBy = approvedBy || "Admin";
  if (notes) borrowing.notes = notes;

  await item.save();

  res.status(200).json({
    message: "Permintaan peminjaman disetujui",
    data: borrowing,
  });
});

// REJECT borrowing request
export const rejectBorrowing = asyncHandler(async (req, res) => {
  const { itemId, borrowingId } = req.params;
  const { rejectionReason } = req.body;

  if (
    !mongoose.Types.ObjectId.isValid(itemId) ||
    !mongoose.Types.ObjectId.isValid(borrowingId)
  ) {
    return res.status(400).json({ message: "Invalid ID format" });
  }

  const item = await Inventory.findById(itemId);
  if (!item) {
    return res.status(404).json({ message: "Barang tidak ditemukan" });
  }

  const borrowing = item.borrowings.id(borrowingId);
  if (!borrowing) {
    return res
      .status(404)
      .json({ message: "Permintaan peminjaman tidak ditemukan" });
  }

  if (borrowing.status !== "pending") {
    return res
      .status(400)
      .json({ message: "Permintaan peminjaman sudah diproses" });
  }

  borrowing.status = "rejected";
  borrowing.rejectionReason = rejectionReason || "Ditolak oleh admin";

  await item.save();

  res.status(200).json({
    message: "Permintaan peminjaman ditolak",
    data: borrowing,
  });
});

// MARK as returned
export const markAsReturned = asyncHandler(async (req, res) => {
  const { itemId, borrowingId } = req.params;
  const { actualReturnDate, notes } = req.body;

  if (
    !mongoose.Types.ObjectId.isValid(itemId) ||
    !mongoose.Types.ObjectId.isValid(borrowingId)
  ) {
    return res.status(400).json({ message: "Invalid ID format" });
  }

  const item = await Inventory.findById(itemId);
  if (!item) {
    return res.status(404).json({ message: "Barang tidak ditemukan" });
  }

  const borrowing = item.borrowings.id(borrowingId);
  if (!borrowing) {
    return res
      .status(404)
      .json({ message: "Catatan peminjaman tidak ditemukan" });
  }

  if (borrowing.status !== "approved") {
    return res.status(400).json({ message: "Barang tidak sedang dipinjam" });
  }

  borrowing.status = "returned";
  borrowing.actualReturnDate = actualReturnDate
    ? new Date(actualReturnDate)
    : new Date();
  if (notes) borrowing.notes = notes;

  await item.save();

  res.status(200).json({
    message: "Barang berhasil dikembalikan",
    data: borrowing,
  });
});

// GET borrowing requests
export const getBorrowingRequests = asyncHandler(async (req, res) => {
  const { status = "pending", page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  const items = await Inventory.find({
    "borrowings.status": status,
  });

  const borrowingRequests = [];
  items.forEach((item) => {
    item.borrowings.forEach((borrowing) => {
      if (borrowing.status === status) {
        borrowingRequests.push({
          ...borrowing.toObject(),
          itemId: item._id,
          itemName: item.itemName,
          itemImage: item.imageUrl,
        });
      }
    });
  });

  const total = borrowingRequests.length;
  const paginatedRequests = borrowingRequests
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(skip, skip + parseInt(limit));

  res.status(200).json({
    message: "Berhasil menampilkan permintaan peminjaman",
    currentPage: parseInt(page),
    totalPages: Math.ceil(total / limit),
    totalItems: total,
    data: paginatedRequests,
  });
});

// GET user borrowing history
export const getUserBorrowingHistory = asyncHandler(async (req, res) => {
  const { phoneNumber } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  const items = await Inventory.find({
    "borrowings.phoneNumber": phoneNumber,
  });

  const userBorrowings = [];
  items.forEach((item) => {
    item.borrowings.forEach((borrowing) => {
      if (borrowing.phoneNumber === phoneNumber) {
        userBorrowings.push({
          ...borrowing.toObject(),
          itemId: item._id,
          itemName: item.itemName,
          itemImage: item.imageUrl,
        });
      }
    });
  });

  const total = userBorrowings.length;
  const paginatedBorrowings = userBorrowings
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(skip, skip + parseInt(limit));

  res.status(200).json({
    message: "Berhasil menampilkan riwayat peminjaman",
    currentPage: parseInt(page),
    totalPages: Math.ceil(total / limit),
    totalItems: total,
    data: paginatedBorrowings,
  });
});

// GET dashboard stats (admin)
export const getDashboardStats = asyncHandler(async (req, res) => {
  const [
    totalItems,
    lendableItems,
    damagedItems,
    pendingRequests,
    approvedBorrowings,
  ] = await Promise.all([
    Inventory.countDocuments(),
    Inventory.countDocuments({ isLendable: true }),
    Inventory.countDocuments({
      condition: { $in: ["damaged", "needs_repair", "out_of_order"] },
    }),
    Inventory.countDocuments({ "borrowings.status": "pending" }),
    Inventory.countDocuments({ "borrowings.status": "approved" }),
  ]);

  res.status(200).json({
    message: "Berhasil menampilkan statistik",
    data: {
      totalItems,
      lendableItems,
      damagedItems,
      pendingRequests,
      approvedBorrowings,
    },
  });
});
