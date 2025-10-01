import Activity from "../models/Activity.js"; // Model baru
import asyncHandler from "../middlewares/asyncHandler.js";

export const getRecentActivities = asyncHandler(async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const activities = await Activity.find()
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    // Transform data untuk frontend
    const transformedActivities = activities.map((activity) => ({
      id: activity._id,
      message: activity.message,
      time: getTimeAgo(activity.createdAt),
      user: activity.user || "System",
      type: activity.type || "general",
    }));

    res.status(200).json({
      success: true,
      data: transformedActivities,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching recent activities",
      error: error.message,
    });
  }
});

export const logActivity = asyncHandler(async (req, res) => {
  try {
    const { message, type, user } = req.body;

    const activity = await Activity.create({
      message,
      type: type || "general",
      user: user || "System",
    });

    res.status(201).json({
      success: true,
      message: "Activity logged successfully",
      data: activity,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error logging activity",
      error: error.message,
    });
  }
});

// Helper function
function getTimeAgo(date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now - new Date(date)) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds} detik lalu`;
  if (diffInSeconds < 3600)
    return `${Math.floor(diffInSeconds / 60)} menit lalu`;
  if (diffInSeconds < 86400)
    return `${Math.floor(diffInSeconds / 3600)} jam lalu`;
  return `${Math.floor(diffInSeconds / 86400)} hari lalu`;
}
