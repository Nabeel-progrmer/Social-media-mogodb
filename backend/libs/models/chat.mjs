import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [
        { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      ],
      required: true,
      validate: (participants) => participants.length >= 2,
    },
    isGroup: { type: Boolean, default: false },
    groupName: { type: String, trim: true, maxlength: 60, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    admins: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    directKey: { type: String, unique: true, sparse: true },
  },
  { timestamps: true },
);

conversationSchema.index({ participants: 1, updatedAt: -1 });

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: { type: String, trim: true, maxlength: 5000, default: "" },
    imageUrl: { type: String, trim: true, default: null },
    type: { type: String, enum: ["text", "image"], default: "text" },
    readBy: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
    reactions: {
      type: [
        {
          emoji: { type: String, required: true, maxlength: 8 },
          users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

messageSchema.index({ conversation: 1, createdAt: -1 });

export const ConversationModel =
  mongoose.models.Conversation ||
  mongoose.model("Conversation", conversationSchema);
export const MessageModel =
  mongoose.models.Message || mongoose.model("Message", messageSchema);
