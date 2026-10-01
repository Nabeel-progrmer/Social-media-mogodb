import mongoose from "mongoose";

const emailOtpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    otpCodeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true },
);

emailOtpSchema.index({ email: 1, createdAt: -1 });

export const emailOtpModel =
  mongoose.models.EmailOtp || mongoose.model("EmailOtp", emailOtpSchema);
