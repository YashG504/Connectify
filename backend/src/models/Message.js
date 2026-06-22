import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    channelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel",
      required: false,
    },
    text: {
      type: String,
      maxlength: 5000,
    },
    image: {
      type: String,
    },
    // File sharing (non-image): PDFs, docs, etc.
    file: {
      url: { type: String },
      name: { type: String },
      size: { type: Number },
      type: { type: String }, // MIME type
    },
    reactions: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        emoji: { type: String },
      },
    ],
    readAt: {
      type: Date,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    // Thread / Reply support
    parentMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    threadCount: {
      type: Number,
      default: 0,
    },
    // Message pinning
    isPinned: {
      type: Boolean,
      default: false,
    },
    pinnedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    pinnedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Validate that a message is either a DM (receiverId) or a Channel Message (channelId)
messageSchema.pre("validate", function(next) {
  if (!this.receiverId && !this.channelId) {
    next(new Error("A message must have either a receiverId or a channelId."));
  } else if (this.receiverId && this.channelId) {
    next(new Error("A message cannot have both a receiverId and a channelId."));
  } else {
    next();
  }
});

// Compound index for faster chat history queries
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: 1 });
messageSchema.index({ receiverId: 1, senderId: 1, createdAt: 1 });
messageSchema.index({ channelId: 1, createdAt: 1 });
// Index for thread queries
messageSchema.index({ parentMessageId: 1, createdAt: 1 });
// Index for text search
messageSchema.index({ text: "text" });

const Message = mongoose.model("Message", messageSchema);

export default Message;