import User from "../models/User.js";
import Message from "../models/Message.js"; // You will need a Message model
import { getReceiverSocketId, io } from "../lib/socket.js";
import multer from "multer";
import path from "path";

// Configure multer for image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });
// 1. Get List of Users for Sidebar
export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    // Find all users except the current logged-in user
    const filteredUsers = await User.find({ _id: { $ne: loggedInUserId } }).select("-password");
    res.status(200).json(filteredUsers);
  } catch (error) {
    console.error("Error in getUsersForSidebar:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 2. Get Message History between two users
export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    }).sort({ createdAt: 1 }); // Sort by time

    res.status(200).json(messages);
  } catch (error) {
    console.error("Error in getMessages:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 3. Send Message and Emit via Socket.io
export const sendMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image, // Logic for Cloudinary or S3 can be added here
    });

    await newMessage.save();

    // REAL-TIME LOGIC: Send to receiver if they are online
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Error in sendMessage:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 4. Add Reaction to Message
export const addReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ error: "Message not found" });

    // Check if user already reacted
    const existingReaction = message.reactions.find(r => r.userId.toString() === userId.toString());
    if (existingReaction) {
      existingReaction.emoji = emoji; // Update
    } else {
      message.reactions.push({ userId, emoji });
    }

    await message.save();

    // Emit to both users
    const receiverSocketId = getReceiverSocketId(message.receiverId);
    const senderSocketId = getReceiverSocketId(message.senderId);
    if (receiverSocketId) io.to(receiverSocketId).emit("messageReaction", { messageId, reactions: message.reactions });
    if (senderSocketId) io.to(senderSocketId).emit("messageReaction", { messageId, reactions: message.reactions });

    res.status(200).json(message.reactions);
  } catch (error) {
    console.error("Error in addReaction:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 5. Upload Image
export const uploadImage = (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const imageUrl = `/uploads/${req.file.filename}`;
  res.status(200).json({ imageUrl });
};

export { upload };