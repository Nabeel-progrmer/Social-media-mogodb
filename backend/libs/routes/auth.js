import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import otpGenerator from "otp-generator";
import { UserModel } from "../models/users/index.mjs";
import { emailPattern, passwardPattern } from "../../utilitis/core.mjs";
import { emailOtpModel } from "../models/email-otp.mjs";
import { passwordResetModel } from "../models/password-reset.mjs";
import { sendEmail } from "../../utilitis/functions.mjs";

const authRoutes = express.Router();
const OTP_LIFETIME_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const PASSWORD_RESET_ATTEMPT_LIMIT = 5;
const normalizeEmail = (email) => email.trim().toLowerCase();

const issueOtp = async (email) => {
  const lastOtp = await emailOtpModel.findOne({ email }).sort({ createdAt: -1 });
  if (lastOtp && Date.now() - lastOtp.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    const retryAfter = Math.ceil(
      (RESEND_COOLDOWN_MS - (Date.now() - lastOtp.createdAt.getTime())) / 1000,
    );
    const error = new Error(`Please wait ${retryAfter} seconds before requesting another code`);
    error.status = 429;
    error.retryAfter = retryAfter;
    throw error;
  }

  const otp = otpGenerator.generate(6, {
    upperCaseAlphabets: false,
    lowerCaseAlphabets: false,
    specialChars: false,
  });
  const otpCodeHash = await bcrypt.hash(otp, 12);
  const expiresAt = new Date(Date.now() + OTP_LIFETIME_MS);
  await emailOtpModel.deleteMany({ email });
  await emailOtpModel.create({ email, otpCodeHash, expiresAt });
  try {
    await sendEmail(
      email,
      "Verify your email",
      `Your verification code is ${otp}. It expires in 10 minutes.`,
      `<p>Your verification code is <strong>${otp}</strong>.</p><p>It expires in 10 minutes.</p>`,
    );
  } catch (error) {
    await emailOtpModel.deleteOne({ email, otpCodeHash });
    throw error;
  }
};

authRoutes.post("/signup", async (req, res) => {
  try {
    const { firstname, lastname, email, passward } = req.body || {};
    if (![firstname, lastname, email, passward].every((value) => typeof value === "string" && value.trim())) {
      return res.status(400).send({ message: "firstname, lastname, email and passward are required" });
    }
    if (!emailPattern.test(email.trim().toLowerCase())) {
      return res.status(400).send({ message: "email is invalid" });
    }
    if (!passwardPattern.test(passward)) {
      return res.status(400).send({ message: "passward must be strong" });
    }

    const normalizedEmail = normalizeEmail(email);
    const existingUser = await UserModel.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).send({ message: "email is already taken" });
    }

    const passwardHash = await bcrypt.hash(passward, 12);
    await UserModel.create({
      firstname: firstname.trim(),
      lastname: lastname.trim(),
      email: normalizedEmail,
      passward: passwardHash,
    });
    const verifyUrl = `${req.protocol}://${req.get("host")}/verify-email?email=${encodeURIComponent(normalizedEmail)}`;
    try {
      await issueOtp(normalizedEmail);
    } catch (error) {
      console.error(error);
      return res.status(error.status || 503).send({
        message: error.status ? error.message : "Account created, but the verification email could not be sent. Try resending the code.",
        verificationRequired: true,
        verifyUrl,
        email: normalizedEmail,
        ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}),
      });
    }

    return res.status(201).send({
      message: "account created; verify your email to sign in",
      verificationRequired: true,
      verifyUrl,
      email: normalizedEmail,
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).send({ message: "email is already taken" });
    console.error(error);
    return res.status(error.status || 500).send({
      message: error.status ? error.message : "could not create account or send verification email",
    });
  }
});

authRoutes.post("/login", async (req, res) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    const passward = req.body?.passward;
    if (!email || !passward) return res.status(400).send({ message: "email and passward are required" });
    if (!emailPattern.test(email.toLowerCase())) {
      return res.status(400).send({ message: "email or passward is incorrect" });
    }

    const userAccount = await UserModel.findOne({ email: normalizeEmail(email) });
    if (!userAccount || !(await bcrypt.compare(passward, userAccount.passward))) {
      return res.status(401).send({ message: "email or passward is incorrect" });
    }
    if (!userAccount.isEmailVerified) {
      return res.status(403).send({
        message: "please verify your email before signing in",
        verificationRequired: true,
        verifyUrl: `/verify-email?email=${encodeURIComponent(userAccount.email)}`,
        email: userAccount.email,
      });
    }

    const token = jwt.sign(
      { email: userAccount.email, _id: userAccount._id },
      process.env.JWT_KEY,
      { expiresIn: "1d" },
    );
    return res.send({
      message: "login done",
      data: token,
      user: {
        _id: userAccount._id,
        firstname: userAccount.firstname,
        lastname: userAccount.lastname,
        email: userAccount.email,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: "internal server error" });
  }
});

