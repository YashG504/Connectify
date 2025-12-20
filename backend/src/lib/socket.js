import { Server } from "socket.io";
import http from "http";
import express from "express";

const app = express();
const server = http.createServer(app);

// Explicitly define your frontend URL for production and development
const allowedOrigins = [
  "http://localhost:5173", 
  "https://connectify-seven-rust.vercel.app"
];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins, // Set specific origins instead of 'true'
    credentials: true,
    methods: ["GET", "POST"]
  },
});

const userSocketMap = {}; 

export const getReceiverSocketId = (userId) => userSocketMap[userId];

io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;
  if (userId && userId !== "undefined") {
    userSocketMap[userId] = socket.id;
    io.emit("user-online", userId);
  }

  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  socket.on("call-user", ({ to, offer, fromName }) => {
    const receiverSocketId = getReceiverSocketId(to);
    if (receiverSocketId) io.to(receiverSocketId).emit("incoming-call", { from: userId, offer, fromName });
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

  socket.on("disconnect", () => {
    if (userId) {
      delete userSocketMap[userId];
      io.emit("user-offline", userId);
    }
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });

  socket.on("typing", ({ to, typing }) => {
    const receiverSocketId = getReceiverSocketId(to);
    if (receiverSocketId) io.to(receiverSocketId).emit("typing", { from: userId, typing });
  });
});

export { app, io, server };