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
      required: false, // Now optional because of channelId
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

// Compound index for faster chat history queries (getMessages uses $or on these)
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: 1 });
messageSchema.index({ receiverId: 1, senderId: 1, createdAt: 1 });
messageSchema.index({ channelId: 1, createdAt: 1 }); // Index for fast channel message retrieval

const Message = mongoose.model("Message", messageSchema);

export default Message;