import User from "../models/User.js";
import Message from "../models/Message.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import cloudinary from "../lib/cloudinary.js";
import multer from "multer";

// Configure multer to use memory storage
const storage = multer.memoryStorage();

// File filter: allow images and common document types
const imageFilter = (req, file, cb) => {
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files (JPEG, PNG, GIF, WEBP) are allowed"), false);
  }
};

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "text/csv",
    "application/zip",
    "application/x-rar-compressed",
  ];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Unsupported file type"), false);
  }
};

const upload = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const uploadFile = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB for files
});

// 1. Get List of Users for Sidebar
export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
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
      parentMessageId: null, // Only top-level messages, not thread replies
    }).sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (error) {
    console.error("Error in getMessages:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 3. Send Message and Emit via Socket.io
export const sendMessage = async (req, res) => {
  try {
    const { text, image, parentMessageId } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    if (!text && !image) {
      return res.status(400).json({ error: "Message must contain text or an image" });
    }

    let imageUrl = null;
    if (image) {
      const uploadResult = await cloudinary.uploader.upload(image, {
        folder: "connectify/chat",
        transformation: [{ width: 800, quality: "auto" }],
      });
      imageUrl = uploadResult.secure_url;
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
      parentMessageId: parentMessageId || null,
    });

    await newMessage.save();

    // If this is a thread reply, increment the parent's threadCount
    if (parentMessageId) {
      await Message.findByIdAndUpdate(parentMessageId, { $inc: { threadCount: 1 } });
    }

    // REAL-TIME LOGIC
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

    if (!emoji) {
      return res.status(400).json({ error: "Emoji is required" });
    }

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ error: "Message not found" });

    const existingReaction = message.reactions.find(r => r.userId.toString() === userId.toString());
    if (existingReaction) {
      existingReaction.emoji = emoji;
    } else {
      message.reactions.push({ userId, emoji });
    }

    await message.save();

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

// 5. Upload Image to Cloudinary (via multer memory buffer)
export const uploadImageHandler = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const b64 = Buffer.from(req.file.buffer).toString("base64");
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;

    const uploadResult = await cloudinary.uploader.upload(dataURI, {
      folder: "connectify/chat",
      transformation: [{ width: 800, quality: "auto" }],
    });

    res.status(200).json({ imageUrl: uploadResult.secure_url });
  } catch (error) {
    console.error("Error in uploadImage:", error.message);
    res.status(500).json({ error: "Failed to upload image" });
  }
};

// 5b. Upload File (non-image) to Cloudinary
export const uploadFileHandler = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const b64 = Buffer.from(req.file.buffer).toString("base64");
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;

    const uploadResult = await cloudinary.uploader.upload(dataURI, {
      folder: "connectify/files",
      resource_type: "auto",
    });

    res.status(200).json({
      fileUrl: uploadResult.secure_url,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileType: req.file.mimetype,
    });
  } catch (error) {
    console.error("Error in uploadFile:", error.message);
    res.status(500).json({ error: "Failed to upload file" });
  }
};

