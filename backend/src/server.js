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

// Unified CORS to prevent handshake errors
app.use(cors({ 
  origin: "http://localhost:5173", 
  credentials: true 
}));

app.use(express.json());
app.use(cookieParser());

// Serve uploaded files
app.use("/uploads", express.static("uploads"));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);

// Static assets for production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
  });
}

// Use server.listen for WebSockets to work
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  connectDB();
});