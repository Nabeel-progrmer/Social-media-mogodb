import { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckCircleFilled,
  KeyOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { Button, Input } from "antd";
import { baseUrl } from "../core";
import "../App.css";

const passwordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const recoverySteps = ["Email", "Verify", "Finish"];

const ForgotPassword = () => {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [passward, setPassward] = useState("");
  const [repeatPassward, setRepeatPassward] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const requestCode = async (event) => {
    event?.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      const response = await axios.post(`${baseUrl}/api/v1/forgot-password`, {
        email: email.trim(),
      });
      setOtp("");
      setNotice(response.data.message);
      setStep("reset");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Could not request a reset code. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    setError("");
    if (!passwordPattern.test(passward)) {
      setError(
        "Use at least 8 characters with uppercase, lowercase, a number, and one of @ $ ! % * ? &.",
      );
      return;
    }
    if (passward !== repeatPassward) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await axios.post(`${baseUrl}/api/v1/reset-password`, {
        email: email.trim(),
        otp,
        passward,
      });
      setNotice(response.data.message);
      setStep("done");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Could not reset your password. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepIndex = step === "done" ? 2 : step === "reset" ? 1 : 0;

  return (
    <main className="auth-page recovery-page">
      <aside className="auth-visual recovery-visual">
        <span className="visual-stamp">C / 02 <i>SECURE RECOVERY</i></span>
        <div className="recovery-visual-main">
          <span className="recovery-visual-icon">
            <SafetyCertificateOutlined />
          </span>
          <p className="visual-quote">Back to your corner.</p>
          <p className="recovery-visual-copy">
            A private reset code, a fresh password, and you are right back in.
          </p>
          <div className="recovery-facts">
            <div><strong>10 min</strong><span>code lifetime</span></div>
            <div><strong>5 tries</strong><span>attempt limit</span></div>
          </div>
        </div>
        <span className="recovery-visual-footer">Circle / Account security</span>
      </aside>
      <section className="auth-form login-form recovery-form-card">
        <div className="recovery-heading">
          <span className="recovery-heading-icon">
            {step === "done" ? <CheckCircleFilled /> : <KeyOutlined />}
          </span>
          <div>
            <p className="auth-kicker">ACCOUNT RECOVERY</p>
            <h2 id="recovery-title">
              {step === "done"
                ? "You're back in control."
                : step === "reset"
                  ? "Choose a new password."
                  : "Forgot your password?"}
            </h2>
          </div>
        </div>
        <p className="auth-subtitle">
          {step === "done"
            ? "Your password has been updated. Sign in with the new one."
            : step === "reset"
              ? "Enter the six-digit code sent to your email."
              : "Enter your account email and we'll send a reset code if it matches an account."}
        </p>

        <div className="recovery-progress" aria-label="Password reset progress">
          <div className="recovery-progress-track" aria-hidden="true">
            <span style={{ width: `${stepIndex * 50}%` }} />
          </div>
          {recoverySteps.map((label, index) => (
            <div
              className={
                "recovery-progress-step" +
                (index === stepIndex ? " is-active" : "") +
                (index < stepIndex ? " is-complete" : "")
              }
              key={label}
              aria-current={index === stepIndex ? "step" : undefined}
            >
              <span>{index < stepIndex ? <CheckCircleFilled /> : `0${index + 1}`}</span>
              <small>{label}</small>
            </div>
          ))}
        </div>

        {notice && step !== "done" && (
          <p className="recovery-message is-success" role="status">{notice}</p>
        )}
        {error && <p className="recovery-message is-error" role="alert">{error}</p>}

        {step === "done" ? (
          <div className="recovery-success" key="done">
            <span className="recovery-success-mark"><CheckCircleFilled /></span>
            <strong>Password updated</strong>
            <span>{notice}</span>
            <Link className="recovery-primary-link" to="/login">
              Back to log in <ArrowRightOutlined />
            </Link>
          </div>
        ) : step === "email" ? (
          <form className="forgot-password-form recovery-panel" onSubmit={requestCode} key="email">
            <Input
              className="recovery-input"
              type="email"
              autoComplete="email"
              prefix={<MailOutlined />}
              placeholder="Email address"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <Button
              className="recovery-submit"
              type="primary"
              htmlType="submit"
              loading={isSubmitting}
              icon={<ArrowRightOutlined />}
            >
              Send reset code
            </Button>
          </form>
        ) : (
          <form className="forgot-password-form recovery-panel" onSubmit={resetPassword} key="reset">
            <Input
              className="recovery-input"
              type="email"
              autoComplete="email"
              aria-label="Account email"
              prefix={<MailOutlined />}
              value={email}
              disabled
              required
            />
            <Input
              className="recovery-input recovery-code-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-label="Six-digit reset code"
              prefix={<KeyOutlined />}
              placeholder="Enter 6-digit code"
              value={otp}
              maxLength={6}
              onChange={(event) =>
                setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              required
            />
            <Input.Password
              className="recovery-input"
              autoComplete="new-password"
              prefix={<KeyOutlined />}
              placeholder="New password"
              value={passward}
              onChange={(event) => setPassward(event.target.value)}
              required
            />
            <Input.Password
              className="recovery-input"
              autoComplete="new-password"
              prefix={<KeyOutlined />}
              placeholder="Confirm new password"
              value={repeatPassward}
              onChange={(event) => setRepeatPassward(event.target.value)}
              required
            />
            <Button
              className="recovery-submit"
              type="primary"
              htmlType="submit"
              loading={isSubmitting}
              disabled={otp.length !== 6}
              icon={<SafetyCertificateOutlined />}
            >
              Reset password
            </Button>
            <Button
              className="recovery-resend"
              type="link"
              htmlType="button"
              loading={isSubmitting}
              icon={<MailOutlined />}
              onClick={requestCode}
            >
              Request another code
            </Button>
          </form>
        )}

        {step !== "done" && (
          <Link className="recovery-back-link" to="/login">
            <ArrowLeftOutlined /> Back to log in
          </Link>
        )}
      </section>
    </main>
  );
};

export default ForgotPassword;