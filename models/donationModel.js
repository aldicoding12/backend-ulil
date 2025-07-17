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
  }
);

// Index untuk query yang sering digunakan
donationSchema.index({ eventId: 1, paymentStatus: 1 });
donationSchema.index({ orderId: 1 });
donationSchema.index({ createdAt: -1 });

export default mongoose.model("Donation", donationSchema);
