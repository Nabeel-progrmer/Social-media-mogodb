import { useCallback, useEffect, useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  Drawer,
  Empty,
  Layout,
  List,
  Popover,
  Tag,
  Typography,
  message,
} from "antd";
import {
  BellOutlined,
  HomeOutlined,
  LogoutOutlined,
  MenuOutlined,
  MessageOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Link, useNavigate } from "react-router-dom";
import { store } from "../store/states";
import { baseUrl } from "../core";

const { Header: AntHeader } = Layout;
const { Text } = Typography;
const apiUrl = baseUrl + "/api/v1";
const authHeaders = () => ({
  Authorization: "Bearer " + (localStorage.getItem("token") || ""),
});

const Header = () => {
  const navigate = useNavigate();
  const { user, global_logout } = store();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadChats, setUnreadChats] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileNotificationsOpen, setMobileNotificationsOpen] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const response = await fetch(apiUrl + "/notifications", {
        headers: authHeaders(),
      });
      if (!response.ok) return;
      const data = await response.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // Keep the header usable when notifications are temporarily unavailable.
    }
  }, []);

  useEffect(() => {
    const initialFetch = window.setTimeout(loadNotifications, 0);
    const interval = window.setInterval(loadNotifications, 10000);
    return () => {
      window.clearTimeout(initialFetch);
      window.clearInterval(interval);
    };
  }, [loadNotifications]);

  useEffect(() => {
    let cancelled = false;
    const loadUnreadChats = async () => {
      try {
        const response = await fetch(apiUrl + "/conversations/unread", {
          headers: authHeaders(),
        });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setUnreadChats(data.unreadCount || 0);
      } catch {
        // Chat remains available if the unread counter is temporarily unavailable.
      }
    };
    const timer = window.setTimeout(loadUnreadChats, 0);
    const interval = window.setInterval(loadUnreadChats, 10000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, []);

  const markNotificationsRead = async () => {
    try {
      await fetch(apiUrl + "/notifications/read", {
        method: "PUT",
        headers: authHeaders(),
      });
      setNotifications((current) =>
        current.map((item) => ({
          ...item,
          readAt: item.readAt || new Date().toISOString(),
        })),
      );
      setUnreadCount(0);
    } catch {
      message.error("Could not mark notifications as read");
    }
  };

  const openNotifications = async (open) => {
    setNotificationsOpen(open);
    if (!open) return;
    await loadNotifications();
    await markNotificationsRead();
  };

  const toggleMobileNotifications = async () => {
    const shouldOpen = !mobileNotificationsOpen;
    setMobileNotificationsOpen(shouldOpen);
    if (!shouldOpen) return;
    await loadNotifications();
    await markNotificationsRead();
  };

  const logout = () => {
    localStorage.removeItem("token");
    global_logout();
    navigate("/login");
  };

  return (
    <AntHeader className="app-header">
      <div className="header-user">
        {user && (
          <Link to="/profile" className="user-name">
            {user.firstname} {user.lastname}
          </Link>
        )}
      </div>
      <Link to="/" className="brand-mark header-logo">
        <span className="brand-dot" /> circle
      </Link>
      <Button
        className="mobile-menu-trigger"
        type="text"
        icon={<MenuOutlined />}
        aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={mobileMenuOpen}
        aria-controls="mobile-navigation"
        onClick={() => setMobileMenuOpen((open) => !open)}
      />
      <div className="header-actions">
        <Tag color="green" className="live-tag">
          ● LIVE
        </Tag>
        <Link to="/people" className="header-people-link" aria-label="Browse people">
          <TeamOutlined />
          <span>People</span>
        </Link>
        <Link
          to="/chat"
          className="header-chat-link"
          aria-label="Open messages"
        >
          <Badge count={unreadChats} size="small">
            <MessageOutlined />
          </Badge>
          <span>Messages</span>
        </Link>
        <Link
          to="/settings"
          className="header-settings-link"
          aria-label="Open settings"
          title="Settings"
        >
          <SettingOutlined />
        </Link>
        <Popover
          open={notificationsOpen}
          onOpenChange={openNotifications}
          trigger="click"
          placement="bottomRight"
          title={
            <div className="notification-panel-title">
              <span>Notifications</span>
              {unreadCount > 0 && (
                <Text type="secondary">{unreadCount} new</Text>
              )}
            </div>
          }
          content={
            <div className="notification-panel">
              {notifications.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No notifications yet"
                />
              ) : (
                <List
                  dataSource={notifications}
                  renderItem={(item) => {
                    const actor = item.actor;
                    const actorName = actor
                      ? (actor.firstname || "") + " " + (actor.lastname || "")
                      : "A user";
                    const isPostNotification =
                      item.type === "like" ||
                      item.type === "comment" ||
                      item.type === "post_views";
                    const notificationText =
                      item.type === "follow"
                        ? "started following you"
                        : item.type === "unfollow"
                          ? "stopped following you"
                          : item.type === "like"
                            ? "liked your post" +
                              (item.post?.title ? ": " + item.post.title : "")
                            : item.type === "comment"
                              ? "commented on your post" +
                                (item.post?.title ? ": " + item.post.title : "")
                              : item.type === "post_views"
                                ? "Your post reached " + item.count + " views"
                                : "sent you a notification";
                    const notificationUrl =
                      isPostNotification && item.post?._id
                        ? "/post/" + item.post._id
                        : actor?._id
                          ? "/profile/" + actor._id
                          : "#";
                    return (
                      <List.Item
                        className={
                          "notification-list-item" +
                          (item.readAt ? "" : " is-unread")
                        }
                      >
                        {actor?._id || item.post?._id ? (
                          <Link
                            className="notification-entry"
                            to={notificationUrl}
                            onClick={() => setNotificationsOpen(false)}
                          >
                            <Avatar src={actor?.profilePicture || undefined}>
                              {actor?.firstname?.[0] || "U"}
                            </Avatar>
                            <span>
                              {item.type === "post_views" ? (
                                notificationText
                              ) : (
                                <>
                                  <strong>{actorName.trim()}</strong>{" "}
                                  {notificationText}
                                </>
                              )}
                              {item.text && (
                                <Text
                                  type="secondary"
                                  className="notification-excerpt"
                                >
                                  “{item.text}”
                                </Text>
                              )}
                              <Text
                                type="secondary"
                                className="notification-time"
                              >
                                {item.createdAt
                                  ? new Date(item.createdAt).toLocaleString()
                                  : ""}
                              </Text>
                            </span>
                            {!item.readAt && (
                              <i className="notification-unread-dot" />
                            )}
                          </Link>
                        ) : (
                          <span className="notification-entry">
                            <Avatar>U</Avatar>
                            <span>Someone started following you</span>
                          </span>
                        )}
                      </List.Item>
                    );
                  }}
                />
              )}
            </div>
          }
        >
          <Button
            className="notifications-trigger"
            type="text"
            aria-label={unreadCount + " unread notifications"}
            icon={
              <Badge count={unreadCount} size="small">
                <BellOutlined />
              </Badge>
            }
          />
        </Popover>
        <Link to="/profile" aria-label="Open your profile">
          <Avatar
            className="profile-avatar"
            src={user?.profilePicture || undefined}
            onError={() => true}
          >
            {user?.firstname?.[0] || "C"}
            {user?.lastname?.[0] || "M"}
          </Avatar>
        </Link>
        <Button
          type="text"
          icon={<LogoutOutlined />}
          onClick={logout}
          aria-label="Log out"
          title="Log out"
        >
          <span className="header-logout-label">Logout</span>
        </Button>
      </div>
      <Drawer
        className="mobile-nav-drawer"
        title={
          <span className="brand-mark mobile-drawer-brand">
            <span className="brand-dot" /> circle
          </span>
        }
        placement="right"
        width="min(320px, calc(100vw - 24px))"
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        rootClassName="mobile-nav-root"
        id="mobile-navigation"
      >
        <div className="mobile-nav-user">
          <Avatar
            className="profile-avatar"
            src={user?.profilePicture || undefined}
          >
            {user?.firstname?.[0] || "C"}
            {user?.lastname?.[0] || "M"}
          </Avatar>
          <span>
            <strong>{user ? `${user.firstname} ${user.lastname}` : "Circle member"}</strong>
            <small>{user?.email || "Welcome to Circle"}</small>
          </span>
        </div>
        <nav className="mobile-nav-links" aria-label="Main navigation">
          <Link className="mobile-nav-link" to="/" onClick={() => setMobileMenuOpen(false)}>
            <span className="mobile-nav-link-icon"><HomeOutlined /></span><span>Feed</span>
          </Link>
          <Link className="mobile-nav-link" to="/profile" onClick={() => setMobileMenuOpen(false)}>
            <span className="mobile-nav-link-icon"><UserOutlined /></span><span>My profile</span>
          </Link>
          <Link className="mobile-nav-link" to="/people" onClick={() => setMobileMenuOpen(false)}>
            <span className="mobile-nav-link-icon"><TeamOutlined /></span><span>People</span>
          </Link>
          <Link className="mobile-nav-link" to="/chat" onClick={() => setMobileMenuOpen(false)}>
            <span className="mobile-nav-link-icon"><MessageOutlined /></span>
            <span>Messages</span>
            {unreadChats > 0 && <b className="mobile-nav-count">{unreadChats}</b>}
          </Link>
          <Link className="mobile-nav-link" to="/settings" onClick={() => setMobileMenuOpen(false)}>
            <span className="mobile-nav-link-icon"><SettingOutlined /></span><span>Settings</span>
          </Link>
          <button
            className={`mobile-nav-link ${mobileNotificationsOpen ? "is-open" : ""}`}
            type="button"
            aria-expanded={mobileNotificationsOpen}
            onClick={toggleMobileNotifications}
          >
            <span className="mobile-nav-link-icon"><BellOutlined /></span>
            <span>Notifications</span>
            {unreadCount > 0 && <b className="mobile-nav-count">{unreadCount}</b>}
          </button>
          {mobileNotificationsOpen && (
            <div className="mobile-notifications-list">
              {notifications.length ? notifications.map((item) => {
                const actorName = [item.actor?.firstname, item.actor?.lastname].filter(Boolean).join(" ") || "Someone";
                const href = item.post?._id
                  ? `/post/${item.post._id}`
                  : item.actor?._id
                    ? `/profile/${item.actor._id}`
                    : "/profile";
                const action = item.type === "follow" ? "started following you" : item.type === "like" ? "liked your post" : item.type === "comment" ? "commented on your post" : item.type === "post_views" ? `your post reached ${item.count} views` : "sent you an update";
                return (
                  <Link
                    className="mobile-notification-item"
                    key={item._id || `${item.type}-${item.createdAt}`}
                    to={href}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Avatar size="small" src={item.actor?.profilePicture || undefined}>{item.actor?.firstname?.[0] || "U"}</Avatar>
                    <span><strong>{actorName}</strong> {action}<small>{item.createdAt ? new Date(item.createdAt).toLocaleString() : ""}</small></span>
                  </Link>
                );
              }) : <p className="mobile-notifications-empty">No notifications yet</p>}
            </div>
          )}
        </nav>
        <Button
          className="mobile-nav-logout"
          icon={<LogoutOutlined />}
          onClick={() => {
            setMobileMenuOpen(false);
            logout();
          }}
        >
          Log out
        </Button>
      </Drawer>
    </AntHeader>
  );
};

export default Header;
