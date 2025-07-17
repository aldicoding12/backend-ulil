// controllers/eventsController.js - UPDATED TO INCLUDE DONATION EVENTS
import fs from "fs";
import asyncHandler from "../middlewares/asyncHandler.js";
import cloudinary from "../utils/uploadFileHandler.js";
import Events from "../models/eventsModel.js";
import mongoose from "mongoose";

// ========== UPDATED EVENT FUNCTIONS (now include donation events) ==========

// @desc    Create new event (regular event, not donation)
// @route   POST /api/events
// @access  Private
export const createEvent = asyncHandler(async (req, res) => {
  let eventData = req.body;

  // Ensure this is NOT a donation event
  eventData.isDonationEvent = false;

  // Handle image upload jika ada
  if (req.file) {
    try {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "events",
      });

      eventData.image = result.secure_url;
      eventData.imagePublicId = result.public_id;

      // Hapus file temporary
      fs.unlinkSync(req.file.path);
    } catch (error) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      throw error;
    }
  }

  const event = await Events.create(eventData);

  res.status(201).json({
    success: true,
    message: "Event berhasil dibuat",
    data: event,
  });
});

// @desc    Get all events (NOW INCLUDES donation events)
// @route   GET /api/events
// @access  Public
export const getEvents = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    category,
    status,
    search,
    includeDonations = "false", // Default ke false agar donation events tidak ditampilkan
  } = req.query;

  // Build filter object - EXCLUDE donation events by default
  const filter = {};

  // Selalu exclude donation events kecuali explicitly diminta untuk include
  if (includeDonations !== "true") {
    filter.$or = [
      { isDonationEvent: { $exists: false } },
      { isDonationEvent: false },
    ];
  }

  if (category) filter.category = category;
  if (status) filter.status = status;
  if (search) {
    filter.$and = filter.$and || [];
    filter.$and.push({
      $or: [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ],
    });
  }

  const events = await Events.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Events.countDocuments(filter);

  res.status(200).json({
    success: true,
    count: events.length,
    total,
    currentPage: parseInt(page),
    totalPages: Math.ceil(total / limit),
    data: events,
  });
});

// Alternatif yang lebih eksplisit:
export const getEventsAlternative = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    category,
    status,
    search,
    includeDonations = "false",
  } = req.query;

  // Build filter object - ALWAYS exclude donation events unless explicitly included
  const filter = {
    // Selalu exclude donation events kecuali includeDonations = "true"
    ...(includeDonations !== "true" && {
      $or: [
        { isDonationEvent: { $exists: false } },
        { isDonationEvent: false },
      ],
    }),
  };

  if (category) filter.category = category;
  if (status) filter.status = status;
  if (search) {
    filter.$and = filter.$and || [];
    filter.$and.push({
      $or: [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ],
    });
  }

  const events = await Events.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Events.countDocuments(filter);

  res.status(200).json({
    success: true,
    count: events.length,
    total,
    currentPage: parseInt(page),
    totalPages: Math.ceil(total / limit),
    data: events,
  });
});

// @desc    Get single event
// @route   GET /api/events/:id
// @access  Public
export const getEvent = asyncHandler(async (req, res) => {
  const event = await Events.findById(req.params.id);

  if (!event) {
    return res.status(404).json({
      success: false,
      message: "Event tidak ditemukan",
    });
  }

  res.status(200).json({
    success: true,
    data: event,
  });
});

// @desc    Update event
// @route   PUT /api/events/:id
// @access  Private
export const updateEvent = asyncHandler(async (req, res) => {
  let updateData = req.body;

  // Cari event yang akan diupdate
  const existingEvent = await Events.findById(req.params.id);
  if (!existingEvent) {
    return res.status(404).json({
      success: false,
      message: "Event tidak ditemukan",
    });
  }

  // Prevent converting regular event to donation event via this endpoint
  if (existingEvent.isDonationEvent) {
    return res.status(400).json({
      success: false,
      message: "Gunakan endpoint donation events untuk mengedit event donasi",
    });
  }

  // Handle image upload jika ada
  if (req.file) {
    try {
      // Hapus gambar lama dari Cloudinary jika ada
      if (existingEvent.imagePublicId) {
        try {
          await cloudinary.uploader.destroy(existingEvent.imagePublicId);
        } catch (deleteError) {
          console.error("Error deleting old image:", deleteError);
        }
      }

      // Upload gambar baru
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "events",
      });

      updateData.image = result.secure_url;
      updateData.imagePublicId = result.public_id;

      // Hapus file temporary
      fs.unlinkSync(req.file.path);
    } catch (error) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      throw error;
    }
  }

  const event = await Events.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    message: "Event berhasil diperbarui",
    data: event,
  });
});

