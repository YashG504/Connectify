import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  createChannel,
  getChannels,
  joinChannel,
  inviteToChannel,
  getChannelMessages,
  sendChannelMessage,
} from "../controllers/channel.controller.js";

const router = express.Router();

router.post("/", protectRoute, createChannel);
router.get("/", protectRoute, getChannels);
router.post("/:id/join", protectRoute, joinChannel);
router.post("/:id/invite", protectRoute, inviteToChannel);
router.get("/:id/messages", protectRoute, getChannelMessages);
router.post("/:id/messages", protectRoute, sendChannelMessage);

export default router;
