import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getMessages, sendMessage, getUsersForSidebar, addReaction, uploadImage, upload } from "../controllers/chat.controller.js";

const router = express.Router();

// Apply protection to all chat routes
router.use(protectRoute);

router.get("/users", getUsersForSidebar);
router.get("/:id", getMessages);
router.post("/send/:id", sendMessage);
router.post("/reaction/:messageId", addReaction);
router.post("/upload", upload.single("image"), uploadImage);

export default router;