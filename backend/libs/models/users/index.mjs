import mongoose from "mongoose";
import { emailPattern } from "../../../utilitis/core.mjs";

const userSchema = new mongoose.Schema(
  {
    firstname: {
      type: String,
      required: true,
      trim: true,
    },
    lastname: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      match: emailPattern,
    },
    passward: {
      type: String,
      required: true,
      trim: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    accountPrivacy: {
      type: String,
      enum: ["public", "private"],
      default: "public",
    },
    profilePicture: {
      type: String,
      trim: true,
      default: null,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 160,
      default: "",
    },
    following: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    notifications: {
      type: [
        {
          type: {
            type: String,
            enum: ["follow", "unfollow", "like", "comment", "post_views"],
            required: true,
          },
          actor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
          },
          post: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Post",
            default: null,
          },
          count: { type: Number, default: null },
          text: { type: String, trim: true, maxlength: 180, default: null },
          createdAt: { type: Date, default: Date.now },
          readAt: { type: Date, default: null },
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

userSchema.index({ following: 1 });

export const UserModel =
  mongoose.models.User || mongoose.model("User", userSchema);
