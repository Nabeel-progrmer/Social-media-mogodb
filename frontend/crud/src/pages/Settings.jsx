import { useEffect, useState } from "react";
import axios from "axios";
import {
  CheckCircleFilled,
  GlobalOutlined,
  LockOutlined,
  MoonOutlined,
  SafetyOutlined,
  SunOutlined,
} from "@ant-design/icons";
import { Alert, Spin, Typography, message } from "antd";
import Header from "../components/Header";
import { baseUrl } from "../core";
import { useTheme } from "../theme/useTheme.js";
import "./Settings.css";

const { Text, Title } = Typography;
const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
});

const Settings = () => {
  const { theme, setTheme } = useTheme();
  const [privacy, setPrivacy] = useState("public");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingPrivacy, setIsSavingPrivacy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${baseUrl}/api/v1/settings`, { headers: authHeaders() })
      .then((response) => {
        if (!cancelled) {
          setPrivacy(response.data.settings?.accountPrivacy || "public");
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(
            requestError.response?.data?.message || "Could not load your settings.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const savePrivacy = async (accountPrivacy) => {
    if (accountPrivacy === privacy || isSavingPrivacy) return;
    setIsSavingPrivacy(true);
    setError("");
    try {
      const response = await axios.put(
        `${baseUrl}/api/v1/settings`,
        { accountPrivacy },
        { headers: authHeaders() },
      );
      setPrivacy(response.data.settings?.accountPrivacy || accountPrivacy);
      message.success(`Your account is now ${accountPrivacy}.`);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Could not update account privacy.",
      );
    } finally {
      setIsSavingPrivacy(false);
    }
  };

  return (
    <div className="app-layout">
      <Header />
      <main className="settings-page">
        <header className="settings-heading">
          <span className="settings-heading-icon"><SafetyOutlined /></span>
          <div>
            <Text className="settings-eyebrow">MAKE IT YOURS</Text>
            <Title level={1}>Settings</Title>
            <p>Choose who can see your space and how Circle looks to you.</p>
          </div>
        </header>

        {error && (
          <Alert
            className="settings-error"
            type="error"
            showIcon
            message={error}
          />
        )}

        <section className="settings-section" aria-labelledby="privacy-heading">
          <div className="settings-section-heading">
            <span className="settings-section-icon"><LockOutlined /></span>
            <div>
              <Title level={2} id="privacy-heading">Account privacy</Title>
              <p>Control who can see your profile posts.</p>
            </div>
            {isSavingPrivacy && <Spin size="small" aria-label="Saving privacy setting" />}
          </div>

          {isLoading ? (
            <div className="settings-loading"><Spin tip="Loading settings..." /></div>
          ) : (
            <div className="settings-choice-grid">
              <button
                className={`settings-choice ${privacy === "public" ? "is-selected" : ""}`}
                type="button"
                aria-pressed={privacy === "public"}
                disabled={isSavingPrivacy}
                onClick={() => savePrivacy("public")}
              >
                <span className="settings-choice-icon"><GlobalOutlined /></span>
                <span className="settings-choice-copy">
                  <strong>Public account</strong>
                  <small>Your profile and posts are visible to signed-in members.</small>
                </span>
                {privacy === "public" && <CheckCircleFilled className="settings-selected-icon" />}
              </button>
              <button
                className={`settings-choice ${privacy === "private" ? "is-selected" : ""}`}
                type="button"
                aria-pressed={privacy === "private"}
                disabled={isSavingPrivacy}
                onClick={() => savePrivacy("private")}
              >
                <span className="settings-choice-icon"><LockOutlined /></span>
                <span className="settings-choice-copy">
                  <strong>Private account</strong>
                  <small>Only you can see posts from your private account.</small>
                </span>
                {privacy === "private" && <CheckCircleFilled className="settings-selected-icon" />}
              </button>
            </div>
          )}
          <div className="settings-note">
            Changing this setting also updates which posts appear in search and the feed.
          </div>
        </section>

        <section className="settings-section" aria-labelledby="appearance-heading">
          <div className="settings-section-heading">
            <span className="settings-section-icon appearance-icon"><SunOutlined /></span>
            <div>
              <Title level={2} id="appearance-heading">Appearance</Title>
              <p>Pick the theme that feels right. Your choice is saved on this device.</p>
            </div>
          </div>
          <div className="theme-choice-grid" role="group" aria-label="Choose color theme">
            <button
              className={`theme-choice light-preview ${theme === "light" ? "is-selected" : ""}`}
              type="button"
              aria-pressed={theme === "light"}
              onClick={() => setTheme("light")}
            >
              <span className="theme-preview light-theme-preview">
                <i /><i /><i />
                <b><SunOutlined /></b>
              </span>
              <span><strong>Light</strong><small>Bright and clear</small></span>
              {theme === "light" && <CheckCircleFilled className="settings-selected-icon" />}
            </button>
            <button
              className={`theme-choice dark-preview ${theme === "dark" ? "is-selected" : ""}`}
              type="button"
              aria-pressed={theme === "dark"}
              onClick={() => setTheme("dark")}
            >
              <span className="theme-preview dark-theme-preview">
                <i /><i /><i />
                <b><MoonOutlined /></b>
              </span>
              <span><strong>Dark</strong><small>Easy on the eyes</small></span>
              {theme === "dark" && <CheckCircleFilled className="settings-selected-icon" />}
            </button>
          </div>
        </section>

        <div className="settings-footer">
          <Text type="secondary">Your privacy setting is part of your account. Your theme stays on this device.</Text>
        </div>
      </main>
    </div>
  );
};

export default Settings;
