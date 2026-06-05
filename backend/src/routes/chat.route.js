import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getMessages, sendMessage, getUsersForSidebar, addReaction, uploadImage, upload, markMessagesAsRead, deleteMessage } from "../controllers/chat.controller.js";
import { messageValidation } from "../middleware/validate.js";

const router = express.Router();

// Apply protection to all chat routes
router.use(protectRoute);

router.get("/users", getUsersForSidebar);
router.get("/:id", getMessages);
router.post("/send/:id", messageValidation, sendMessage);
router.post("/reaction/:messageId", addReaction);
router.post("/upload", upload.single("image"), uploadImage);
router.put("/read/:id", markMessagesAsRead);
router.delete("/message/:messageId", deleteMessage);

export default router;