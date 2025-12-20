import express from "express";
import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";

import authRoutes from "./routes/auth.route.js";
import userRoutes from "./routes/user.route.js";
import chatRoutes from "./routes/chat.route.js";

import { connectDB } from "./lib/db.js";
// We import the instances from socket.js to share the same CORS/Server setup
import { app, server } from "./lib/socket.js"; 

const PORT = process.env.PORT || 5001;
const __dirname = path.resolve();

// API CORS logic (must match socket logic)
app.use(cors({ 
  origin: (origin, callback) => {
    if (!origin || 
        origin === "http://localhost:5173" || 
        origin.endsWith(".vercel.app") || 
        origin.includes("yashs-projects")) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie"]
}));

// This specifically fixes the "Preflight request" 404/CORS error
app.options("*", cors());

app.use(express.json());
app.use(cookieParser());

app.use("/uploads", express.static("uploads"));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
  });
}

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  connectDB();
});