authRoutes.post("/forgot-password", async (req, res) => {
  const genericMessage =
    "If an account with that email exists, a reset code has been sent.";
  try {
    const email =
      typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
    if (!emailPattern.test(email)) {
      return res.status(400).send({ message: "email is invalid" });
    }

    const user = await UserModel.findOne({ email }).select("_id");
    if (user) {
      const recentCode = await passwordResetModel
        .findOne({ email })
        .sort({ createdAt: -1 });
      const canResend =
        !recentCode ||
        Date.now() - recentCode.createdAt.getTime() >= RESEND_COOLDOWN_MS;

      if (canResend) {
        const otp = otpGenerator.generate(6, {
          upperCaseAlphabets: false,
          lowerCaseAlphabets: false,
          specialChars: false,
        });
        const otpCodeHash = await bcrypt.hash(otp, 12);
        await passwordResetModel.deleteMany({ email });
        await passwordResetModel.create({
          email,
          otpCodeHash,
          expiresAt: new Date(Date.now() + OTP_LIFETIME_MS),
        });
        try {
          await sendEmail(
            email,
            "Reset your Circle password",
            `Your password reset code is ${otp}. It expires in 10 minutes.`,
            `<p>Your password reset code is <strong>${otp}</strong>.</p><p>It expires in 10 minutes.</p>`,
          );
        } catch (error) {
          await passwordResetModel.deleteOne({ email, otpCodeHash });
          console.error(error);
        }
      }
    }

    return res.send({ message: genericMessage });
  } catch (error) {
    console.error(error);
    return res.status(503).send({ message: "could not process password reset request" });
  }
});

authRoutes.post("/reset-password", async (req, res) => {
  try {
    const email =
      typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
    const otp = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";
    const passward =
      typeof req.body?.passward === "string" ? req.body.passward : "";

    if (!emailPattern.test(email)) {
      return res.status(400).send({ message: "email is invalid" });
    }
    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).send({ message: "enter the 6-digit reset code" });
    }
    if (!passwardPattern.test(passward)) {
      return res.status(400).send({ message: "passward must be strong" });
    }

    const resetRecord = await passwordResetModel.findOne({
      email,
      expiresAt: { $gt: new Date() },
      attempts: { $lt: PASSWORD_RESET_ATTEMPT_LIMIT },
    }).sort({ createdAt: -1 });
    if (!resetRecord || !(await bcrypt.compare(otp, resetRecord.otpCodeHash))) {
      if (resetRecord) {
        await passwordResetModel.updateOne(
          {
            _id: resetRecord._id,
            attempts: { $lt: PASSWORD_RESET_ATTEMPT_LIMIT },
          },
          { $inc: { attempts: 1 } },
        );
      }
      return res.status(400).send({ message: "reset code is invalid or expired" });
    }

    const consumedRecord = await passwordResetModel.findOneAndDelete({
      _id: resetRecord._id,
      otpCodeHash: resetRecord.otpCodeHash,
      expiresAt: { $gt: new Date() },
      attempts: { $lt: PASSWORD_RESET_ATTEMPT_LIMIT },
    });
    if (!consumedRecord) {
      return res.status(400).send({ message: "reset code is invalid or expired" });
    }

    const passwardHash = await bcrypt.hash(passward, 12);
    const user = await UserModel.findOneAndUpdate(
      { email },
      { $set: { passward: passwardHash } },
      { new: true },
    ).select("_id");
    if (!user) {
      return res.status(400).send({ message: "reset code is invalid or expired" });
    }

    await passwordResetModel.deleteMany({ email });
    return res.send({ message: "password reset successfully; you can now log in" });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: "could not reset password" });
  }
});

authRoutes.post("/send-otp", async (req, res) => {
  try {
    const email = typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
    if (!emailPattern.test(email)) return res.status(400).send({ message: "email is invalid" });
    const user = await UserModel.findOne({ email });
    if (!user) return res.status(404).send({ message: "account not found" });
    if (user.isEmailVerified) return res.status(409).send({ message: "email is already verified" });
    await issueOtp(email);
    return res.send({ message: "verification code sent" });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).send({
      message: error.status ? error.message : "could not send verification code",
      ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}),
    });
  }
});

authRoutes.post("/verify-email", async (req, res) => {
  try {
    const email = typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
    const otp = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";
    if (!emailPattern.test(email)) return res.status(400).send({ message: "email is invalid" });
    if (!/^\d{6}$/.test(otp)) return res.status(400).send({ message: "enter the 6-digit verification code" });

    const user = await UserModel.findOne({ email });
    if (!user) return res.status(404).send({ message: "account not found" });
    if (user.isEmailVerified) return res.send({ message: "email is already verified" });

    const record = await emailOtpModel.findOne({ email, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 });
    if (!record || !(await bcrypt.compare(otp, record.otpCodeHash))) {
      return res.status(400).send({ message: "verification code is invalid or expired" });
    }

    user.isEmailVerified = true;
    await user.save();
    await emailOtpModel.deleteMany({ email });
    return res.send({ message: "email verified; you can now sign in" });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: "could not verify email" });
  }
});

export default authRoutes;
