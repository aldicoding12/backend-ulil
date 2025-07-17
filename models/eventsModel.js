import mongoose from "mongoose";
const { Schema } = mongoose;

// Schema untuk participant
const participantSchema = new Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  registeredAt: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ["pending", "confirmed", "cancelled"],
    default: "pending",
  },
});

const eventsSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    date: { type: Date, required: true },
    location: { type: String, required: true },
    maxParticipants: { type: Number, required: true },
    registeredCount: { type: Number, default: 0 },
    attendedCount: { type: Number, default: 0 },
    budget: { type: Number, required: true },
    actualCost: { type: Number, default: 0 },
    participants: [participantSchema],
    category: {
      type: String,
      required: true,
      enum: ["Kajian", "Pendidikan", "Sosial", "Ibadah", "Lainnya"],
    },
    status: {
      type: String,
      required: true,
      enum: ["draft", "published", "cancelled", "completed"],
      default: "draft",
    },
    createdBy: { type: String, required: true },
    requirements: [{ type: String }],
    contact: { type: String, required: true },
    email: {
      type: String,
      required: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    image: { type: String, required: true },
    imagePublicId: { type: String, required: false },

    // TAMBAHAN FIELD UNTUK DONASI
    isDonationEvent: { type: Boolean, default: false },
    donationTarget: { type: Number, default: null }, // target donasi
    donationCurrent: { type: Number, default: 0 }, // donasi terkumpul
    donationDeadline: { type: Date, default: null }, // deadline donasi
    donationDescription: { type: String, default: "" }, // deskripsi khusus donasi
  },
  {
    timestamps: true,
  }
);

const Events = mongoose.model("Events", eventsSchema);
export default Events;
