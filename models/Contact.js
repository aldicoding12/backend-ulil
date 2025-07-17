import mongoose from "mongoose";
const { Schema } = mongoose;

const contactSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Nama harus diisi"],
      trim: true,
      minlength: [2, "Nama minimal 2 karakter"],
      maxlength: [100, "Nama maksimal 100 karakter"],
    },
    email: {
      type: String,
      required: [true, "Email harus diisi"],
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Format email tidak valid"],
    },
    subject: {
      type: String,
      required: [true, "Subjek harus diisi"],
      trim: true,
      minlength: [3, "Subjek minimal 3 karakter"],
      maxlength: [200, "Subjek maksimal 200 karakter"],
    },
    message: {
      type: String,
      required: [true, "Pesan harus diisi"],
      trim: true,
      minlength: [10, "Pesan minimal 10 karakter"],
      maxlength: [1000, "Pesan maksimal 1000 karakter"],
    },
    status: {
      type: String,
      enum: ["unread", "read", "replied", "archived"],
      default: "unread",
    },
    category: {
      type: String,
      enum: [
        "general",
        "complaint",
        "suggestion",
        "question",
        "volunteer",
        "donation",
        "event",
        "other",
      ],
      default: "general",
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
    },
    adminNotes: {
      type: String,
      trim: true,
      maxlength: [500, "Catatan admin maksimal 500 karakter"],
    },
    replyMessage: {
      type: String,
      trim: true,
      maxlength: [1000, "Balasan maksimal 1000 karakter"],
    },
    repliedAt: {
      type: Date,
    },
    repliedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
contactSchema.index({ status: 1, createdAt: -1 });
contactSchema.index({ email: 1 });
contactSchema.index({ category: 1, priority: 1 });
contactSchema.index({ createdAt: -1 });

// Virtual untuk tanggal format Indonesia
contactSchema.virtual("formattedDate").get(function () {
  return this.createdAt.toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
});

// Virtual untuk kategori label
contactSchema.virtual("categoryLabel").get(function () {
  const labels = {
    general: "Umum",
    complaint: "Keluhan",
    suggestion: "Saran",
    question: "Pertanyaan",
    volunteer: "Volunteer",
    donation: "Donasi",
    event: "Kegiatan",
    other: "Lainnya",
  };
  return labels[this.category] || "Umum";
});

// Static method untuk statistik
contactSchema.statics.getStats = async function () {
  const totalContacts = await this.countDocuments();
  const todayContacts = await this.countDocuments({
    createdAt: {
      $gte: new Date(new Date().setHours(0, 0, 0, 0)),
      $lte: new Date(new Date().setHours(23, 59, 59, 999)),
    },
  });

  const statusStats = await this.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  return {
    total: totalContacts,
    today: todayContacts,
    byStatus: statusStats.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {}),
  };
};

// Instance methods
contactSchema.methods.markAsRead = function () {
  this.status = "read";
  return this.save();
};

contactSchema.methods.reply = function (replyMessage, adminId) {
  this.replyMessage = replyMessage;
  this.status = "replied";
  this.repliedAt = new Date();
  this.repliedBy = adminId;
  return this.save();
};

// Pre-save middleware untuk auto-set priority dan category
contactSchema.pre("save", function (next) {
  if (this.isNew || this.isModified("subject") || this.isModified("message")) {
    const urgentKeywords = [
      "mendesak",
      "urgent",
      "darurat",
      "emergency",
      "segera",
    ];
    const highKeywords = [
      "penting",
      "important",
      "complaint",
      "keluhan",
      "masalah",
    ];

    const text = (this.subject + " " + this.message).toLowerCase();

    if (urgentKeywords.some((keyword) => text.includes(keyword))) {
      this.priority = "urgent";
    } else if (highKeywords.some((keyword) => text.includes(keyword))) {
      this.priority = "high";
    }

    // Auto-set category
    const categoryKeywords = {
      complaint: ["keluhan", "complaint", "masalah", "problem"],
      suggestion: ["saran", "suggestion", "usul", "ide"],
      volunteer: ["volunteer", "relawan", "membantu", "bergabung"],
      donation: ["donasi", "donation", "sumbangan", "infaq"],
      event: ["kegiatan", "event", "acara", "kajian"],
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some((keyword) => text.includes(keyword))) {
        this.category = category;
        break;
      }
    }
  }
  next();
});

const Contact = mongoose.model("Contact", contactSchema);
export default Contact;
