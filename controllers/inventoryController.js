import fs from "fs";
import asyncHandler from "../middlewares/asyncHandler.js";
import cloudinary from "../utils/uploadFileHandler.js";
import Inventory from "../models/Inventory.js";
import mongoose from "mongoose";

// CREATE inventory item + image
export const createItem = asyncHandler(async (req, res) => {
  console.log("=== CREATE INVENTORY DEBUG ===");
  console.log("Body:", req.body);
  console.log("File:", req.file);

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
    // Upload ke Cloudinary
    console.log("Uploading to Cloudinary:", req.file.path);
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "inventaris",
    });

    imageUrl = result.secure_url;
    imagePublicId = result.public_id;
    console.log("Upload success:", { imageUrl, imagePublicId });

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

    console.log("Item created:", newItem);
    res.status(201).json({
      message: "Barang berhasil ditambahkan",
      data: newItem,
    });
  } catch (error) {
    // Cleanup file jika ada error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error("Create item error:", error);
    throw error;
  }
});

// UPDATE inventory item by ID
export const updateItem = asyncHandler(async (req, res) => {
  console.log("=== UPDATE INVENTORY DEBUG ===");
  console.log("Params:", req.params);
  console.log("Body:", req.body);
  console.log("File:", req.file);

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

  console.log("Existing item:", {
    id: existingItem._id,
    itemName: existingItem.itemName,
    hasImage: !!existingItem.imageUrl,
    imagePublicId: existingItem.imagePublicId,
  });

  try {
    // Jika ada file gambar baru
    if (req.file) {
      console.log("Processing new image file:", req.file.path);

      // Hapus gambar lama dari Cloudinary jika ada
      if (existingItem.imagePublicId) {
        console.log(
          "Deleting old image from Cloudinary:",
          existingItem.imagePublicId
        );
        try {
          await cloudinary.uploader.destroy(existingItem.imagePublicId);
          console.log("Old image deleted successfully");
        } catch (deleteError) {
          console.error("Error deleting old image:", deleteError);
        }
      }

      // Upload gambar baru
      console.log("Uploading new image to Cloudinary");
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "inventaris",
      });

      updateData.imageUrl = result.secure_url;
      updateData.imagePublicId = result.public_id;
      console.log("New image uploaded:", {
        imageUrl: updateData.imageUrl,
        imagePublicId: updateData.imagePublicId,
      });

      // Hapus file temporary
      fs.unlinkSync(req.file.path);
    } else {
      console.log("No new image file, keeping existing image");
    }

    // Update data di database
    const updated = await Inventory.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).lean();

    console.log("Item updated successfully:", {
      id: updated._id,
      itemName: updated.itemName,
      hasImage: !!updated.imageUrl,
    });

    res.status(200).json({
      message: "Barang berhasil diperbarui",
      data: updated,
    });
  } catch (error) {
    // Cleanup file jika ada error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error("Update item error:", error);
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
      console.log("Image deleted from Cloudinary:", item.imagePublicId);
    } catch (error) {
      console.error("Error deleting image from Cloudinary:", error);
    }
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
export const submitBorrowingRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    borrowerName,
    phoneNumber,
    institution,
    borrowDate,
    returnDate,
    documentUrl,
    notes,
  } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid ID format" });
  }

  if (
    !borrowerName ||
    !phoneNumber ||
    !borrowDate ||
    !returnDate ||
    !documentUrl
  ) {
    return res.status(400).json({
      message:
        "Nama peminjam, nomor HP, tanggal pinjam, tanggal kembali, dan dokumen wajib diisi",
    });
  }

  const item = await Inventory.findById(id);
  if (!item) {
    return res.status(404).json({ message: "Barang tidak ditemukan" });
  }

  if (!item.isLendable) {
    return res.status(400).json({ message: "Barang tidak dapat dipinjam" });
  }

  // Check if item is available using virtual
  if (item.currentlyAvailable <= 0) {
    return res.status(400).json({ message: "Barang sedang tidak tersedia" });
  }

  const borrowingData = {
    borrowerName,
    phoneNumber,
    institution,
    borrowDate: new Date(borrowDate),
    returnDate: new Date(returnDate),
    documentUrl,
    notes,
    status: "pending",
  };

  item.borrowings.push(borrowingData);
  await item.save();

  // Get the newly added borrowing with its generated ID
  const newBorrowing = item.borrowings[item.borrowings.length - 1];

  res.status(201).json({
    message: "Permintaan peminjaman berhasil diajukan",
    data: newBorrowing,
  });
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
