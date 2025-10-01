import mongoose from "mongoose";

const donationSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Events", // Menggunakan model Events yang sudah ada
      required: true,
    },
    donorName: {
      type: String,
      required: [true, "Nama donatur wajib diisi"],
      trim: true,
    },
    donorPhone: {
      type: String,
      default: null,
    },
    // Tambahkan field untuk alamat jika diperlukan
    address: {
      type: String,
      default: "",
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, "Jumlah donasi wajib diisi"],
      min: [1000, "Minimal donasi Rp 1.000"],
    },
    message: {
      type: String,
      default: "",
      trim: true,
    },
    isAnonymous: {
      type: Boolean,
      default: false,
    },
    // Midtrans transaction data
    orderId: {
      type: String,
      required: true,
      unique: true,
    },
    transactionId: {
      type: String,
      default: null,
    },
    paymentType: {
      type: String,
      default: null,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "settlement", "cancel", "deny", "expire", "failure"],
      default: "pending",
    },
    paidAt: {
      type: Date,
      default: null,
    },
    // Tambahkan field donatedAt untuk konsistensi
    donatedAt: {
      type: Date,
      default: Date.now,
    },
    snapToken: {
      type: String,
      default: null,
    },
    // Midtrans raw response
    midtransResponse: {
      type: Object,
      default: null,
    },
  },
  {
    timestamps: true,
    // Pastikan virtual fields disertakan dalam JSON
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes untuk performance
donationSchema.index({ eventId: 1, paymentStatus: 1 });
donationSchema.index({ donorPhone: 1 });
donationSchema.index({ transactionId: 1 }, { sparse: true });
donationSchema.index({ orderId: 1 });
donationSchema.index({ donatedAt: -1 });

// Virtual untuk nama yang ditampilkan (handle anonymous) - DIPERBAIKI
donationSchema.virtual("displayName").get(function () {
  return this.isAnonymous ? "Hamba Allah" : this.donorName; // Gunakan donorName bukan name
});

// Virtual untuk phone yang ditampilkan
donationSchema.virtual("phone").get(function () {
  return this.donorPhone;
});

// Pre-save middleware untuk generate orderId jika belum ada
donationSchema.pre("save", function (next) {
  if (!this.orderId) {
    // Format: DON-YYYYMMDD-RANDOMSTRING
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.orderId = `DON-${date}-${random}`;
  }

  // Set donatedAt jika payment settled dan belum ada donatedAt
  if (this.paymentStatus === "settlement" && !this.donatedAt) {
    this.donatedAt = this.paidAt || new Date();
  }

  next();
});

// Static method untuk mendapatkan total donasi event
donationSchema.statics.getTotalDonationByEvent = function (eventId) {
  return this.aggregate([
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
        totalDonors: { $sum: 1 },
        averageAmount: { $avg: "$amount" },
      },
    },
  ]);
};

// Static method untuk mendapatkan donors berdasarkan eventId
donationSchema.statics.getDonorsByEvent = function (eventId) {
  return this.find({
    eventId: new mongoose.Types.ObjectId(eventId),
    paymentStatus: "settlement",
  })
    .sort({ donatedAt: -1 })
    .select("donorName donorPhone address amount message isAnonymous donatedAt")
    .lean(); // Gunakan lean() untuk performance lebih baik
};

// Instance method untuk mark as settled
donationSchema.methods.markAsSettled = function () {
  this.paymentStatus = "settlement";
  this.paidAt = new Date();
  this.donatedAt = this.paidAt; // Set donatedAt juga
  return this.save();
};

const Donation = mongoose.model("Donation", donationSchema);

export default Donation;
