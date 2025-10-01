import mongoose from "mongoose";

const activitySchema = new mongoose.Schema(
  {
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: [
        "donation",
        "news",
        "event",
        "user",
        "finance",
        "inventory",
        "general",
      ],
      default: "general",
    },
    user: {
      type: String,
      default: "System",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed, // Untuk data tambahan
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Index untuk performa query
activitySchema.index({ createdAt: -1 });
activitySchema.index({ type: 1, createdAt: -1 });

const Activity = mongoose.model("Activity", activitySchema);
export default Activity;
