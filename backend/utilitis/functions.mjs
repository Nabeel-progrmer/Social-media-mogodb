import nodemailer from "nodemailer";

let transporter;
const DEFAULT_SENDER = "reemareemakhan869@gmail.com";

const getTransporter = () => {
  const user =
    process.env.NODEMAILER_EMAIL || process.env.EMAIL_USER || DEFAULT_SENDER;
  // Keep compatibility with the spelling already used by this project's .env.
  const pass =
    process.env.NODEMAILER_PASSWARD ||
    process.env.NODEMAILER_PASSWORD ||
    process.env.EMAIL_PASSWORD;
  if (!user || !pass) {
    throw new Error(
      "Email is not configured: set NODEMAILER_PASSWARD (or NODEMAILER_PASSWORD) to the Gmail app password.",
    );
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
  }
  return { transporter, user };
};

export const sendEmail = async (email, subject, text, html) => {
  const { transporter: mailer, user } = getTransporter();
  try {
    const result = await mailer.sendMail({
      from: user,
      to: email,
      subject,
      text,
      ...(html ? { html } : {}),
    });
    if (!result.accepted?.length) {
      throw new Error("Email provider did not accept the recipient address");
    }
    return result;
  } catch (error) {
    console.error(`Email delivery failed (${error.code || error.name || "SMTP error"}): ${error.message}`);
    throw error;
  }
};
