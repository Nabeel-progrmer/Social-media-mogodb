import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import Input from "../components/Input";
import Button from "../components/Button";
import { baseUrl } from "../core";
import BrandLoader from "../components/BrandLoader";

const Signup = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstname: "",
    lastname: "",
    email: "",
    passward: "",
    repeatPassward: "",
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordRules = [
    [form.passward.length >= 8, "8 or more characters"],
    [/[a-z]/.test(form.passward), "one lowercase letter"],
    [/[A-Z]/.test(form.passward), "one uppercase letter"],
    [/\d/.test(form.passward), "one number"],
    [/[@$!%*?&]/.test(form.passward), "one special character (@ $ ! % * ? &)"],
  ];
  const passwordIsValid = passwordRules.every(([isValid]) => isValid);

  const updateField = (field) => (event) =>
    setForm({ ...form, [field]: event.target.value });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (form.passward !== form.repeatPassward) {
      setError("Passwords do not match.");
      return;
    }
    if (!passwordIsValid) {
      setError("Please meet all password requirements before signing up.");
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await axios.post(`${baseUrl}/api/v1/signup`, {
        firstname: form.firstname,
        lastname: form.lastname,
        email: form.email,
        passward: form.passward,
      });
      const verificationEmail = response.data.email || form.email.trim().toLowerCase();
      navigate(`/verify-email?email=${encodeURIComponent(verificationEmail)}`, {
        replace: true,
        state: { justSignedUp: true, notice: response.data.message },
      });
    } catch (error) {
      if (error.response?.data?.verificationRequired) {
        const verificationEmail =
          error.response.data.email || form.email.trim().toLowerCase();
        navigate(`/verify-email?email=${encodeURIComponent(verificationEmail)}`, {
          replace: true,
          state: {
            justSignedUp: false,
            notice: error.response.data.message,
            noticeType: "error",
            retryAfter: error.response.data.retryAfter || 0,
          },
        });
        return;
      }
      setError(
        error.response?.data?.message || "Signup failed. Please try again.",
      );
      setIsSubmitting(false);
    }
  };

  if (isSubmitting) return <BrandLoader label="Creating your space" />;

  return (
    <main className="auth-page">
      <form className="auth-form" onSubmit={handleSubmit}>
        <p className="auth-kicker">SOCIAL CIRCLE</p>
        <h2>Create your account</h2>
        <p className="auth-subtitle">
          Join the conversation and share what matters to you.
        </p>
        <div className="name-grid">
          <Input
            placeholder="First name"
            value={form.firstname}
            onChange={updateField("firstname")}
            required
          />
          <Input
            placeholder="Last name"
            value={form.lastname}
            onChange={updateField("lastname")}
            required
          />
        </div>
        <Input
          placeholder="Email address"
          type="email"
          value={form.email}
          onChange={updateField("email")}
          required
        />
        <div className="password-field">
          <Input
            placeholder="Create password"
            type="password"
            value={form.passward}
            onChange={updateField("passward")}
            required
          />
          <ul className="password-rules">
            {passwordRules.map(([isValid, label]) => (
              <li className={isValid ? "valid" : ""} key={label}>
                {isValid ? "OK" : "-"} {label}
              </li>
            ))}
          </ul>
        </div>
        <Input
          placeholder="Repeat password"
          type="password"
          value={form.repeatPassward}
          onChange={updateField("repeatPassward")}
          required
        />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <Button>Sign up</Button>
        <p className="auth-footer">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </main>
  );
};

export default Signup;
