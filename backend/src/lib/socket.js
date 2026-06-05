import { Server } from "socket.io";
import http from "http";
import express from "express";
import Channel from "../models/Channel.js";

const app = express();
const server = http.createServer(app);

// Explicitly define allowed origins for WebSocket connections
const allowedOrigins = [
  "http://localhost:5173", 
  "https://connectify-seven-rust.vercel.app",
  "https://connectify-frontend-b6wv.onrender.com",
];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"]
  },
  // Connection reliability settings
  pingTimeout: 60000,      // How long to wait for a pong response
  pingInterval: 25000,     // How often to send a ping
  transports: ["websocket", "polling"], // Prefer WebSocket, fallback to polling
});

// In-memory socket map (Since we are dropping Redis to save disk space)
const userSocketMap = {};

export const getReceiverSocketId = (userId) => {
  return userSocketMap[userId];
};

io.on("connection", async (socket) => {
  const userId = socket.handshake.query.userId;
  
  if (userId && userId !== "undefined") {
    userSocketMap[userId] = socket.id;
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
    console.log(`User connected: ${userId} (socket: ${socket.id})`);

    // --- PHASE 3: Subscribe to all channels the user is a member of ---
    try {
      const userChannels = await Channel.find({ members: userId });
      userChannels.forEach(channel => {
        socket.join(channel._id.toString());
      });
      console.log(`User ${userId} joined ${userChannels.length} channel rooms.`);
    } catch (err) {
      console.error("Error joining channel rooms:", err);
    }
  }

  // --- VIDEO CALL SIGNALING ---
  socket.on("call-user", ({ to, offer, fromName }) => {
    const receiverSocketId = getReceiverSocketId(to);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("incoming-call", { from: userId, offer, fromName });
    } else {
      socket.emit("call-rejected", { reason: "User is offline" });
    }
  });

  socket.on("answer-call", ({ to, answer }) => {
    const callerSocketId = getReceiverSocketId(to);
    if (callerSocketId) io.to(callerSocketId).emit("call-accepted", { answer });
  });

  socket.on("ice-candidate", ({ to, candidate }) => {
    const targetSocketId = getReceiverSocketId(to);
    if (targetSocketId) io.to(targetSocketId).emit("ice-candidate", { candidate });
  });

  socket.on("reject-call", ({ to }) => {
    const callerSocketId = getReceiverSocketId(to);
    if (callerSocketId) io.to(callerSocketId).emit("call-rejected");
  });

  socket.on("end-call", ({ to }) => {
    const targetSocketId = getReceiverSocketId(to);
    if (targetSocketId) io.to(targetSocketId).emit("call-ended");
  });

  // --- CHAT FEATURES ---
  socket.on("typing", ({ to, typing }) => {
    const receiverSocketId = getReceiverSocketId(to);
    if (receiverSocketId) io.to(receiverSocketId).emit("typing", { from: userId, typing });
  });

  // --- DISCONNECT ---
  socket.on("disconnect", (reason) => {
    if (userId) {
      delete userSocketMap[userId];
      console.log(`User disconnected: ${userId} (reason: ${reason})`);
    }
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { app, io, server };