import express from "express";
import { translateMessage, summarizeChat, summarizeChannel } from "../controllers/ai.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/translate", protectRoute, translateMessage);
router.get("/summarize/:id", protectRoute, summarizeChat);
router.get("/summarize-channel/:id", protectRoute, summarizeChannel);

export default router;
