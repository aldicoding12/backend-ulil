import mongoose from "mongoose";

const profileSchema = new mongoose.Schema(
  {
    // Basic Information
    mosqueName: {
      type: String,
      required: true,
    },
    fullAddress: {
      type: String,
      required: true,
    },
    streetName: {
      type: String,
      required: true,
    },
    establishmentYear: {
      type: Number,
      required: true,
    },
    founderName: {
      type: String,
      required: true,
    },
    briefHistory: {
      type: String,
    },
    vision: {
      type: String,
    },
    mission: {
      type: String,
    },
    mosqueMotto: {
      type: String,
    },
    activeCongregationCount: {
      type: Number,
      default: 0,
    },
    image: {
      type: String,
    },
    imagePublicId: {
      type: String,
    },

    // Demographics Statistics
    maleCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    femaleCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    childrenCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    elderlyCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Weekly Attendance Data
    weeklyAttendance: {
      type: [
        {
          day: {
            type: String,
            enum: ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"],
            required: true,
          },
          count: {
            type: Number,
            default: 0,
            min: 0,
          },
        },
      ],
      default: [
        { day: "Sen", count: 0 },
        { day: "Sel", count: 0 },
        { day: "Rab", count: 0 },
        { day: "Kam", count: 0 },
        { day: "Jum", count: 0 },
        { day: "Sab", count: 0 },
        { day: "Min", count: 0 },
      ],
    },

    // Monthly Growth Data
    monthlyGrowth: {
      type: [
        {
          month: {
            type: String,
            enum: [
              "Jan",
              "Feb",
              "Mar",
              "Apr",
              "Mei",
              "Jun",
              "Jul",
              "Agu",
              "Sep",
              "Okt",
              "Nov",
              "Des",
            ],
            required: true,
          },
          jamaah: {
            type: Number,
            default: 0,
            min: 0,
          },
        },
      ],
      default: [
        { month: "Jan", jamaah: 0 },
        { month: "Feb", jamaah: 0 },
        { month: "Mar", jamaah: 0 },
        { month: "Apr", jamaah: 0 },
        { month: "Mei", jamaah: 0 },
        { month: "Jun", jamaah: 0 },
        { month: "Jul", jamaah: 0 },
        { month: "Agu", jamaah: 0 },
        { month: "Sep", jamaah: 0 },
        { month: "Okt", jamaah: 0 },
        { month: "Nov", jamaah: 0 },
        { month: "Des", jamaah: 0 },
      ],
    },

    // Additional fields that might be useful
    mosqueImage: {
      type: String, // Alternative field name used in ProfilView
    },
    logoUrl: {
      type: String, // Alternative field name used in ProfilView
    },
  },
  {
    timestamps: true,
    // Add virtual for mosqueImage compatibility
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual field to ensure compatibility with ProfilView
profileSchema.virtual("displayImage").get(function () {
  return this.image || this.mosqueImage || this.logoUrl;
});

// Method to calculate total congregation from demographics
profileSchema.methods.getTotalFromDemographics = function () {
  return (
    (this.maleCount || 0) +
    (this.femaleCount || 0) +
    (this.childrenCount || 0) +
    (this.elderlyCount || 0)
  );
};

// Method to update weekly attendance for a specific day
profileSchema.methods.updateWeeklyAttendance = function (day, count) {
  const attendanceDay = this.weeklyAttendance.find((item) => item.day === day);
  if (attendanceDay) {
    attendanceDay.count = count;
  } else {
    this.weeklyAttendance.push({ day, count });
  }
  return this.save();
};

// Method to update monthly growth for a specific month
profileSchema.methods.updateMonthlyGrowth = function (month, jamaah) {
  const growthMonth = this.monthlyGrowth.find((item) => item.month === month);
  if (growthMonth) {
    growthMonth.jamaah = jamaah;
  } else {
    this.monthlyGrowth.push({ month, jamaah });
  }
  return this.save();
};

// Pre-save middleware to ensure activeCongregationCount is at least equal to demographics total
profileSchema.pre("save", function (next) {
  const demographicsTotal = this.getTotalFromDemographics();
  if (this.activeCongregationCount < demographicsTotal) {
    this.activeCongregationCount = demographicsTotal;
  }
  next();
});

const Profile = mongoose.model("Profile", profileSchema);

export default Profile;
