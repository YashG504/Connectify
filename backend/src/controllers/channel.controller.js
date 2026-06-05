import Channel from "../models/Channel.js";
import User from "../models/User.js";
import Message from "../models/Message.js";
import { io } from "../lib/socket.js";
import cloudinary from "../lib/cloudinary.js";

// @desc    Create a new channel
// @route   POST /api/channels
// @access  Private
export const createChannel = async (req, res, next) => {
  try {
    const { name, description, isPrivate } = req.body;
    const userId = req.user._id;

    if (!name) {
      return res.status(400).json({ message: "Channel name is required" });
    }

    // Check if channel already exists (case-insensitive)
    const existingChannel = await Channel.findOne({ name: name.toLowerCase() });
    if (existingChannel) {
      return res.status(400).json({ message: "A channel with this name already exists" });
    }

    const newChannel = new Channel({
      name,
      description,
      isPrivate: isPrivate || false,
      creatorId: userId,
      members: [userId], // Creator is the first member
      admins: [userId], // Creator is an admin
    });

    await newChannel.save();
    res.status(201).json(newChannel);
  } catch (error) {
    next(error);
  }
};

// @desc    Get all accessible channels (Public + Joined Private)
// @route   GET /api/channels
// @access  Private
export const getChannels = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Find channels that are either public, OR the user is a member
    const channels = await Channel.find({
      $or: [{ isPrivate: false }, { members: userId }],
    })
      .populate("creatorId", "fullName profilePic")
      .sort({ createdAt: -1 });

    res.status(200).json(channels);
  } catch (error) {
    next(error);
  }
};

// @desc    Join a public channel
// @route   POST /api/channels/:id/join
// @access  Private
export const joinChannel = async (req, res, next) => {
  try {
    const channelId = req.params.id;
    const userId = req.user._id;

    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    if (channel.isPrivate && !channel.members.includes(userId)) {
      return res.status(403).json({ message: "Cannot join a private channel without an invite" });
    }

    if (channel.members.includes(userId)) {
      return res.status(400).json({ message: "You are already a member of this channel" });
    }

    channel.members.push(userId);
    await channel.save();

    res.status(200).json({ message: "Successfully joined channel", channel });
  } catch (error) {
    next(error);
  }
};

// @desc    Invite a user to a channel
// @route   POST /api/channels/:id/invite
// @access  Private
export const inviteToChannel = async (req, res, next) => {
  try {
    const channelId = req.params.id;
    const inviterId = req.user._id;
    const { userId } = req.body;

    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    // Only admins can invite if the channel is private
    if (channel.isPrivate && !channel.admins.includes(inviterId)) {
      return res.status(403).json({ message: "Only channel admins can invite users to a private channel" });
    }

    if (channel.members.includes(userId)) {
      return res.status(400).json({ message: "User is already a member of this channel" });
    }

    channel.members.push(userId);
    await channel.save();

    // Optionally emit a socket event here to notify the invited user
    res.status(200).json({ message: "Successfully invited user to channel", channel });
  } catch (error) {
    next(error);
  }
};

// @desc    Get messages for a specific channel
// @route   GET /api/channels/:id/messages
// @access  Private
export const getChannelMessages = async (req, res, next) => {
  try {
    const channelId = req.params.id;
    const userId = req.user._id;

    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    // Verify membership
    if (!channel.members.includes(userId)) {
      return res.status(403).json({ message: "You must join this channel to view messages" });
    }

    const messages = await Message.find({ channelId })
      .populate("senderId", "fullName profilePic")
      .sort({ createdAt: 1 })
      .limit(100);

    res.status(200).json(messages);
  } catch (error) {
    next(error);
  }
};

// @desc    Send a message to a channel
// @route   POST /api/channels/:id/messages
// @access  Private
export const sendChannelMessage = async (req, res, next) => {
  try {
    const channelId = req.params.id;
    const senderId = req.user._id;
    const { text, image } = req.body;

    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    if (!channel.members.includes(senderId)) {
      return res.status(403).json({ message: "You must join this channel to send messages" });
    }
    
    let imageUrl;
    if (image) {
      // Upload base64 image to cloudinary
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    const newMessage = new Message({
      senderId,
      channelId,
      text,
      image: imageUrl,
    });

    await newMessage.save();

    // Populate sender info before emitting
    await newMessage.populate("senderId", "fullName profilePic");

    // Real-time broadcast to all users in the channel room
    io.to(channelId).emit("newChannelMessage", newMessage);
    
    res.status(201).json(newMessage);
  } catch (error) {
    next(error);
  }
};
