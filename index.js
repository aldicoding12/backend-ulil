import app from "./app.js";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DATABASE);
    console.log("✅ MongoDB Connected");
  } catch (err) {
    console.error("❌ Failed to connect MongoDB:", err.message);
    process.exit(1);
  }
};

// Connect to database
connectDB();

// Start server only if not in serverless environment (Vercel)
if (process.env.VERCEL !== "1") {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

// Export for Vercel serverless
export default app;
