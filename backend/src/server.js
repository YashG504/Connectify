import express from "express";
import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import helmet from "helmet";

import authRoutes from "./routes/auth.route.js";
import userRoutes from "./routes/user.route.js";
import chatRoutes from "./routes/chat.route.js";
import channelRoutes from "./routes/channel.route.js";
import aiRoutes from "./routes/ai.route.js";

import { connectDB } from "./lib/db.js";
import { app, server } from "./lib/socket.js"; 
import { errorHandler } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimiter.js";

const PORT = process.env.PORT || 5001;
const __dirname = path.resolve();

// Security: Set various HTTP headers to protect against common attacks
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow serving uploaded images cross-origin
}));

// CORS Configuration — only allow specific, known origins
const allowedOrigins = [
  "http://localhost:5173", 
  "https://connectify-seven-rust.vercel.app",
  "https://connectify-frontend-b6wv.onrender.com",
];

app.use(cors({ 
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie"]
}));

// Handle preflight requests
app.options("*", cors());

// Body parsing
app.use(express.json({ limit: "5mb" })); // Limit JSON payload size
app.use(cookieParser());

import pinoHttp from "pino-http";
import logger from "./lib/logger.js";
import mongoose from "mongoose";

// Validate required environment variables before starting
const requiredEnvVars = ["MONGO_URI", "JWT_SECRET_KEY", "GEMINI_API_KEY"];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    logger.fatal(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// HTTP Request Logging
app.use(pinoHttp({ logger }));

// Apply general rate limiting to all API routes
app.use("/api", apiLimiter);

// Health Check Endpoint (For Docker / Load Balancers)
app.get("/api/health", (req, res) => {
  const dbState = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    database: dbState,
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/channels", channelRoutes);
app.use("/api/ai", aiRoutes);

// Deployment Logic
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
  });
}

// Global Error Handler — must be registered AFTER all routes
app.use(errorHandler);

const httpServer = server.listen(PORT, async () => {
  logger.info(`Server is running on port ${PORT}`);
  await connectDB();
});

// Graceful Shutdown Handler
const shutdown = () => {
  logger.info("SIGTERM/SIGINT received. Shutting down gracefully...");
  httpServer.close(() => {
    logger.info("HTTP server closed.");
    mongoose.connection.close(false, () => {
      logger.info("MongoDB connection closed.");
      process.exit(0);
    });
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);