// 6. Mark messages as read
export const markMessagesAsRead = async (req, res) => {
  try {
    const { id: senderId } = req.params;
    const receiverId = req.user._id;

    await Message.updateMany(
      { senderId, receiverId, readAt: null },
      { $set: { readAt: new Date() } }
    );

    const senderSocketId = getReceiverSocketId(senderId);
    if (senderSocketId) {
      io.to(senderSocketId).emit("messages-read", { readerId: receiverId });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error in markMessagesAsRead:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 7. Delete message
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ error: "Message not found" });

    if (message.senderId.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Unauthorized to delete this message" });
    }

    message.text = "This message was deleted";
    message.image = null;
    message.file = null;
    message.isDeleted = true;
    message.reactions = [];
    await message.save();

    const receiverSocketId = getReceiverSocketId(message.receiverId);
    const senderSocketId = getReceiverSocketId(message.senderId);
    
    if (receiverSocketId) io.to(receiverSocketId).emit("message-deleted", message);
    if (senderSocketId) io.to(senderSocketId).emit("message-deleted", message);

    res.status(200).json(message);
  } catch (error) {
    console.error("Error in deleteMessage:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 8. Pin / Unpin message
export const pinMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ error: "Message not found" });

    message.isPinned = !message.isPinned;
    message.pinnedBy = message.isPinned ? userId : null;
    message.pinnedAt = message.isPinned ? new Date() : null;
    await message.save();

    // Notify both users
    const receiverSocketId = getReceiverSocketId(message.receiverId);
    const senderSocketId = getReceiverSocketId(message.senderId);
    const pinEvent = { messageId, isPinned: message.isPinned, pinnedBy: userId };
    if (receiverSocketId) io.to(receiverSocketId).emit("message-pinned", pinEvent);
    if (senderSocketId) io.to(senderSocketId).emit("message-pinned", pinEvent);

    res.status(200).json(message);
  } catch (error) {
    console.error("Error in pinMessage:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 9. Get pinned messages for a conversation
export const getPinnedMessages = async (req, res) => {
  try {
    const { id: otherUserId } = req.params;
    const myId = req.user._id;

    const pinned = await Message.find({
      $or: [
        { senderId: myId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: myId },
      ],
      isPinned: true,
      isDeleted: false,
    }).sort({ pinnedAt: -1 });

    res.status(200).json(pinned);
  } catch (error) {
    console.error("Error in getPinnedMessages:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 10. Get thread replies for a parent message
export const getThreadReplies = async (req, res) => {
  try {
    const { messageId } = req.params;

    const replies = await Message.find({ parentMessageId: messageId })
      .populate("senderId", "fullName profilePic")
      .sort({ createdAt: 1 });

    res.status(200).json(replies);
  } catch (error) {
    console.error("Error in getThreadReplies:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 11. Global message search
export const searchMessages = async (req, res) => {
  try {
    const { q } = req.query;
    const myId = req.user._id;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: "Search query must be at least 2 characters" });
    }

    const messages = await Message.find({
      $or: [
        { senderId: myId },
        { receiverId: myId },
      ],
      text: { $regex: q, $options: "i" },
      isDeleted: false,
    })
      .populate("senderId", "fullName profilePic")
      .populate("receiverId", "fullName profilePic")
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json(messages);
  } catch (error) {
    console.error("Error in searchMessages:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 12. Get friends with last message (for sidebar DM preview)
export const getFriendsWithLastMessage = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("friends")
      .populate("friends", "fullName profilePic jobTitle preferredLanguage status customStatus lastSeen");

    const friendsWithLastMsg = await Promise.all(
      user.friends.map(async (friend) => {
        const lastMessage = await Message.findOne({
          $or: [
            { senderId: req.user._id, receiverId: friend._id },
            { senderId: friend._id, receiverId: req.user._id },
          ],
          parentMessageId: null,
        })
          .sort({ createdAt: -1 })
          .select("text image file createdAt senderId isDeleted")
          .lean();

        // Count unread
        const unreadCount = await Message.countDocuments({
          senderId: friend._id,
          receiverId: req.user._id,
          readAt: null,
          parentMessageId: null,
        });

        return {
          ...friend.toObject(),
          lastMessage: lastMessage || null,
          unreadCount,
        };
      })
    );

    // Sort by most recent message
    friendsWithLastMsg.sort((a, b) => {
      const aTime = a.lastMessage?.createdAt || 0;
      const bTime = b.lastMessage?.createdAt || 0;
      return new Date(bTime) - new Date(aTime);
    });

    res.status(200).json(friendsWithLastMsg);
  } catch (error) {
    console.error("Error in getFriendsWithLastMessage:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 13. Send message with file attachment
export const sendFileMessage = async (req, res) => {
  try {
    const { id: receiverId } = req.params;
    const senderId = req.user._id;
    const { text, fileUrl, fileName, fileSize, fileType } = req.body;

    const newMessage = new Message({
      senderId,
      receiverId,
      text: text || null,
      file: fileUrl ? { url: fileUrl, name: fileName, size: fileSize, type: fileType } : undefined,
    });

    await newMessage.save();

    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Error in sendFileMessage:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export { upload, uploadFile };