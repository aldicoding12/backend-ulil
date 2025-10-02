import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

dotenv.config();
const app = express();

// CORS
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);
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

app.use("/api/ul/data/user", authRouter);
app.use("/api/ul/data/news", newsRoute);
app.use("/api/ul/data/finance", financeRouter);
app.use("/api/ul/data/events", eventRouter);
app.use("/api/ul/data/donation", donationRouter);
app.use("/api/ul/data/contact", contactRouter);
app.use("/api/ul/data/inventory", inventoryRouter);
app.use("/api/ul/data/profile", profileRouter);
app.use("/api/ul/data/activities", activityRoutes);

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    message: "API is running",
    status: "success",
    timestamp: new Date().toISOString(),
  });
});

// Error handler
import { errorHandler, notFound } from "./middlewares/errorMiddleware.js";
app.use(notFound);
app.use(errorHandler);

export default app;
