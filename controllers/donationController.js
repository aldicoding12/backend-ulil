import asyncHandler from "../middlewares/asyncHandler.js";
import Donation from "../models/donationModel.js";
import Events from "../models/eventsModel.js"; // Menggunakan Events model
import mongoose from "mongoose";
import midtransClient from "midtrans-client";

// Konfigurasi Midtrans
const snap = new midtransClient.Snap({
  isProduction: process.env.NODE_ENV === "production",
  serverKey: process.env.MIDTRANS_SERVER_KEY,
});

// Fungsi untuk verifikasi signature
const verifySignature = (data) => {
  const { order_id, status_code, gross_amount, server_key } = data;
  const hash = crypto
    .createHash("sha512")
    .update(`${order_id}${status_code}${gross_amount}${server_key}`)
    .digest("hex");
  return hash === data.signature_key;
};

// @desc    Create donation transaction
// @route   POST /api/v1/donations
// @access  Public
export const createDonation = asyncHandler(async (req, res) => {
  // Ambil data dari request body
  const { eventId, donorName, donorPhone, amount, message, isAnonymous } =
    req.body;

  // Validasi input required
  if (!eventId || !amount) {
    return res.status(400).json({
      success: false,
      message: "Event ID dan amount harus diisi",
    });
  }

  // Validasi apakah event exists
  const event = await Events.findById(eventId);
  if (!event) {
    return res.status(404).json({
      success: false,
      message: "Event tidak ditemukan",
    });
  }

  // Deklarasikan newDonation di luar blok try agar bisa diakses di catch
  let newDonation = null;

  try {
    // Generate unique order ID
    const orderId = `DONATION-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Prepare donation data - tetap sama
    const donationData = {
      eventId,
      donorName: isAnonymous ? "Hamba Allah" : donorName,
      donorPhone: isAnonymous ? null : donorPhone,
      amount: parseInt(amount),
      message: message || "",
      isAnonymous: Boolean(isAnonymous),
      orderId,
    };

    // Simpan ke variabel yang sudah dideklarasikan di atas
    newDonation = await Donation.create(donationData);

    // PERBAIKAN: Konfigurasi parameter Midtrans
    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: parseInt(amount),
      },
      customer_details: {
        first_name: donorName || "Donatur",
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
      // PERBAIKAN: Gunakan URL yang benar dan tambahkan parameter
      callbacks: {
        finish: `${process.env.FRONTEND_URL}/donation/success?order_id=${orderId}`,
        error: `${process.env.FRONTEND_URL}/donation/error?order_id=${orderId}`,
        pending: `${process.env.FRONTEND_URL}/donation/pending?order_id=${orderId}`,
      },
      // TAMBAHAN: Konfigurasi notification URL untuk webhook
      custom_field1: orderId, // Untuk tracking tambahan
    };

    // Create transaction dengan Midtrans
    const transaction = await snap.createTransaction(parameter);

    // Update donation dengan snap token
    newDonation.snapToken = transaction.token;
    newDonation.midtransResponse = transaction;
    await newDonation.save();

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
    // PERBAIKAN: Sekarang newDonation bisa diakses karena dideklarasikan di scope yang sama
    if (newDonation && newDonation._id) {
      try {
        await Donation.findByIdAndDelete(newDonation._id);
      } catch (cleanupError) {}
    }

    // Re-throw error agar bisa di-handle oleh asyncHandler
    throw error;
  }
});

// PERBAIKAN: Update handleMidtransNotification untuk handle settlement
export const handleMidtransNotification = asyncHandler(async (req, res) => {
  const notification = req.body;

  console.log("📨 Received Midtrans Notification:", {
    orderId: notification.order_id,
    transactionStatus: notification.transaction_status,
    fraudStatus: notification.fraud_status,
  });

  // Verifikasi signature untuk keamanan
  const isValidSignature = verifySignature({
    order_id: notification.order_id,
    status_code: notification.status_code,
    gross_amount: notification.gross_amount,
    server_key: process.env.MIDTRANS_SERVER_KEY,
    signature_key: notification.signature_key,
  });

  if (!isValidSignature) {
    console.error("❌ Invalid signature");
    return res.status(403).json({
      success: false,
      message: "Invalid signature",
    });
  }

  const orderId = notification.order_id;
  const transactionStatus = notification.transaction_status;
  const fraudStatus = notification.fraud_status;
  const paymentType = notification.payment_type;

  // Cari donation berdasarkan order ID
  const donation = await Donation.findOne({ orderId });
  if (!donation) {
    console.error("❌ Donation not found:", orderId);
    return res.status(404).json({
      success: false,
      message: "Donation not found",
    });
  }

  let paymentStatus = "pending";

  // Handle semua status dari Midtrans
  if (transactionStatus === "capture") {
    if (fraudStatus === "accept") {
      paymentStatus = "settlement";
    } else if (fraudStatus === "challenge") {
      paymentStatus = "challenge";
    } else {
      paymentStatus = "deny";
    }
  } else if (transactionStatus === "settlement") {
    paymentStatus = "settlement";
  } else if (transactionStatus === "success") {
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

  console.log(`🔄 Updating donation ${orderId} to status: ${paymentStatus}`);

  // Update donation status
  donation.paymentStatus = paymentStatus;
  donation.transactionId = notification.transaction_id;
  donation.paymentType = paymentType;
  donation.midtransResponse = notification;

  // Jika pembayaran berhasil (settlement)
  if (paymentStatus === "settlement") {
    donation.paidAt = new Date();

    console.log(`✅ Payment SUCCESS for ${orderId}`);

    // Update event donation current amount
    try {
      const event = await Events.findById(donation.eventId);
      if (event) {
        event.donationCurrent += donation.amount;
        event.actualCost += donation.amount;
        await event.save();
        console.log(`💰 Updated event ${event.title}: +${donation.amount}`);
      }
    } catch (eventUpdateError) {
      console.error("Error updating event:", eventUpdateError);
      // Jangan gagalkan webhook karena error update event
    }
  }

  await donation.save();

  console.log(`✅ Donation ${orderId} updated successfully`);

  // PENTING: Selalu return 200 ke Midtrans
  res.status(200).json({
    success: true,
    message: "Notification processed successfully",
  });
});

export const handleMidtransRedirect = asyncHandler(async (req, res) => {
  const { order_id, status_code, transaction_status } = req.query;

  // Cari donation
  const donation = await Donation.findOne({ orderId: order_id });

  if (!donation) {
    return res.redirect(
      `${process.env.FRONTEND_URL}/donation/error?message=donation_not_found`
    );
  }

  // Redirect ke frontend berdasarkan status
  if (transaction_status === "settlement" || status_code === "200") {
    return res.redirect(
      `${process.env.FRONTEND_URL}/donation/success?order_id=${order_id}`
    );
  } else if (transaction_status === "pending") {
    return res.redirect(
      `${process.env.FRONTEND_URL}/donation/pending?order_id=${order_id}`
    );
  } else {
    return res.redirect(
      `${process.env.FRONTEND_URL}/donation/error?order_id=${order_id}`
    );
  }
});

// PERBAIKAN: Update getDonationStats untuk handle 'settlement' status juga
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
        paymentStatus: "settlement", // Ini sudah benar
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
  // PERBAIKAN: Get recent donations dengan status success
  const recentDonations = await Donation.find({
    eventId,
    paymentStatus: "settlement", // Ubah dari "settlement" ke "success"
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

//////////////
export const getAllDonationStats = asyncHandler(async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Total donation amount dari semua transaksi settlement
    const totalAmountAgg = await Donation.aggregate([
      { $match: { paymentStatus: "settlement" } }, // FIX: ganti status jadi paymentStatus
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalAmount = totalAmountAgg[0]?.total || 0;

    // Today's donation amount
    const todayAmountAgg = await Donation.aggregate([
      {
        $match: {
          paymentStatus: "settlement", // FIX
          createdAt: { $gte: startOfDay },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const todayAmount = todayAmountAgg[0]?.total || 0;

    // Calculate growth rate
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const lastMonthAmountAgg = await Donation.aggregate([
      {
        $match: {
          paymentStatus: "settlement", // FIX
          createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const lastMonthAmount = lastMonthAmountAgg[0]?.total || 0;

    const thisMonthAmountAgg = await Donation.aggregate([
      {
        $match: {
          paymentStatus: "settlement", // FIX
          createdAt: { $gte: startOfMonth },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const thisMonthAmount = thisMonthAmountAgg[0]?.total || 0;

    const growthRate =
      lastMonthAmount > 0
        ? (
            ((thisMonthAmount - lastMonthAmount) / lastMonthAmount) *
            100
          ).toFixed(1)
        : 100;

    res.status(200).json({
      success: true,
      data: {
        totalAmount,
        todayAmount,
        growthRate: parseFloat(growthRate),
        thisMonthAmount,
        lastMonthAmount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching donation statistics",
      error: error.message,
    });
  }
});