// @desc    Update event status
// @route   PUT /api/events/:id/status
// @access  Private
export const updateEventStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  // Validasi status yang diizinkan
  const allowedStatuses = ["draft", "published", "cancelled", "completed"];
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message:
        "Status tidak valid. Status yang diizinkan: draft, published, cancelled, completed",
    });
  }

  const event = await Events.findByIdAndUpdate(
    req.params.id,
    { status },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!event) {
    return res.status(404).json({
      success: false,
      message: "Event tidak ditemukan",
    });
  }

  res.status(200).json({
    success: true,
    message: `Status event berhasil diubah menjadi ${status}`,
    data: event,
  });
});

// @desc    Delete event
// @route   DELETE /api/events/:id
// @access  Private
export const deleteEvent = asyncHandler(async (req, res) => {
  const event = await Events.findById(req.params.id);

  if (!event) {
    return res.status(404).json({
      success: false,
      message: "Event tidak ditemukan",
    });
  }

  // Jika ini donation event, tidak bisa dihapus melalui endpoint ini
  if (event.isDonationEvent) {
    return res.status(400).json({
      success: false,
      message: "Gunakan endpoint donation events untuk menghapus event donasi",
    });
  }

  // Hapus gambar dari Cloudinary jika ada
  if (event.imagePublicId) {
    try {
      await cloudinary.uploader.destroy(event.imagePublicId);
    } catch (error) {
      console.error("Error deleting image from Cloudinary:", error);
    }
  }

  await Events.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: "Event berhasil dihapus",
  });
});

// @desc    Add participant to event
// @route   POST /api/events/:id/participants
// @access  Public
export const addParticipant = asyncHandler(async (req, res) => {
  const event = await Events.findById(req.params.id);

  if (!event) {
    return res.status(404).json({
      success: false,
      message: "Event tidak ditemukan",
    });
  }

  // Check if this is a donation event
  if (event.isDonationEvent) {
    return res.status(400).json({
      success: false,
      message: "Event donasi tidak memiliki sistem pendaftaran peserta",
    });
  }

  // Check if event is published
  if (event.status !== "published") {
    return res.status(400).json({
      success: false,
      message: "Event belum dipublikasi atau tidak tersedia untuk pendaftaran",
    });
  }

  // Check if event is full
  if (event.participants.length >= event.maxParticipants) {
    return res.status(400).json({
      success: false,
      message: "Event sudah penuh",
    });
  }

  // Check if participant already registered
  const existingParticipant = event.participants.find(
    (p) => p.phone === req.body.phone
  );

  if (existingParticipant) {
    return res.status(400).json({
      success: false,
      message: "Nomor telepon sudah terdaftar",
    });
  }

  // Add participant
  const participantData = {
    name: req.body.name,
    phone: req.body.phone,
    registeredAt: new Date(),
  };

  event.participants.push(participantData);
  event.registeredCount = event.participants.length;

  await event.save();

  res.status(200).json({
    success: true,
    message: "Berhasil mendaftar ke event",
    data: event,
  });
});

// @desc    Update participant status
// @route   PUT /api/events/:id/participants/:participantId
// @access  Private
export const updateParticipantStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  // Validasi status participant yang diizinkan
  const allowedParticipantStatuses = ["pending", "confirmed", "cancelled"];
  if (!allowedParticipantStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message:
        "Status participant tidak valid. Status yang diizinkan: pending, confirmed, cancelled",
    });
  }

  const event = await Events.findById(req.params.id);

  if (!event) {
    return res.status(404).json({
      success: false,
      message: "Event tidak ditemukan",
    });
  }

  if (event.isDonationEvent) {
    return res.status(400).json({
      success: false,
      message: "Event donasi tidak memiliki sistem peserta",
    });
  }

  const participant = event.participants.id(req.params.participantId);

  if (!participant) {
    return res.status(404).json({
      success: false,
      message: "Participant tidak ditemukan",
    });
  }

  participant.status = status;
  await event.save();

  res.status(200).json({
    success: true,
    message: "Status participant berhasil diperbarui",
    data: event,
  });
});

