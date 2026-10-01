import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Button,
  Card,
  Dropdown,
  Empty,
  Input,
  Layout,
  Modal,
  Skeleton,
  Tooltip,
  Typography,
  message,
} from "antd";
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckOutlined,
  DeleteOutlined,
  EditOutlined,
  EllipsisOutlined,
  EyeOutlined,
  MessageOutlined,
  UserAddOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import axios from "axios";
import Header from "../components/Header";
import { baseUrl } from "../core";
import { store } from "../store/states";
import "../App.css";

const { Content } = Layout;
const { Paragraph, Text, Title } = Typography;
const defaultProfilePicture =
  "https://thumbs.dreamstime.com/b/default-profile-picture-avatar-photo-placeholder-vector-illustration-default-profile-picture-avatar-photo-placeholder-vector-189495158.jpg?w=768";

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
});

const formatPostTime = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Time unavailable";

  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (seconds < 45) return "just now";
  if (seconds < 3600)
    return formatter.format(-Math.floor(seconds / 60), "minute");
  if (seconds < 86400)
    return formatter.format(-Math.floor(seconds / 3600), "hour");
  if (seconds < 604800)
    return formatter.format(-Math.floor(seconds / 86400), "day");
  return date.toLocaleDateString();
};

const Profile = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const currentUser = store((state) => state.user);
  const globalLogin = store((state) => state.global_login);
  const mergeFeedPosts = store((state) => state.mergeFeedPosts);
  const upsertFeedPost = store((state) => state.upsertFeedPost);
  const removeFeedPost = store((state) => state.removeFeedPost);
  const profileId = userId || currentUser?._id;
  const isOwner = Boolean(
    currentUser?._id &&
      profileId &&
      String(currentUser._id) === String(profileId),
  );

  const [profile, setProfile] = useState(isOwner ? currentUser : null);
  const [bioDraft, setBioDraft] = useState(currentUser?.bio || "");
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isSavingPost, setIsSavingPost] = useState(false);
  const [isSavingBio, setIsSavingBio] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  useEffect(() => {
    if (!profileId) return;

    let cancelled = false;
    const loadProfile = async () => {
      setIsLoading(true);
      setLoadError("");
      try {
        const response = await axios.get(
          `${baseUrl}/api/v1/profile/${profileId}`,
          {
            headers: authHeaders(),
          },
        );
        if (cancelled) return;

        setProfile(response.data.data);
        setBioDraft(response.data.data.bio || "");
        setPosts(response.data.posts || []);
        mergeFeedPosts(response.data.posts || []);
        if (isOwner) globalLogin(response.data.data);
      } catch (requestError) {
        if (!cancelled) {
          setLoadError(
            requestError.response?.data?.message ||
              "Could not load this profile",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [profileId, isOwner, globalLogin, mergeFeedPosts]);

  const updateProfile = async () => {
    if (!isOwner) return;
    const firstname = window.prompt(
      "Enter first name",
      profile?.firstname || "",
    );
    const lastname = window.prompt("Enter last name", profile?.lastname || "");
    if (!firstname?.trim() || !lastname?.trim()) return;

    try {
      const response = await axios.put(
        `${baseUrl}/api/v1/profile`,
        { firstname: firstname.trim(), lastname: lastname.trim() },
        { headers: authHeaders() },
      );
      setProfile(response.data.data);
      globalLogin(response.data.data);
      setStatusMessage("Profile updated");
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Profile update failed");
      setStatusMessage("");
    }
  };

  const saveBio = async (event) => {
    event.preventDefault();
    if (!isOwner || isSavingBio) return;

    setIsSavingBio(true);
    setError("");
    setStatusMessage("");
    try {
      const response = await axios.put(
        `${baseUrl}/api/v1/profile`,
        { bio: bioDraft.trim() },
        { headers: authHeaders() },
      );
      setProfile(response.data.data);
      setBioDraft(response.data.data.bio || "");
      globalLogin(response.data.data);
      setStatusMessage("Bio updated");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Bio update failed");
    } finally {
      setIsSavingBio(false);
    }
  };

  const updatePassword = async (event) => {
    event.preventDefault();
    if (!isOwner) return;
    if (!currentPassword || !newPassword || !repeatPassword) {
      setError("All password fields are required");
      return;
    }
    if (newPassword !== repeatPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      await axios.put(
        `${baseUrl}/api/v1/passward`,
        { currentPassward: currentPassword, newPassward: newPassword },
        { headers: authHeaders() },
      );
      setCurrentPassword("");
      setNewPassword("");
      setRepeatPassword("");
      setStatusMessage("Password updated");
      setError("");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Password update failed",
      );
      setStatusMessage("");
    }
  };

  const uploadProfilePicture = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !isOwner) return;

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file");
      return;
    }
    if (file.size > 1_000_000) {
      setError("Image must be smaller than 1 MB");
      return;
    }

    const formData = new FormData();
    formData.append("profilePicture", file);
    setIsUploading(true);
    setError("");
    setStatusMessage("");
    try {
      const response = await axios.put(
        `${baseUrl}/api/v1/profile-picture`,
        formData,
        {
          headers: authHeaders(),
        },
      );
      setProfile(response.data.data);
      globalLogin(response.data.data);
      setStatusMessage("Profile picture updated");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Profile picture upload failed",
      );
    } finally {
      setIsUploading(false);
    }
  };

  const toggleFollow = async () => {
    if (isOwner || !profileId || isFollowLoading) return;
    setIsFollowLoading(true);
    try {
      const response = await axios({
        method: profile?.isFollowing ? "delete" : "put",
        url: `${baseUrl}/api/v1/profile/${profileId}/follow`,
        headers: authHeaders(),
      });
      setProfile((current) => ({
        ...current,
        isFollowing: response.data.isFollowing,
        followingCount: response.data.followingCount,
        followersCount: response.data.followersCount,
      }));
      if (profile?.accountPrivacy === "private") {
        setPosts([]);
      }
      message.success(
        response.data.message === "user followed"
          ? "You are now following this user"
          : "You unfollowed this user",
      );
      setError("");
      setStatusMessage("");
    } catch (requestError) {
      message.error(
        requestError.response?.data?.message ||
          "Could not update follow status",
      );
    } finally {
      setIsFollowLoading(false);
    }
  };

  const beginEditPost = (post) => {
    if (!isOwner || post.isOwner !== true) return;
    setEditingPost(post);
    setEditTitle(post.title);
    setEditDescription(post.description);
  };

  const savePost = async () => {
    if (
      !isOwner ||
      !editingPost?.isOwner ||
      !editTitle.trim() ||
      !editDescription.trim()
    )
      return;
    setIsSavingPost(true);
    try {
      const response = await axios.put(
        `${baseUrl}/api/v1/post/${editingPost._id}`,
        { title: editTitle.trim(), description: editDescription.trim() },
        { headers: authHeaders() },
      );
      setPosts((current) =>
        current.map((post) =>
          post._id === editingPost._id ? response.data.post : post,
        ),
      );
      upsertFeedPost(response.data.post);
      setEditingPost(null);
      message.success("Post updated");
    } catch (requestError) {
      message.error(
        requestError.response?.data?.message || "Could not update post",
      );
    } finally {
      setIsSavingPost(false);
    }
  };

  const deletePost = (post) => {
    if (!isOwner || post.isOwner !== true) return;
    Modal.confirm({
      title: "Delete this post?",
      content: "This cannot be undone.",
      okText: "Delete",
      cancelText: "Keep it",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await axios.delete(`${baseUrl}/api/v1/post/${post._id}`, {
            headers: authHeaders(),
          });
          setPosts((current) =>
            current.filter((item) => item._id !== post._id),
          );
          removeFeedPost(post._id);
          message.success("Post deleted");
        } catch (requestError) {
          message.error(
            requestError.response?.data?.message || "Could not delete post",
          );
        }
      },
    });
  };

  const fullName = profile
    ? `${profile.firstname} ${profile.lastname}`
    : "Profile";

  return (
    <Layout className="app-layout">
      <Header />
      <Content className="dashboard-content profile-view-content">
        <div className="profile-page-heading">
          <div>
            <Text className="eyebrow">
              {isOwner ? "YOUR ACCOUNT" : "COMMUNITY PROFILE"}
            </Text>
            <Title level={1}>
              {isOwner ? "Make your space feel like yours." : fullName}
            </Title>
            <Text type="secondary">
              {isOwner
                ? "Manage your profile, posts and account security."
                : profile?.accountPrivacy === "private"
                  ? "This account is private. Only its owner can view its posts."
                  : "Profile and public posts."}
            </Text>
          </div>
          <div className="profile-history-actions">
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
              Back
            </Button>
            <Button icon={<ArrowRightOutlined />} onClick={() => navigate(1)}>
              Forward
            </Button>
          </div>
        </div>

        {loadError && (
          <Card className="profile-load-error">
            <Text type="danger">{loadError}</Text>
          </Card>
        )}
        {isLoading && (
          <Card className="post-card">
            <Skeleton active avatar paragraph={{ rows: 3 }} />
          </Card>
        )}

        {!isLoading && profile && (
          <>
            <div
              className={`profile-grid${isOwner ? "" : " profile-grid-public"}`}
            >
              <section className="profile-card profile-summary">
                <div className="profile-card-cover" />
                <div className="profile-summary-body">
                  <img
                    className="profile-photo"
                    src={profile.profilePicture || defaultProfilePicture}
                    alt={`${fullName} profile`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setIsPreviewOpen(true)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ")
                        setIsPreviewOpen(true);
                    }}
                    onError={(event) => {
                      event.currentTarget.src = defaultProfilePicture;
                    }}
                  />
                  {isOwner && (
                    <>
                      <button
                        className="profile-edit-button"
                        type="button"
                        aria-label="Edit profile"
                        onClick={updateProfile}
                      >
                        <EditOutlined />
                      </button>
                      <label
                        className="profile-photo-upload-icon"
                        htmlFor="profile-picture-input"
                        title={
                          isUploading
                            ? "Uploading photo"
                            : "Update profile photo"
                        }
                      >
                        {isUploading ? "…" : <UploadOutlined />}
                      </label>
                      <input
                        id="profile-picture-input"
                        className="profile-file-input"
                        type="file"
                        accept="image/*"
                        onChange={uploadProfilePicture}
                        disabled={isUploading}
                      />
                    </>
                  )}
                  <Title level={2}>{fullName}</Title>
                  {profile && (
                    <div className="profile-follow-controls">
                      {!isOwner && (
                        <div className="profile-follow-actions">
                          <Button
                            className={`profile-follow-button${profile.isFollowing ? " is-following" : ""}`}
                            type={profile.isFollowing ? "default" : "primary"}
                            icon={
                              profile.isFollowing ? (
                                <CheckOutlined />
                              ) : (
                                <UserAddOutlined />
                              )
                            }
                            loading={isFollowLoading}
                            onClick={toggleFollow}
                          >
                            {profile.isFollowing ? "Following" : "Follow"}
                          </Button>
                          <Button
                            icon={<MessageOutlined />}
                            onClick={() =>
                              navigate("/chat?userId=" + profileId)
                            }
                          >
                            Message
                          </Button>
                        </div>
                      )}
                      <div
                        className="profile-follow-stats"
                        aria-label="Follow statistics"
                      >
                        <span>
                          <strong>{profile.followersCount || 0}</strong>{" "}
                          followers
                        </span>
                        <span>
                          <strong>{profile.followingCount || 0}</strong>{" "}
                          following
                        </span>
                      </div>
                    </div>
                  )}
                  {isOwner && (
                    <>
                      <Text className="profile-email">{profile.email}</Text>
                      <span className="profile-badge">
                        {profile.accountPrivacy === "private" ? "PRIVATE ACCOUNT" : "PUBLIC ACCOUNT"}
                      </span>
                      <div className="profile-details">
                        <div>
                          <span>First name</span>
                          <strong>{profile.firstname || "-"}</strong>
                        </div>
                        <div>
                          <span>Last name</span>
                          <strong>{profile.lastname || "-"}</strong>
                        </div>
                      </div>
                    </>
                  )}
                  {(isOwner || profile.bio) && (
                    <section className="profile-bio">
                      <Text className="profile-bio-label">BIO</Text>
                      {isOwner ? (
                        <form className="profile-bio-form" onSubmit={saveBio}>
                          <Input.TextArea
                            aria-label="Your bio"
                            value={bioDraft}
                            maxLength={160}
                            showCount
                            autoSize={{ minRows: 2, maxRows: 4 }}
                            onChange={(event) => setBioDraft(event.target.value)}
                            placeholder="Write a short introduction"
                          />
                          <Button
                            type="primary"
                            htmlType="submit"
                            loading={isSavingBio}
                            disabled={bioDraft.trim() === (profile.bio || "")}
                          >
                            Save bio
                          </Button>
                        </form>
                      ) : (
                        <Paragraph className="profile-bio-copy">
                          {profile.bio}
                        </Paragraph>
                      )}
                    </section>
                  )}
                </div>
              </section>

              {isOwner && (
                <form className="profile-security" onSubmit={updatePassword}>
                  <div className="security-heading">
                    <span className="security-icon">•••</span>
                    <div>
                      <Text className="card-kicker">SECURITY</Text>
                      <Title level={2}>Keep your account protected.</Title>
                    </div>
                  </div>
                  <Text className="security-copy">
                    Use a strong password that you do not use anywhere else.
                  </Text>
                  <Input
                    placeholder="Current password"
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    required
                  />
                  <Input
                    placeholder="New password"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    required
                  />
                  <Input
                    placeholder="Confirm new password"
                    type="password"
                    value={repeatPassword}
                    onChange={(event) => setRepeatPassword(event.target.value)}
                    required
                  />
                  {(error || statusMessage) && (
                    <p
                      className={error ? "form-error" : "form-success"}
                      role="status"
                    >
                      {error || statusMessage}
                    </p>
                  )}
                  <Button htmlType="submit">Update password</Button>
                </form>
              )}
            </div>

            <section className="profile-posts-section">
              <div className="feed-heading">
                <div>
                  <Text className="card-kicker">
                    {isOwner
                      ? "YOUR STORIES"
                      : `${profile.firstname}'S STORIES`}
                  </Text>
                  <Title level={2}>{isOwner ? "Your posts" : "Posts"}</Title>
                </div>
                <Text type="secondary">
                  {posts.length} {posts.length === 1 ? "post" : "posts"}
                </Text>
              </div>
              {posts.length === 0 ? (
                <Card className="empty-card" bordered={false}>
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      isOwner
                        ? "You have not shared a post yet."
                        : profile.accountPrivacy === "private"
                          ? "Posts from private accounts are only visible to their owners."
                          : "No posts yet."
                    }
                  />
                </Card>
              ) : (
                <div className="feed-list">
                  {posts.map((post) => (
                    <Card
                      key={post._id}
                      className="post-card profile-post-card"
                      bordered={false}
                    >
                      <div className="profile-post-heading">
                        <Tooltip
                          title={
                            post.createdAt
                              ? new Date(post.createdAt).toLocaleString()
                              : "Post time unavailable"
                          }
                        >
                          <Text type="secondary">
                            {formatPostTime(post.createdAt)}
                          </Text>
                        </Tooltip>
                        {isOwner && post.isOwner === true && (
                          <Dropdown
                            trigger={["click"]}
                            placement="bottomRight"
                            menu={{
                              items: [
                                {
                                  key: "edit",
                                  label: "Edit post",
                                  icon: <EditOutlined />,
                                },
                                {
                                  key: "delete",
                                  label: "Delete post",
                                  danger: true,
                                  icon: <DeleteOutlined />,
                                },
                              ],
                              onClick: ({ key }) =>
                                key === "edit"
                                  ? beginEditPost(post)
                                  : deletePost(post),
                            }}
                          >
                            <Button
                              type="text"
                              shape="circle"
                              icon={<EllipsisOutlined />}
                              aria-label="Post options"
                            />
                          </Dropdown>
                        )}
                      </div>
                      <Title level={3}>{post.title}</Title>
                      <Paragraph className="post-description">
                        {post.description}
                      </Paragraph>
                      {post.imageUrl && (
                        <img
                          className="post-image"
                          src={post.imageUrl}
                          alt={post.title + " post"}
                          loading="lazy"
                        />
                      )}
                      <Button
                        className="profile-view-post-button"
                        icon={<EyeOutlined />}
                        onClick={() => navigate(`/post/${post._id}`)}
                      >
                        View full post
                      </Button>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            {isOwner && (
              <>
                {(error || statusMessage) && (
                  <p
                    className={error ? "form-error" : "form-success"}
                    role="status"
                  >
                    {error || statusMessage}
                  </p>
                )}
                <Modal
                  open={Boolean(editingPost)}
                  title="Edit post"
                  okText="Save changes"
                  cancelText="Cancel"
                  confirmLoading={isSavingPost}
                  onCancel={() => setEditingPost(null)}
                  onOk={savePost}
                >
                  <Input
                    value={editTitle}
                    maxLength={100}
                    onChange={(event) => setEditTitle(event.target.value)}
                    placeholder="Post title"
                  />
                  <Input.TextArea
                    className="profile-edit-description"
                    value={editDescription}
                    maxLength={1000}
                    autoSize={{ minRows: 4, maxRows: 8 }}
                    onChange={(event) => setEditDescription(event.target.value)}
                    placeholder="Post description"
                  />
                </Modal>
              </>
            )}
          </>
        )}

        <Modal
          open={isPreviewOpen}
          footer={null}
          centered
          onCancel={() => setIsPreviewOpen(false)}
          title={`${fullName} profile picture`}
        >
          <img
            className="profile-full-image"
            src={profile?.profilePicture || defaultProfilePicture}
            alt={`${fullName} full profile`}
          />
        </Modal>
      </Content>
    </Layout>
  );
};

export default Profile;
