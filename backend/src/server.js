import express from "express";
import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";

import authRoutes from "./routes/auth.route.js";
import userRoutes from "./routes/user.route.js";
import chatRoutes from "./routes/chat.route.js";

import { connectDB } from "./lib/db.js";
import { app, server } from "./lib/socket.js"; 

const PORT = process.env.PORT || 5001;
const __dirname = path.resolve();

// Define allowed origins (Matches socket.js for consistency)
const allowedOrigins = [
  "http://localhost:5173",
  "https://connectify-seven-rust.vercel.app",
  /\.vercel\.app$/
];

// Unified CORS to prevent handshake and API errors
app.use(cors({ 
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.some(allowed => 
      allowed instanceof RegExp ? allowed.test(origin) : allowed === origin
    )) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie"]
}));

// Handle preflight OPTIONS requests
app.options("*", cors());

app.use(express.json());
app.use(cookieParser());

// Serve uploaded files
app.use("/uploads", express.static("uploads"));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);

// Static assets for production (optional if you deploy frontend on Vercel)
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
  });
}

// Start the server using the http server instance
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  connectDB();
});