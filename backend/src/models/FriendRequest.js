import mongoose from "mongoose";

const friendRequestSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast lookups
friendRequestSchema.index({ sender: 1, recipient: 1 }, { unique: true }); // Prevent duplicate requests
friendRequestSchema.index({ recipient: 1, status: 1 }); // Fast incoming request queries

const FriendRequest = mongoose.model("FriendRequest", friendRequestSchema);

export default FriendRequest;
