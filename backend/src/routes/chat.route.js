import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  getMessages, sendMessage, getUsersForSidebar, addReaction,
  uploadImageHandler, upload, uploadFile, uploadFileHandler,
  markMessagesAsRead, deleteMessage,
  pinMessage, getPinnedMessages,
  getThreadReplies, searchMessages,
  getFriendsWithLastMessage, sendFileMessage,
} from "../controllers/chat.controller.js";
import { messageValidation } from "../middleware/validate.js";

const router = express.Router();

// Apply protection to all chat routes
router.use(protectRoute);

router.get("/users", getUsersForSidebar);
router.get("/search", searchMessages);
router.get("/friends-dm", getFriendsWithLastMessage);
router.get("/pinned/:id", getPinnedMessages);
router.get("/thread/:messageId", getThreadReplies);
router.get("/:id", getMessages);
router.post("/send/:id", messageValidation, sendMessage);
router.post("/send-file/:id", sendFileMessage);
router.post("/reaction/:messageId", addReaction);
router.post("/upload", upload.single("image"), uploadImageHandler);
router.post("/upload-file", uploadFile.single("file"), uploadFileHandler);
router.put("/read/:id", markMessagesAsRead);
router.put("/pin/:messageId", pinMessage);
router.delete("/message/:messageId", deleteMessage);

export default router;