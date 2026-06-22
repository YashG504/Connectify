import { GoogleGenAI } from "@google/genai";
import Message from "../models/Message.js";

// Lazy initialization to avoid crash if env var is set but SDK init fails
let ai;
try {
  ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
} catch (err) {
  console.error("Failed to initialize Gemini AI SDK:", err.message);
}

// Simple in-memory per-user rate limiter for AI endpoints
const rateLimitMap = new Map();
const AI_RATE_LIMIT = 20; // max calls per minute per user
const AI_RATE_WINDOW = 60 * 1000; // 1 minute

function checkRateLimit(userId) {
  const now = Date.now();
  const userKey = userId.toString();
  if (!rateLimitMap.has(userKey)) {
    rateLimitMap.set(userKey, []);
  }
  const timestamps = rateLimitMap.get(userKey).filter(t => now - t < AI_RATE_WINDOW);
  if (timestamps.length >= AI_RATE_LIMIT) {
    return false;
  }
  timestamps.push(now);
  rateLimitMap.set(userKey, timestamps);
  return true;
}

export const translateMessage = async (req, res) => {
  try {
    if (!ai) return res.status(503).json({ error: "AI service unavailable" });

    const { text, targetLanguage } = req.body;
    if (!text || !targetLanguage) {
      return res.status(400).json({ error: "Text and targetLanguage are required" });
    }

    // Input validation
    if (text.length > 2000) {
      return res.status(400).json({ error: "Text too long. Maximum 2000 characters." });
    }

    // Rate limit check
    if (!checkRateLimit(req.user._id)) {
      return res.status(429).json({ error: "Too many AI requests. Please wait a moment." });
    }

    const prompt = `Translate the following text to ${targetLanguage}. Provide ONLY the translated text, no other commentary.\n\nText: ${text}`;
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    res.status(200).json({ translatedText: response.text });
  } catch (error) {
    console.error("Error in translateMessage:", error);
    res.status(500).json({ error: "Failed to translate message" });
  }
};

export const summarizeChat = async (req, res) => {
  try {
    if (!ai) return res.status(503).json({ error: "AI service unavailable" });

    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    // Rate limit check
    if (!checkRateLimit(req.user._id)) {
      return res.status(429).json({ error: "Too many AI requests. Please wait a moment." });
    }

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
      isDeleted: { $ne: true }, // Filter out deleted messages
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("senderId", "fullName");

    if (!messages || messages.length === 0) {
      return res.status(200).json({ summary: "No messages to summarize." });
    }

    messages.sort((a, b) => a.createdAt - b.createdAt);

    let transcript = "";
    messages.forEach((msg) => {
      if (msg.text) {
        transcript += `${msg.senderId.fullName}: ${msg.text}\n`;
      }
    });

    if (!transcript.trim()) {
      return res.status(200).json({ summary: "No text messages to summarize (only images were shared)." });
    }

    const prompt = `Summarize the following chat conversation into a brief, bulleted list of key points and any action items. Keep it concise.\n\nConversation:\n${transcript}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    res.status(200).json({ summary: response.text });
  } catch (error) {
    console.error("Error in summarizeChat:", error);
    res.status(500).json({ error: "Failed to summarize chat" });
  }
};

// Channel summarization
export const summarizeChannel = async (req, res) => {
  try {
    if (!ai) return res.status(503).json({ error: "AI service unavailable" });

    const { id: channelId } = req.params;

    // Rate limit check
    if (!checkRateLimit(req.user._id)) {
      return res.status(429).json({ error: "Too many AI requests. Please wait a moment." });
    }

    const messages = await Message.find({
      channelId,
      isDeleted: { $ne: true },
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("senderId", "fullName");

    if (!messages || messages.length === 0) {
      return res.status(200).json({ summary: "No messages to summarize." });
    }

    messages.sort((a, b) => a.createdAt - b.createdAt);

    let transcript = "";
    messages.forEach((msg) => {
      if (msg.text) {
        transcript += `${msg.senderId.fullName}: ${msg.text}\n`;
      }
    });

    if (!transcript.trim()) {
      return res.status(200).json({ summary: "No text messages to summarize." });
    }

    const prompt = `Summarize the following group chat conversation into a brief, bulleted list of key points and any action items. Keep it concise.\n\nConversation:\n${transcript}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    res.status(200).json({ summary: response.text });
  } catch (error) {
    console.error("Error in summarizeChannel:", error);
    res.status(500).json({ error: "Failed to summarize channel" });
  }
};