// @desc    Remove participant from event
// @route   DELETE /api/events/:id/participants/:participantId
// @access  Private
export const removeParticipant = asyncHandler(async (req, res) => {
  const event = await Events.findById(req.params.id);

  if (!event) {
    return res.status(404).json({
      success: false,
      message: "Event tidak ditemukan",
    });
  }

  if (event.isDonationEvent) {
    return res.status(400).json({
      success: false,
      message: "Event donasi tidak memiliki sistem peserta",
    });
  }

  const participant = event.participants.id(req.params.participantId);

  if (!participant) {
    return res.status(404).json({
      success: false,
      message: "Participant tidak ditemukan",
    });
  }

  // Remove participant using pull method
  event.participants.pull(req.params.participantId);
  event.registeredCount = event.participants.length;

  await event.save();

  res.status(200).json({
    success: true,
    message: "Participant berhasil dihapus",
    data: event,
  });
});

// @desc    Get events by category (NOW INCLUDES donation events)
// @route   GET /api/events/category/:category
// @access  Public
export const getEventsByCategory = asyncHandler(async (req, res) => {
  const events = await Events.find({
    category: req.params.category,
    status: "published",
    // Removed the filter that excluded donation events
  }).sort({ date: 1 });

  res.status(200).json({
    success: true,
    count: events.length,
    data: events,
  });
});

// @desc    Get upcoming events (NOW INCLUDES donation events)
// @route   GET /api/events/upcoming
// @access  Public
export const getUpcomingEvents = asyncHandler(async (req, res) => {
  // Tanggal hari ini (mulai dari awal hari)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Tanggal 7 hari ke depan (akhir hari)
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(today.getDate() + 7);
  sevenDaysFromNow.setHours(23, 59, 59, 999);

  const events = await Events.find({
    date: {
      $gte: today,
      $lte: sevenDaysFromNow,
    },
    status: "published",
    // Removed the filter that excluded donation events
  })
    .sort({ date: 1 })
    .limit(5);

  res.status(200).json({
    success: true,
    count: events.length,
    data: events,
  });
});

// @desc    Get events statistics (both regular and donation events)
// @route   GET /api/events/stats
// @access  Private
export const getEventsStats = asyncHandler(async (req, res) => {
  // Regular events stats
  const totalEvents = await Events.countDocuments({
    $or: [{ isDonationEvent: { $exists: false } }, { isDonationEvent: false }],
  });

  const publishedEvents = await Events.countDocuments({
    status: "published",
    $or: [{ isDonationEvent: { $exists: false } }, { isDonationEvent: false }],
  });

  const draftEvents = await Events.countDocuments({
    status: "draft",
    $or: [{ isDonationEvent: { $exists: false } }, { isDonationEvent: false }],
  });

  const cancelledEvents = await Events.countDocuments({
    status: "cancelled",
    $or: [{ isDonationEvent: { $exists: false } }, { isDonationEvent: false }],
  });

  const completedEvents = await Events.countDocuments({
    status: "completed",
    $or: [{ isDonationEvent: { $exists: false } }, { isDonationEvent: false }],
  });

  // Total participants across regular events only
  const eventsWithParticipants = await Events.aggregate([
    {
      $match: {
        $or: [
          { isDonationEvent: { $exists: false } },
          { isDonationEvent: false },
        ],
      },
    },
    {
      $group: {
        _id: null,
        totalParticipants: { $sum: "$registeredCount" },
        totalBudget: { $sum: "$budget" },
      },
    },
  ]);

  // Donation events stats
  const donationEventsStats = await Events.aggregate([
    { $match: { isDonationEvent: true } },
    {
      $group: {
        _id: null,
        totalDonationEvents: { $sum: 1 },
        activeDonationEvents: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", "published"] },
                  {
                    $or: [
                      { $eq: ["$donationDeadline", null] },
                      { $gt: ["$donationDeadline", new Date()] },
                    ],
                  },
                ],
              },
              1,
              0,
            ],
          },
        },
        totalDonationTarget: { $sum: "$donationTarget" },
        totalDonationCollected: { $sum: "$donationCurrent" },
      },
    },
  ]);

  const stats = {
    // Regular events stats
    totalEvents,
    publishedEvents,
    draftEvents,
    cancelledEvents,
    completedEvents,
    totalParticipants: eventsWithParticipants[0]?.totalParticipants || 0,
    totalBudget: eventsWithParticipants[0]?.totalBudget || 0,

    // Donation events stats
    totalDonationAmount: donationEventsStats[0]?.totalDonationCollected || 0,
    totalDonationEvents: donationEventsStats[0]?.totalDonationEvents || 0,
    activeDonationEvents: donationEventsStats[0]?.activeDonationEvents || 0,
    totalDonationTarget: donationEventsStats[0]?.totalDonationTarget || 0,
    totalDonationCollected: donationEventsStats[0]?.totalDonationCollected || 0,
  };

  res.status(200).json({
    success: true,
    data: stats,
  });
});

