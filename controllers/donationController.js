import asyncHandler from "../middlewares/asyncHandler.js";
import Donation from "../models/donationModel.js";
import Events from "../models/eventsModel.js"; // Menggunakan Events model
import mongoose from "mongoose";
import midtransClient from "midtrans-client";

// Konfigurasi Midtrans
const snap = new midtransClient.Snap({
  isProduction: process.env.NODE_ENV === "false",
  serverKey: process.env.MIDTRANS_SERVER_KEY,
});

// @desc    Create donation transaction
// @route   POST /api/v1/donations
// @access  Public
export const createDonation = asyncHandler(async (req, res) => {
  const { eventId, donorName, donorPhone, amount, message, isAnonymous } =
    req.body;

  // Validasi input
  if (!eventId || !donorPhone || !amount) {
    return res.status(400).json({
      success: false,
      message: "Event ID, nama donatur, dan jumlah donasi wajib diisi",
    });
  }

  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid event ID format",
    });
  }

  if (amount < 1000) {
    return res.status(400).json({
      success: false,
      message: "Minimal donasi Rp 1.000",
    });
  }

  // Cek apakah event exists dan merupakan donation event
  const event = await Events.findById(eventId);
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

  if (event.status !== "published") {
    return res.status(400).json({
      success: false,
      message: "Event donasi tidak aktif",
    });
  }

  // Cek apakah donation deadline sudah lewat
  if (event.donationDeadline && new Date() > event.donationDeadline) {
    return res.status(400).json({
      success: false,
      message: "Periode donasi sudah berakhir",
    });
  }

  try {
    // Generate unique order ID
    const orderId = `DONATION-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Prepare donation data
    const donationData = {
      eventId,
      donorName: isAnonymous ? "Hamba Allah" : donorName,
      donorPhone: isAnonymous ? null : donorPhone,
      amount: parseInt(amount),
      message: message || "",
      isAnonymous: Boolean(isAnonymous),
      orderId,
    };

    // Simpan donation ke database dengan status pending
    const newDonation = await Donation.create(donationData);

    // Prepare Midtrans transaction parameter
    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: parseInt(amount),
      },
      customer_details: {
        first_name: donorName,
        phone: donorPhone || "",
      },
      item_details: [
        {
          id: eventId,
          price: parseInt(amount),
          quantity: 1,
          name: `Donasi: ${event.title}`,
        },
      ],
      callbacks: {
        finish: `${process.env.FRONTEND_URL}/donation/success`,
        error: `${process.env.FRONTEND_URL}/donation/error`,
        pending: `${process.env.FRONTEND_URL}/donation/pending`,
      },
    };

    // Create transaction dengan Midtrans
    const transaction = await snap.createTransaction(parameter);

    // Update donation dengan snap token
    newDonation.snapToken = transaction.token;
    newDonation.midtransResponse = transaction;
    await newDonation.save();

    console.log("Donation created:", {
      donationId: newDonation._id,
      orderId,
      amount,
      snapToken: transaction.token,
    });

    res.status(201).json({
      success: true,
      message: "Transaksi donasi berhasil dibuat",
      data: {
        donationId: newDonation._id,
        orderId,
        snapToken: transaction.token,
        redirectUrl: transaction.redirect_url,
      },
    });
  } catch (error) {
    console.error("Create donation error:", error);
    throw error;
  }
});

// @desc    Handle Midtrans notification webhook
// @route   POST /api/v1/donations/notification
// @access  Public (Webhook)
export const handleMidtransNotification = asyncHandler(async (req, res) => {
  const notification = req.body;

  console.log("Midtrans notification received:", notification);

  const orderId = notification.order_id;
  const transactionStatus = notification.transaction_status;
  const fraudStatus = notification.fraud_status;
  const paymentType = notification.payment_type;

  // Cari donation berdasarkan order ID
  const donation = await Donation.findOne({ orderId });
  if (!donation) {
    return res.status(404).json({
      success: false,
      message: "Donation not found",
    });
  }

  let paymentStatus = "pending";

  if (transactionStatus === "capture") {
    if (fraudStatus === "accept") {
      paymentStatus = "settlement";
    }
  } else if (transactionStatus === "settlement") {
    paymentStatus = "settlement";
  } else if (
    transactionStatus === "cancel" ||
    transactionStatus === "deny" ||
    transactionStatus === "expire"
  ) {
    paymentStatus = transactionStatus;
  } else if (transactionStatus === "pending") {
    paymentStatus = "pending";
  }

  // Update donation status
  donation.paymentStatus = paymentStatus;
  donation.transactionId = notification.transaction_id;
  donation.paymentType = paymentType;
  donation.midtransResponse = notification;

  if (paymentStatus === "settlement") {
    donation.paidAt = new Date();

    // Update event donation current amount
    const event = await Events.findById(donation.eventId);
    if (event) {
      event.donationCurrent += donation.amount;
      event.actualCost += donation.amount; // Update actual cost juga
      await event.save();
    }
  }

  await donation.save();

  console.log("Donation updated:", {
    donationId: donation._id,
    orderId,
    paymentStatus,
    amount: donation.amount,
  });

  res.status(200).json({
    success: true,
    message: "Notification processed successfully",
  });
});

// @desc    Get donation history with pagination
// @route   GET /api/v1/donations
// @access  Private
export const getDonationHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, eventId, status } = req.query;

  // Build filter object
  const filter = {};
  if (eventId) filter.eventId = eventId;
  if (status) filter.paymentStatus = status;

  const donations = await Donation.find(filter)
    .populate("eventId", "title image isDonationEvent")
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Donation.countDocuments(filter);

  res.status(200).json({
    success: true,
    count: donations.length,
    total,
    currentPage: parseInt(page),
    totalPages: Math.ceil(total / limit),
    data: donations,
  });
});

// @desc    Get donation by ID
// @route   GET /api/v1/donations/:id
// @access  Private
export const getDonationById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid ID format",
    });
  }

  const donation = await Donation.findById(id)
    .populate("eventId", "title image isDonationEvent")
    .lean();

  if (!donation) {
    return res.status(404).json({
      success: false,
      message: "Donasi tidak ditemukan",
    });
  }

  res.status(200).json({
    success: true,
    message: "Berhasil menampilkan detail donasi",
    data: donation,
  });
});

// @desc    Get donation statistics for specific event
// @route   GET /api/v1/donations/stats/:eventId
// @access  Private
export const getDonationStats = asyncHandler(async (req, res) => {
  const { eventId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid event ID format",
    });
  }

  const stats = await Donation.aggregate([
    {
      $match: {
        eventId: new mongoose.Types.ObjectId(eventId),
        paymentStatus: "settlement",
      },
    },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: "$amount" },
        totalDonations: { $sum: 1 },
        averageAmount: { $avg: "$amount" },
        lastDonation: { $max: "$paidAt" },
      },
    },
  ]);

  // Get recent donations
  const recentDonations = await Donation.find({
    eventId,
    paymentStatus: "settlement",
  })
    .sort({ paidAt: -1 })
    .limit(10)
    .select("donorName amount paidAt isAnonymous message")
    .lean();

  const result = {
    totalAmount: stats[0]?.totalAmount || 0,
    totalDonations: stats[0]?.totalDonations || 0,
    averageAmount: stats[0]?.averageAmount || 0,
    lastDonation: stats[0]?.lastDonation || null,
    recentDonations: recentDonations.map((d) => ({
      ...d,
      donorName: d.isAnonymous ? "Hamba Allah" : d.donorName,
    })),
  };

  res.status(200).json({
    success: true,
    message: "Berhasil menampilkan statistik donasi",
    data: result,
  });
});

// @desc    Check donation status by order ID
// @route   GET /api/v1/donations/status/:orderId
// @access  Public
export const checkDonationStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const donation = await Donation.findOne({ orderId })
    .populate("eventId", "title")
    .lean();

  if (!donation) {
    return res.status(404).json({
      success: false,
      message: "Donasi tidak ditemukan",
    });
  }

  res.status(200).json({
    success: true,
    message: "Status donasi ditemukan",
    data: {
      donationId: donation._id,
      orderId: donation.orderId,
      paymentStatus: donation.paymentStatus,
      amount: donation.amount,
      event: donation.eventId,
      paidAt: donation.paidAt,
    },
  });
});
