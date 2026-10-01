import mongoose from "mongoose";

const passwordResetSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    otpCodeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true },
);

passwordResetSchema.index({ email: 1, createdAt: -1 });

export const passwordResetModel =
  mongoose.models.PasswordReset ||
  mongoose.model("PasswordReset", passwordResetSchema);