// @desc    Get events by date range (NOW INCLUDES donation events)
// @route   GET /api/events/date-range
// @access  Public
export const getEventsByDateRange = asyncHandler(async (req, res) => {
  const { startDate, endDate, status = "published" } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({
      success: false,
      message: "startDate dan endDate harus disediakan",
    });
  }

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const events = await Events.find({
    date: {
      $gte: start,
      $lte: end,
    },
    status: status,
    // Removed the filter that excluded donation events
  }).sort({ date: 1 });

  res.status(200).json({
    success: true,
    count: events.length,
    data: events,
  });
});

// ========== DONATION EVENT FUNCTIONS (unchanged) ==========

// @desc    Create donation event
// @route   POST /api/events/donations
// @access  Private
export const createDonationEvent = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    donationTarget,
    donationDeadline,
    donationDescription,
    category = "Lainnya",
    contact,
    email,
    createdBy,
    date,
  } = req.body;

  let imageUrl = null;
  let imagePublicId = null;

  // Validasi input wajib
  if (!title || !contact || !email || !createdBy) {
    return res.status(400).json({
      success: false,
      message: "Title, contact, email, dan createdBy wajib diisi",
    });
  }

  // Untuk donation event, gambar pamflet wajib ada
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "Gambar pamflet wajib diupload untuk kegiatan donasi",
    });
  }

  try {
    // Upload ke Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "donasi",
    });

    imageUrl = result.secure_url;
    imagePublicId = result.public_id;

    // Hapus file temporary
    fs.unlinkSync(req.file.path);

    // Prepare data untuk donation event
    const eventData = {
      title,
      image: imageUrl,
      imagePublicId,
      contact,
      email,
      createdBy,
      date,
      category,

      // Donation specific fields
      isDonationEvent: true,
      donationDescription: donationDescription || "", // description khusus donasi

      // Default values untuk event fields yang required
      location: "Masjid", // default location
      maxParticipants: 9999, // unlimited untuk donasi
      budget: 0, // default budget
      status: "published", // langsung publish
      description: "Khusus donasi",
    };

    // Add optional donation fields jika ada dan valid
    if (
      donationTarget &&
      !isNaN(donationTarget) &&
      parseInt(donationTarget) > 0
    ) {
      eventData.donationTarget = parseInt(donationTarget);
      eventData.budget = parseInt(donationTarget); // sync budget dengan target donasi
    }

    if (donationDeadline) {
      const deadline = new Date(donationDeadline);
      // Validasi apakah tanggal valid
      if (!isNaN(deadline.getTime())) {
        eventData.donationDeadline = deadline;
      }
    }

    // Simpan ke database
    const newEvent = await Events.create(eventData);

    res.status(201).json({
      success: true,
      message: "Event donasi berhasil dibuat",
      data: newEvent,
    });
  } catch (error) {
    // Cleanup file jika ada error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error("Create donation event error:", error);
    throw error;
  }
});
// @desc    Get active donation events (untuk frontend publik)
// @route   GET /api/events/donations/active
// @access  Public
export const getActiveDonationEvents = asyncHandler(async (req, res) => {
  const events = await Events.find({
    isDonationEvent: true,
    status: "published",
    $or: [
      { donationDeadline: null },
      { donationDeadline: { $gt: new Date() } },
    ],
  })
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json({
    success: true,
    count: events.length,
    data: events,
  });
});

