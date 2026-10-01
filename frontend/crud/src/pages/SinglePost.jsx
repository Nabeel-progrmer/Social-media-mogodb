import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Avatar,
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
  DeleteOutlined,
  EditOutlined,
  EllipsisOutlined,
  LikeFilled,
  LikeOutlined,
  MessageOutlined,
  SendOutlined,
  ShareAltOutlined,
} from "@ant-design/icons";
import { Link, useNavigate, useParams } from "react-router-dom";
import Header from "../components/Header";
import { store } from "../store/states";
import { baseUrl } from "../core";
import "../App.css";

const { Content } = Layout;
const { Paragraph, Title, Text } = Typography;
const apiUrl = `${baseUrl}/api/v1`;
const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
});

const formatPostTime = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

export default function SinglePost() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const user = store((state) => state.user);
  const upsertFeedPost = store((state) => state.upsertFeedPost);
  const removeFeedPost = store((state) => state.removeFeedPost);
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [comment, setComment] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const loadPost = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/post/${postId}`, {
        headers: authHeaders(),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Could not load this post");
      setPost(data.post);
      upsertFeedPost(data.post);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [postId, upsertFeedPost]);

  useEffect(() => {
    const timer = window.setTimeout(loadPost, 0);
    return () => window.clearTimeout(timer);
  }, [loadPost]);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`${apiUrl}/post/${postId}/view`, {
          method: "POST",
          headers: authHeaders(),
        });
        if (!response.ok) return;
        const data = await response.json();
        setPost((current) => {
          if (!current) return current;
          const updated = { ...current, viewsCount: data.viewsCount };
          upsertFeedPost(updated);
          return updated;
        });
      } catch {
        // Post reading should still work when view tracking is temporarily unavailable.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [postId, upsertFeedPost]);

  const requireAuth = () => {
    if (user?._id && localStorage.getItem("token")) return true;
    message.warning("Log in to interact with this post");
    navigate("/login");
    return false;
  };

  const toggleLike = async () => {
    if (!requireAuth() || !post) return;
    try {
      const response = await fetch(`${apiUrl}/post/${post._id}/like`, {
        method: post.likedByMe ? "DELETE" : "PUT",
        headers: authHeaders(),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Could not update like");
      setPost((current) => ({ ...current, ...data.post }));
      upsertFeedPost(data.post);
    } catch (requestError) {
      message.error(requestError.message);
    }
  };

  const addComment = async (event) => {
    event.preventDefault();
    if (!requireAuth() || !comment.trim()) return;
    try {
      const response = await fetch(`${apiUrl}/post/${post._id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ text: comment.trim() }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Could not add comment");
      setPost(data.post);
      upsertFeedPost(data.post);
      setComment("");
    } catch (requestError) {
      message.error(requestError.message);
    }
  };

  const saveEdit = async () => {
    if (!editTitle.trim() || !editDescription.trim()) return;
    setSaving(true);
    try {
      const response = await fetch(`${apiUrl}/post/${post._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Could not update post");
      setPost(data.post);
      upsertFeedPost(data.post);
      setEditOpen(false);
      message.success("Post updated");
    } catch (requestError) {
      message.error(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const deletePost = () =>
    Modal.confirm({
      title: "Delete this post?",
      content: "This cannot be undone.",
      okText: "Delete",
      cancelText: "Keep it",
      okButtonProps: { danger: true },
      onOk: async () => {
        const response = await fetch(`${apiUrl}/post/${post._id}`, {
          method: "DELETE",
          headers: authHeaders(),
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.message || "Could not delete post");
        message.success("Post deleted");
        removeFeedPost(post._id);
        navigate("/", { replace: true });
      },
    });

  const sharePost = async () => {
    if (!requireAuth()) return;
    const url = `${window.location.origin}/post/${post._id}`;
    try {
      if (navigator.share)
        await navigator.share({
          title: post.title,
          text: post.description,
          url,
        });
      else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        message.success("Post link copied");
      } else window.prompt("Copy this post link", url);
    } catch (shareError) {
      if (shareError.name !== "AbortError")
        message.error("Could not share this post");
    }
  };

  const owner = Boolean(
    post?.isOwner && user?._id && String(post.author?._id) === String(user._id),
  );
  const author = post?.author;
  const authorName = author
    ? `${author.firstname || ""} ${author.lastname || ""}`.trim()
    : "Former member";

  return (
    <Layout className="app-layout">
      <Header />
      <Content className="dashboard-content single-post-content">
        <div className="profile-page-heading">
          <div>
            <Text className="eyebrow">COMMUNITY STORY</Text>
            <Title level={1}>Post</Title>
            <Text type="secondary">
              A conversation, shared with the community.
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
        <div className="single-post-column">
          {loading && (
            <Card className="post-card">
              <Skeleton active avatar paragraph={{ rows: 4 }} />
            </Card>
          )}
          {!loading && error && (
            <Card className="post-card">
              <Alert
                type="error"
                showIcon
                message="Could not load post"
                description={error}
                action={<Button onClick={loadPost}>Try again</Button>}
              />
            </Card>
          )}
          {!loading && !error && !post && (
            <Card className="empty-card">
              <Empty description="Post not found" />
            </Card>
          )}
          {!loading && post && (
            <Card className="post-card single-post-card" bordered={false}>
              <div className="post-meta">
                {author?._id ? (
                  <Link
                    className="post-author-avatar-link"
                    to={`/profile/${author._id}`}
                    aria-label={`View ${authorName}'s profile`}
                  >
                    <Avatar
                      className="post-avatar"
                      src={author.profilePicture || undefined}
                    >
                      {author.firstname?.[0] || "U"}
                      {author.lastname?.[0] || ""}
                    </Avatar>
                  </Link>
                ) : (
                  <Avatar className="post-avatar">U</Avatar>
                )}
                <div className="post-author-meta">
                  {author?._id ? (
                    <Link
                      className="post-author-name-link"
                      to={`/profile/${author._id}`}
                    >
                      <Text strong className="post-author-name">
                        {authorName}
                      </Text>
                    </Link>
                  ) : (
                    <Text strong>{authorName}</Text>
                  )}
                  <Text type="secondary" className="post-time">
                    <time dateTime={post.createdAt}>
                      {formatPostTime(post.createdAt)}
                    </time>{" "}
                    · {post.viewsCount || 0} views
                  </Text>
                </div>
                {owner && (
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
                      onClick: ({ key }) => {
                        if (key === "edit") {
                          setEditTitle(post.title);
                          setEditDescription(post.description);
                          setEditOpen(true);
                        }
                        if (key === "delete") deletePost();
                      },
                    }}
                  >
                    <Button
                      className="post-menu-button"
                      type="text"
                      shape="circle"
                      icon={<EllipsisOutlined />}
                      aria-label="Post options"
                    />
                  </Dropdown>
                )}
              </div>
              <Title level={2}>{post.title}</Title>
              <Paragraph className="post-description single-post-description">
                {post.description}
              </Paragraph>
              {post.imageUrl && (
                <img
                  className="post-image single-post-image"
                  src={post.imageUrl}
                  alt={post.title + " post"}
                />
              )}
              <div className="post-social-actions">
                <Button
                  className={`social-action${post.likedByMe ? " is-liked" : ""}`}
                  icon={post.likedByMe ? <LikeFilled /> : <LikeOutlined />}
                  onClick={toggleLike}
                >
                  Like <span>{post.likesCount || 0}</span>
                </Button>
                <Button
                  className="social-action"
                  icon={<MessageOutlined />}
                  onClick={() =>
                    document.getElementById("single-post-comment")?.focus()
                  }
                >
                  Comment <span>{post.comments?.length || 0}</span>
                </Button>
                <Button
                  className="social-action"
                  icon={<ShareAltOutlined />}
                  onClick={sharePost}
                >
                  Share
                </Button>
              </div>
              <section className="post-comments" aria-label="Post comments">
                {post.comments?.length > 0 && (
                  <div className="comment-list">
                    {post.comments.map((item) => {
                      const commenter = item.user;
                      const name = commenter
                        ? `${commenter.firstname || ""} ${commenter.lastname || ""}`.trim()
                        : "Former member";
                      return (
                        <div className="post-comment" key={item._id}>
                          {commenter?._id ? (
                            <Link
                              to={`/profile/${commenter._id}`}
                              aria-label={`View ${name}'s profile`}
                            >
                              <Avatar
                                size={34}
                                src={commenter.profilePicture || undefined}
                              >
                                {commenter.firstname?.[0] || "U"}
                              </Avatar>
                            </Link>
                          ) : (
                            <Avatar size={34}>U</Avatar>
                          )}
                          <div className="comment-bubble">
                            {commenter?._id ? (
                              <Link
                                to={`/profile/${commenter._id}`}
                                className="commenter-name-link"
                              >
                                <Text strong>{name}</Text>
                              </Link>
                            ) : (
                              <Text strong>{name}</Text>
                            )}
                            <Paragraph>{item.text}</Paragraph>
                            <Tooltip title={formatPostTime(item.createdAt)}>
                              <Text type="secondary" className="comment-time">
                                {item.createdAt
                                  ? new Date(item.createdAt).toLocaleString()
                                  : ""}
                              </Text>
                            </Tooltip>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {post.comments?.length === 0 && (
                  <Text type="secondary">
                    No comments yet. Start the conversation.
                  </Text>
                )}
                <form className="comment-composer" onSubmit={addComment}>
                  <Input.TextArea
                    id="single-post-comment"
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    placeholder="Write a comment..."
                    maxLength={1000}
                    autoSize={{ minRows: 1, maxRows: 4 }}
                  />
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SendOutlined />}
                    disabled={!comment.trim()}
                  >
                    Post
                  </Button>
                </form>
              </section>
            </Card>
          )}
        </div>
        <Modal
          open={editOpen}
          title="Edit post"
          okText="Save changes"
          cancelText="Cancel"
          confirmLoading={saving}
          onCancel={() => setEditOpen(false)}
          onOk={saveEdit}
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
      </Content>
    </Layout>
  );
}
