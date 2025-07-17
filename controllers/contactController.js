import Contact from "../models/Contact.js";
import asyncHandler from "../middlewares/asyncHandler.js";

export const submitContact = asyncHandler(async (req, res) => {
  const { name, email, subject, message } = req.body;

  // Validasi input dasar
  if (!name || !email || !subject || !message) {
    return res.status(400).json({
      success: false,
      message: "Semua field harus diisi",
      errors: ["Semua field wajib diisi"],
    });
  }

  // Validasi detail
  const errors = [];

  if (typeof name !== "string" || name.trim().length < 2) {
    errors.push("Nama minimal 2 karakter");
  }
  if (
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  ) {
    errors.push("Format email tidak valid");
  }
  if (typeof subject !== "string" || subject.trim().length < 3) {
    errors.push("Subjek minimal 3 karakter");
  }
  if (typeof message !== "string" || message.trim().length < 10) {
    errors.push("Pesan minimal 10 karakter");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Data tidak valid",
      errors,
    });
  }

  // Buat contact baru
  const contact = await Contact.create({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    subject: subject.trim(),
    message: message.trim(),
    ipAddress: req.ip || "unknown",
    userAgent: req.get("User-Agent") || "unknown",
  });

  // Response sukses
  res.status(201).json({
    success: true,
    message: "Pesan berhasil dikirim! Terima kasih atas masukan Anda.",
    data: {
      id: contact._id,
      name: contact.name,
      email: contact.email,
      subject: contact.subject,
      category: contact.categoryLabel,
      priority: contact.priority,
      createdAt: contact.createdAt,
    },
  });
});

export const getContacts = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const status = req.query.status;
  const category = req.query.category;
  const priority = req.query.priority;
  const search = req.query.search;

  // Build filter
  const filter = {};
  if (status && status !== "all") filter.status = status;
  if (category && category !== "all") filter.category = category;
  if (priority && priority !== "all") filter.priority = priority;

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { subject: { $regex: search, $options: "i" } },
      { message: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;

  const [contacts, total, stats] = await Promise.all([
    Contact.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Contact.countDocuments(filter),
    Contact.getStats(),
  ]);

  res.json({
    success: true,
    data: contacts,
    pagination: {
      current: page,
      total: Math.ceil(total / limit),
      count: contacts.length,
      totalRecords: total,
    },
    stats,
  });
});

export const getContact = asyncHandler(async (req, res) => {
  const contact = await Contact.findById(req.params.id);

  if (!contact) {
    return res.status(404).json({
      success: false,
      message: "Pesan tidak ditemukan",
    });
  }

  // Mark as read if unread
  if (contact.status === "unread") {
    await contact.markAsRead();
  }

  res.json({
    success: true,
    data: contact,
  });
});

export const updateContactStatus = asyncHandler(async (req, res) => {
  const { status, adminNotes } = req.body;

  const validStatuses = ["unread", "read", "archived"];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Status tidak valid",
    });
  }

  const contact = await Contact.findById(req.params.id);

  if (!contact) {
    return res.status(404).json({
      success: false,
      message: "Pesan tidak ditemukan",
    });
  }

  if (status) contact.status = status;
  if (adminNotes) contact.adminNotes = adminNotes.trim();

  await contact.save();

  res.json({
    success: true,
    message: "Status berhasil diperbarui",
    data: contact,
  });
});

export const deleteContact = asyncHandler(async (req, res) => {
  const contact = await Contact.findById(req.params.id);

  if (!contact) {
    return res.status(404).json({
      success: false,
      message: "Pesan tidak ditemukan",
    });
  }

  await contact.deleteOne();

  res.json({
    success: true,
    message: "Pesan berhasil dihapus",
  });
});

export const getContactStats = asyncHandler(async (req, res) => {
  const stats = await Contact.getStats();

  res.json({
    success: true,
    data: stats,
  });
});