// @desc    Get donation events dengan pagination (untuk admin)
// @route   GET /api/events/donations
// @access  Private
export const getDonationEvents = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, title, status } = req.query;

  const queryObj = { isDonationEvent: true };

  // Search by title
  if (title) {
    queryObj.title = { $regex: title, $options: "i" };
  }

  // Filter by status
  if (status) {
    queryObj.status = status;
  }

  const events = await Events.find(queryObj)
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Events.countDocuments(queryObj);

  res.status(200).json({
    success: true,
    count: events.length,
    total,
    currentPage: parseInt(page),
    totalPages: Math.ceil(total / limit),
    data: events,
  });
});

// @desc    get  donation event (Id)
// @route   PUT /api/events/donations/:id
// @access  Private
export const getDonationId = asyncHandler(async (req, res) => {
  const event = await Events.findById(req.params.id);

  if (!event) {
    return res.status(404).json({
      success: false,
      message: "Event tidak ditemukan",
    });
  }

  res.status(200).json({
    success: true,
    data: event,
  });
});

// @desc    Update donation event
// @route   PUT /api/events/donations/:id
// @access  Private
export const updateDonationEvent = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid ID format",
    });
  }

  const {
    title,
    description,
    donationTarget,
    donationDeadline,
    donationDescription,
    category,
    contact,
    email,
    status,
  } = req.body;

  let updateData = {
    title,
    description,
    category,
    contact,
    email,
    status,
    donationDescription,
  };

  // Handle donation target
  if (donationTarget !== undefined) {
    updateData.donationTarget =
      donationTarget > 0 ? parseInt(donationTarget) : null;
    updateData.budget = updateData.donationTarget || 0;
  }

  // Handle donation deadline
  if (donationDeadline !== undefined) {
    updateData.donationDeadline = donationDeadline
      ? new Date(donationDeadline)
      : null;
  }

  // Cari event yang akan diupdate
  const existingEvent = await Events.findById(id);
  if (!existingEvent) {
    return res.status(404).json({
      success: false,
      message: "Event tidak ditemukan",
    });
  }

  // Pastikan ini adalah donation event
  if (!existingEvent.isDonationEvent) {
    return res.status(400).json({
      success: false,
      message: "Event ini bukan event donasi",
    });
  }

  try {
    // Jika ada file gambar baru
    if (req.file) {
      // Hapus gambar lama dari Cloudinary
      if (existingEvent.imagePublicId) {
        try {
          await cloudinary.uploader.destroy(existingEvent.imagePublicId);
        } catch (deleteError) {
          console.error("Error deleting old image:", deleteError);
        }
      }

      // Upload gambar baru
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "donasi",
      });

      updateData.image = result.secure_url;
      updateData.imagePublicId = result.public_id;

      // Hapus file temporary
      fs.unlinkSync(req.file.path);
    }

    // Update data di database
    const updated = await Events.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      message: "Event donasi berhasil diperbarui",
      data: updated,
    });
  } catch (error) {
    // Cleanup file jika ada error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error("Update donation event error:", error);
    throw error;
  }
});

// @desc    Delete donation event
// @route   DELETE /api/events/donations/:id
// @access  Private
export const deleteDonationEvent = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid ID format",
    });
  }

  const event = await Events.findById(id);
  if (!event) {
    return res.status(404).json({
      success: false,
      message: "Event tidak ditemukan",
    });
  }

  if (!event.isDonationEvent) {
    return res.status(400).json({
      success: false,
      message: "Event ini bukan event donasi",
    });
  }

  // Cek apakah sudah ada donasi
  try {
    const Donation = (await import("../models/donationModel.js")).default;
    const donationCount = await Donation.countDocuments({
      eventId: id,
      paymentStatus: "settlement",
    });

    if (donationCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Tidak dapat menghapus event yang sudah memiliki donasi",
      });
    }
  } catch (error) {
    console.log("Donation model not found, proceeding with delete");
  }

  // Hapus gambar dari Cloudinary
  if (event.imagePublicId) {
    try {
      await cloudinary.uploader.destroy(event.imagePublicId);
    } catch (error) {
      console.error("Error deleting image from Cloudinary:", error);
    }
  }

  // Hapus dokumen dari MongoDB
  await Events.findByIdAndDelete(id);

  res.status(200).json({
    success: true,
    message: "Event donasi berhasil dihapus",
  });
});
