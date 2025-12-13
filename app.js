import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

dotenv.config();
const app = express();

// CORS Configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowed = [
      "http://localhost:5173",
      "http://localhost:5174", // ✅ Port frontend Anda
      "https://frontend-ulil.vercel.app",
    ];

    // Izinkan semua deployment preview dari Vercel
    const isVercelPreview =
      origin && /frontend-ulil.*\.vercel\.app$/.test(origin);

    // Izinkan localhost hanya di development
    const isLocalhost = origin && /^http:\/\/localhost:\d+$/.test(origin);
    const isDevelopment = process.env.NODE_ENV !== "production";

    if (
      !origin || // Request dari server yang sama (Postman, curl, dll)
      allowed.includes(origin) ||
      isVercelPreview ||
      (isLocalhost && isDevelopment) // ✅ Localhost hanya di development
    ) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie", "api_key"], // ✅ Tambahkan api_key
  exposedHeaders: ["Set-Cookie"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("./public"));

// Routes
import authRouter from "./routers/authRoute.js";
import newsRoute from "./routers/newsRoute.js";
import financeRouter from "./routers/financeRouter.js";
import eventRouter from "./routers/eventRouter.js";
import donationRouter from "./routers/donationRouter.js";
import contactRouter from "./routers/contactRouter.js";
import inventoryRouter from "./routers/inventoryRouter.js";
import profileRouter from "./routers/profileRouter.js";
import activityRoutes from "./routers/activityRoutes.js";
import galeriRouter from "./routers/galeriRouter.js";

app.use("/api/ul/data/user", authRouter);
app.use("/api/ul/data/news", newsRoute);
app.use("/api/ul/data/finance", financeRouter);
app.use("/api/ul/data/events", eventRouter);
app.use("/api/ul/data/donation", donationRouter);
app.use("/api/ul/data/contact", contactRouter);
app.use("/api/ul/data/inventory", inventoryRouter);
app.use("/api/ul/data/profile", profileRouter);
app.use("/api/ul/data/activities", activityRoutes);
app.use("/api/ul/data/galeri", galeriRouter);

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    message: "API is running",
    status: "success",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Error handler
import { errorHandler, notFound } from "./middlewares/errorMiddleware.js";
app.use(notFound);
app.use(errorHandler);

export default app;
