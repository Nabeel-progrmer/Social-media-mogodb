import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { ArrowLeftOutlined, MailOutlined } from "@ant-design/icons";
import { baseUrl } from "../core";
import "./VerifyEmail.css";

const RESEND_WAIT_SECONDS = 60;

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const initialEmail = useMemo(
    () => searchParams.get("email") || "",
    [searchParams],
  );
  const [email, setEmail] = useState(initialEmail);
  const [otpDigits, setOtpDigits] = useState(Array(6).fill(""));
  const otp = otpDigits.join("");
  const [message, setMessage] = useState(
    location.state?.notice ||
      (location.state?.justSignedUp
        ? "Your account is ready. Enter the code we just sent you."
        : "Enter the code sent to your email address."),
  );
  const [messageType, setMessageType] = useState(
    location.state?.noticeType || (location.state?.justSignedUp ? "success" : "info"),
  );
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const otpRefs = useRef([]);
  const [resendSeconds, setResendSeconds] = useState(
    location.state?.retryAfter || (location.state?.justSignedUp ? RESEND_WAIT_SECONDS : 0),
  );

  useEffect(() => {
    if (!resendSeconds) return undefined;
    const timer = window.setTimeout(
      () => setResendSeconds((seconds) => Math.max(0, seconds - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  const showError = (error) => {
    const response = error.response;
    const retryAfter = response?.data?.retryAfter;
    if (Number.isFinite(retryAfter) && retryAfter > 0) {
      setResendSeconds(retryAfter);
    }
    setMessage(response?.data?.message || "Something went wrong. Please try again.");
    setMessageType("error");
  };

  const handleVerify = async (event) => {
    event.preventDefault();
    setMessage("");
    setIsVerifying(true);
    try {
      const response = await axios.post(`${baseUrl}/api/v1/verify-email`, {
        email: email.trim(),
        otp,
      });
      setMessage(response.data.message || "Your email has been verified.");
      setMessageType("success");
      setIsVerified(true);
      window.setTimeout(() => navigate("/login", { replace: true }), 1200);
    } catch (error) {
      showError(error);
    } finally {
      setIsVerifying(false);
    }
  };

  const updateOtpDigit = (index, rawValue) => {
    const digits = rawValue.replace(/\D/g, "");
    if (digits.length > 1) {
      const pasted = digits.slice(0, 6 - index);
      setOtpDigits((current) => {
        const next = [...current];
        pasted.split("").forEach((digit, offset) => {
          next[index + offset] = digit;
        });
        return next;
      });
      otpRefs.current[Math.min(index + pasted.length, 5)]?.focus();
      return;
    }

    setOtpDigits((current) => {
      const next = [...current];
      next[index] = digits;
      return next;
    });
    if (digits && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, event) => {
    if (event.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    } else if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      otpRefs.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < 5) {
      event.preventDefault();
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (event, index) => {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasted) return;
    event.preventDefault();
    updateOtpDigit(index, pasted);
  };

  const handleResend = async () => {
    setMessage("");
    setIsResending(true);
    try {
      const response = await axios.post(`${baseUrl}/api/v1/send-otp`, {
        email: email.trim(),
      });
      setMessage(response.data.message || "A new code has been sent.");
      setMessageType("success");
      setResendSeconds(RESEND_WAIT_SECONDS);
      setOtpDigits(Array(6).fill(""));
    } catch (error) {
      showError(error);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <main className="verify-page">
      <section className="verify-card" aria-labelledby="verify-title">
        <Link className="verify-back" to="/signup">
          <ArrowLeftOutlined /> <span>Back to sign up</span>
        </Link>
        <div className={`verify-icon ${isVerified ? "is-verified" : ""}`} aria-hidden="true">
          <MailOutlined />
        </div>
        <p className="verify-kicker">ONE QUICK STEP</p>
        <h1 id="verify-title">Check your inbox</h1>
        <p className="verify-copy">
          We sent a 6-digit verification code to your email. It expires in 10 minutes.
        </p>

        <form className="verify-form" onSubmit={handleVerify}>
          <label htmlFor="verify-email-address">Email address</label>
          <input
            id="verify-email-address"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
          />
          <fieldset className="verify-code-fieldset">
            <legend>Verification code</legend>
            <div className="verify-code-inputs" role="group" aria-label="6-digit verification code">
              {Array.from({ length: 6 }, (_, index) => (
                <input
                  key={index}
                  ref={(element) => { otpRefs.current[index] = element; }}
                  className={`verify-code-input ${otpDigits[index] ? "has-value" : ""}`}
                  type="text"
                  inputMode="numeric"
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  pattern="[0-9]"
                  maxLength={6}
                  value={otpDigits[index]}
                  onChange={(event) => updateOtpDigit(index, event.target.value)}
                  onKeyDown={(event) => handleOtpKeyDown(index, event)}
                  onPaste={(event) => handleOtpPaste(event, index)}
                  aria-label={`Code digit ${index + 1}`}
                  aria-describedby="verify-message"
                  required={index === 0}
                />
              ))}
            </div>
            <span className="verify-code-hint">Paste the full code into any box</span>
          </fieldset>
          <button className="verify-submit" type="submit" disabled={isVerifying || isVerified || otp.length !== 6}>
            <span
              className={`verify-button-check ${isVerifying ? "is-loading" : ""} ${isVerified ? "is-done" : ""}`}
              aria-hidden="true"
            />
            {isVerifying ? "Checking code..." : isVerified ? "Email verified" : "Verify email"}
          </button>
        </form>

        <p id="verify-message" className={`verify-message ${messageType}`} role="status" aria-live="polite">
          {message}
        </p>
        <div className="verify-resend-row">
          <span>Didn't get the email?</span>
          <button
            className="verify-resend"
            type="button"
            onClick={handleResend}
            disabled={isVerified || isResending || resendSeconds > 0 || !email.trim()}
          >
            {isResending
            ? "Sending..."
              : resendSeconds > 0
                ? `Resend in ${resendSeconds}s`
                : "Resend code"}
          </button>
        </div>
        <p className="verify-login-link">
          Already verified? <Link to="/login">Log in</Link>
        </p>
      </section>
    </main>
  );
};

export default VerifyEmail;
