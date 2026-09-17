import mongoose from "mongoose"
import { emailPattern } from "../../../utilitis/core.mjs"

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
    profilePicture: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { timestamps: true }
)

export const UserModel = mongoose.models.User || mongoose.model("User", userSchema)