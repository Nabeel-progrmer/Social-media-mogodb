import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Col,
  Dropdown,
  Empty,
  Input,
  Layout,
  Modal,
  Row,
  Skeleton,
  Space,
  Statistic,
  Tooltip,
  Typography,
  message,
} from "antd";
import {
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  EllipsisOutlined,
  EyeOutlined,
  FileTextOutlined,
  LikeFilled,
  LikeOutlined,
  MessageOutlined,
  PictureOutlined,
  SendOutlined,
  ShareAltOutlined,
} from "@ant-design/icons";
import { Link, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import { baseUrl } from "../core";
import { store } from "../store/states";
import "../App.css";

const { Content } = Layout;
const { TextArea } = Input;
const { Paragraph, Title, Text } = Typography;
const API_URL = `${baseUrl}/api/v1`;
const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
});

const formatPostTime = (date) => {
  if (!date || Number.isNaN(date.getTime())) return "Time unavailable";

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (seconds < 45) return "just now";
  if (seconds < 3600)
    return formatter.format(-Math.floor(seconds / 60), "minute");
  if (seconds < 86400)
    return formatter.format(-Math.floor(seconds / 3600), "hour");
  if (seconds < 604800)
    return formatter.format(-Math.floor(seconds / 86400), "day");
  if (seconds < 2_592_000)
    return formatter.format(-Math.floor(seconds / 604800), "week");
  if (seconds < 31_536_000)
    return formatter.format(-Math.floor(seconds / 2_592_000), "month");
  return formatter.format(-Math.floor(seconds / 31_536_000), "year");
};

const isPostOwnedBy = (post, userId) => {
  const authorId =
    typeof post?.author === "object"
      ? (post.author?._id ?? post.author?.id)
      : post?.author;

  return Boolean(
    userId &&
      authorId &&
      post?.isOwner !== false &&
      String(userId) === String(authorId),
  );
};

function Post() {
  const navigate = useNavigate();
  const user = store((state) => state.user);
  const posts = store((state) => state.feedPosts);
  const setPosts = store((state) => state.setFeedPosts);
  const upsertPost = store((state) => state.upsertFeedPost);
  const patchPost = store((state) => state.patchFeedPost);
  const removePost = store((state) => state.removeFeedPost);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [openComments, setOpenComments] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const viewedPostIds = useRef(new Set());

  const updateSearchQuery = (value) => {
    setSearchQuery(value);
    if (value.trim().length < 2) {
      setSearchResults(null);
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (!imagePreview) return undefined;
    return () => URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  const selectPostImage = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      message.error("Choose an image file");
      return;
    }
    if (file.size > 5_000_000) {
      message.error("Image must be 5 MB or smaller");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const requireAuthenticatedUser = () => {
    if (user?._id && localStorage.getItem("token")) return true;
    message.warning("Log in to like, comment, or share posts");
    navigate("/login");
    return false;
  };

  useEffect(() => {
    const keyword = searchQuery.trim();
    if (keyword.length < 2) return undefined;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(
          `${API_URL}/search?q=${encodeURIComponent(keyword)}`,
          { headers: authHeaders() },
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Search failed");
        if (!cancelled) {
          setSearchResults({
            keyword,
            users: data.users || [],
            posts: data.posts || [],
          });
        }
      } catch (error) {
        if (!cancelled) {
          message.error(error.message);
          setSearchResults(null);
        }
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  const getPosts = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError("");
      const response = await fetch(`${API_URL}/post`, {
        headers: authHeaders(),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Failed to fetch posts");
      setPosts(data.posts || []);
    } catch (error) {
      setFetchError(error.message);
    } finally {
      setLoading(false);
    }
  }, [setPosts]);

  const savePost = async () => {
    if (!title.trim() || !description.trim()) {
      message.error("Add a title and description first");
      return;
    }
    try {
      setLoading(true);
      const headers = authHeaders();
      let body;
      if (imageFile) {
        body = new FormData();
        body.append("title", title.trim());
        body.append("description", description.trim());
        body.append("image", imageFile);
      } else {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify({
          title: title.trim(),
          description: description.trim(),
        });
      }
      const response = await fetch(
        `${API_URL}/post${editingId ? `/${editingId}` : ""}`,
        {
          method: editingId ? "PUT" : "POST",
          headers,
          body,
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to save post");
      if (data.post) upsertPost(data.post);
      message.success(editingId ? "Post updated" : "Post published");
      resetEditor();
      if (!data.post) await getPosts();
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const deletePost = async (post) => {
    if (!isPostOwnedBy(post, user?._id)) {
      message.error("Only the post owner can delete this post");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/post/${post._id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Unable to delete post");
      message.success("Post deleted");
      removePost(post._id);
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleLike = async (post) => {
    if (!requireAuthenticatedUser()) return;

    try {
      const wasLiked = Boolean(post.likedByMe);
      patchPost(post._id, {
        likedByMe: !wasLiked,
        likesCount: Math.max(0, (post.likesCount || 0) + (wasLiked ? -1 : 1)),
      });
      const response = await fetch(`${API_URL}/post/${post._id}/like`, {
        method: wasLiked ? "DELETE" : "PUT",
        headers: authHeaders(),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Could not update like");
      if (data.post) upsertPost(data.post);
    } catch (error) {
      patchPost(post._id, {
        likedByMe: post.likedByMe,
        likesCount: post.likesCount,
      });
      message.error(error.message);
    }
  };

  const toggleComments = (postId) => {
    setOpenComments((current) => ({ ...current, [postId]: !current[postId] }));
  };

  const addComment = async (event, post) => {
    event.preventDefault();
    if (!requireAuthenticatedUser()) return;

    const text = (commentDrafts[post._id] || "").trim();
    if (!text) return;

    try {
      const response = await fetch(`${API_URL}/post/${post._id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ text }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Could not add comment");
      setCommentDrafts((current) => ({ ...current, [post._id]: "" }));
      setOpenComments((current) => ({ ...current, [post._id]: true }));
      if (data.post) upsertPost(data.post);
      else await getPosts();
    } catch (error) {
      message.error(error.message);
    }
  };

  const sharePost = async (post) => {
    if (!requireAuthenticatedUser()) return;

    const url = `${window.location.origin}/post/${post._id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: post.title,
          text: post.description,
          url,
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        message.success("Post link copied");
      } else {
        window.prompt("Copy this post link", url);
      }
    } catch (error) {
      if (error.name !== "AbortError")
        message.error("Could not share this post");
    }
  };

  const editPost = (post) => {
    if (!isPostOwnedBy(post, user?._id)) {
      message.error("Only the post owner can edit this post");
      return;
    }

    setEditingId(post._id);
    setTitle(post.title);
    setDescription(post.description);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetEditor = () => {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setImageFile(null);
    setImagePreview("");
  };

  useEffect(() => {
    const timer = setTimeout(getPosts, 0);
    return () => clearTimeout(timer);
  }, [getPosts]);

  useEffect(() => {
    const postAnchor = window.location.hash.slice(1);
    if (!postAnchor.startsWith("post-")) return;

    const timer = setTimeout(() => {
      document
        .getElementById(postAnchor)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    return () => clearTimeout(timer);
  }, [posts]);

  useEffect(() => {
    if (!posts.length) return undefined;

    const cards = [
      ...document.querySelectorAll("[data-post-impression]"),
    ].filter((card) => !viewedPostIds.current.has(card.dataset.postImpression));
    const recordView = (postId) => {
      if (!postId || viewedPostIds.current.has(postId)) return;
      viewedPostIds.current.add(postId);
      fetch(`${API_URL}/post/${postId}/view`, {
        method: "POST",
        headers: authHeaders(),
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (!data) return;
          patchPost(postId, { viewsCount: data.viewsCount });
        })
        .catch(() => {});
    };

    if (!("IntersectionObserver" in window)) {
      cards.forEach((card) => recordView(card.dataset.postImpression));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.6) return;
          observer.unobserve(entry.target);
          recordView(entry.target.dataset.postImpression);
        });
      },
      { threshold: 0.6 },
    );
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [posts, patchPost]);

  return (
    <Layout className="app-layout">
      <Header />
      <Content className="dashboard-content">
        <section className="dashboard-hero">
          <div>
            <Text className="eyebrow">YOUR COMMUNITY SPACE</Text>
            <Title level={1}>
              Make something <em>worth sharing.</em>
            </Title>
            <Paragraph className="hero-copy">
              A quiet corner for your thoughts, ideas, and the conversations
              that matter.
            </Paragraph>
          </div>
          <div className="hero-orbit">
            <span>✦</span>
            <strong>{posts.length}</strong>
            <small>stories shared</small>
          </div>
        </section>

        <section className="feed-search" aria-label="Search users and posts">
          <Input.Search
            placeholder="Search people or posts"
            enterButton
            allowClear
            value={searchQuery}
            loading={isSearching}
            onChange={(event) => updateSearchQuery(event.target.value)}
            onSearch={updateSearchQuery}
          />
          {searchResults && searchResults.keyword === searchQuery.trim() && (
            <Card className="search-results-card" bordered={false}>
              <div className="search-results-heading">
                <div>
                  <Text className="card-kicker">SEARCH RESULTS</Text>
                  <Title level={3}>Results for “{searchResults.keyword}”</Title>
                </div>
                <Button type="text" onClick={() => setSearchResults(null)}>
                  Close
                </Button>
              </div>
              {searchResults.users.length === 0 &&
              searchResults.posts.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No matching people or posts."
                />
              ) : (
                <div className="search-results-grid">
                  <section>
                    <Text strong>People</Text>
                    {searchResults.users.length === 0 ? (
                      <Text type="secondary" className="search-empty-label">
                        No matching users.
                      </Text>
                    ) : (
                      searchResults.users.map((resultUser) => (
                        <Link
                          className="search-user-result"
                          key={resultUser._id}
                          to={`/profile/${resultUser._id}`}
                        >
                          <Avatar
                            src={resultUser.profilePicture || undefined}
                            onError={() => true}
                          >
                            {resultUser.firstname?.[0] || "U"}
                            {resultUser.lastname?.[0] || ""}
                          </Avatar>
                          <Text strong>
                            {resultUser.firstname} {resultUser.lastname}
                          </Text>
                        </Link>
                      ))
                    )}
                  </section>
                  <section>
                    <Text strong>Posts</Text>
                    {searchResults.posts.length === 0 ? (
                      <Text type="secondary" className="search-empty-label">
                        No matching posts.
                      </Text>
                    ) : (
                      searchResults.posts.map((resultPost) => (
                        <Button
                          type="text"
                          className="search-post-result"
                          key={resultPost._id}
                          onClick={() => navigate(`/post/${resultPost._id}`)}
                        >
                          <span>{resultPost.title}</span>
                          <Text type="secondary">
                            {resultPost.author
                              ? `${resultPost.author.firstname} ${resultPost.author.lastname}`
                              : "Former member"}
                          </Text>
                        </Button>
                      ))
                    )}
                  </section>
                </div>
              )}
            </Card>
          )}
        </section>

        <Row gutter={[24, 24]} align="top">
          <Col xs={24} lg={9}>
            <Card className="composer-card" bordered={false}>
              <div className="section-heading">
                <div className="section-icon">
                  <FileTextOutlined />
                </div>
                <div>
                  <Text className="card-kicker">
                    {editingId ? "REFINE YOUR STORY" : "START A CONVERSATION"}
                  </Text>
                  <Title level={3}>
                    {editingId ? "Edit your post" : "What is on your mind?"}
                  </Title>
                </div>
              </div>
              <Input
                className="title-input"
                placeholder="Give it a clear title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={100}
                showCount
              />
              <TextArea
                className="description-input"
                placeholder="Share a thought, an idea, or a moment..."
                autoSize={{ minRows: 6, maxRows: 10 }}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={1000}
                showCount
              />
              <div className="post-image-picker">
                <label
                  className="post-image-picker-button"
                  htmlFor="post-image-input"
                >
                  <PictureOutlined />{" "}
                  {imageFile ? "Change photo" : "Add a photo"}{" "}
                  <span>From your gallery · up to 5 MB</span>
                </label>
                <input
                  id="post-image-input"
                  className="post-image-file-input"
                  type="file"
                  accept="image/*"
                  onChange={selectPostImage}
                />
                {(imagePreview ||
                  (editingId &&
                    posts.find((item) => item._id === editingId)
                      ?.imageUrl)) && (
                  <div className="post-image-preview-wrap">
                    <img
                      className="post-image-preview"
                      src={
                        imagePreview ||
                        posts.find((item) => item._id === editingId)?.imageUrl
                      }
                      alt="Post image preview"
                    />
                    {imageFile && (
                      <Button
                        type="text"
                        danger
                        icon={<CloseCircleOutlined />}
                        onClick={() => {
                          setImageFile(null);
                          setImagePreview("");
                        }}
                      >
                        Remove photo
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <div className="composer-footer">
                <Text type="secondary">Be kind. Be curious.</Text>
                <Space>
                  {editingId && <Button onClick={resetEditor}>Cancel</Button>}
                  <Button
                    type="primary"
                    icon={editingId ? <EditOutlined /> : <SendOutlined />}
                    loading={loading}
                    onClick={savePost}
                  >
                    {editingId ? "Save changes" : "Publish post"}
                  </Button>
                </Space>
              </div>
            </Card>
            <Row gutter={12} className="stats-row">
              <Col span={12}>
                <Card bordered={false}>
                  <Statistic title="Total stories" value={posts.length} />
                </Card>
              </Col>
              <Col span={12}>
                <Card bordered={false}>
                  <Statistic
                    title="Your space"
                    value="Open"
                    valueStyle={{ color: "#2c8066", fontSize: 23 }}
                  />
                </Card>
              </Col>
            </Row>
          </Col>

          <Col xs={24} lg={15}>
            <div className="feed-heading">
              <div>
                <Text className="card-kicker">THE LATEST</Text>
                <Title level={2}>Community feed</Title>
              </div>
              <Button type="text" onClick={getPosts}>
                Refresh
              </Button>
            </div>
            {fetchError && (
              <Alert
                message="Could not load your feed"
                description={
                  fetchError === "unauthorized"
                    ? "Log in first to see and create posts."
                    : fetchError
                }
                type="warning"
                showIcon
                action={
                  fetchError === "unauthorized" && (
                    <Button size="small" onClick={() => navigate("/login")}>
                      Log in
                    </Button>
                  )
                }
              />
            )}
            <div className="feed-list">
              {loading && posts.length === 0 ? (
                [1, 2, 3].map((item) => (
                  <Card
                    key={item}
                    className="post-card skeleton-card"
                    bordered={false}
                  >
                    <Skeleton active paragraph={{ rows: 3 }} />
                  </Card>
                ))
              ) : posts.length === 0 ? (
                <Card bordered={false} className="empty-card">
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="Your feed is waiting for its first story."
                  />
                </Card>
              ) : (
                posts.map((post) => {
                  const authorId =
                    typeof post.author === "string"
                      ? post.author
                      : post.author?._id;
                  const postAuthor =
                    post.author && typeof post.author === "object"
                      ? post.author
                      : user?._id && String(user._id) === String(authorId)
                        ? user
                        : null;
                  const isOwnPost = isPostOwnedBy(post, user?._id);
                  const postedAt = post.createdAt
                    ? new Date(post.createdAt)
                    : null;
                  const fullName = postAuthor
                    ? `${postAuthor.firstname || ""} ${postAuthor.lastname || ""}`.trim()
                    : "Former member";
                  const actionItems = [
                    { key: "edit", label: "Edit post", icon: <EditOutlined /> },
                    {
                      key: "delete",
                      label: "Delete post",
                      danger: true,
                      icon: <DeleteOutlined />,
                    },
                  ];
                  const handlePostAction = ({ key }) => {
                    if (key === "edit") {
                      editPost(post);
                    } else if (key === "delete") {
                      Modal.confirm({
                        title: "Delete this post?",
                        content: "This cannot be undone.",
                        okText: "Delete",
                        cancelText: "Keep it",
                        okButtonProps: { danger: true },
                        onOk: () => deletePost(post),
                      });
                    }
                  };
                  const comments = post.comments || [];
                  return (
                    <Card
                      id={`post-${post._id}`}
                      data-post-impression={post._id}
                      key={post._id}
                      className="post-card"
                      bordered={false}
                    >
                      <div className="post-meta">
                        {postAuthor?._id ? (
                          <Link
                            className="post-author-avatar-link"
                            to={`/profile/${postAuthor._id}`}
                            aria-label={`View ${fullName}'s profile`}
                          >
                            <Avatar
                              className="post-avatar"
                              src={postAuthor.profilePicture || undefined}
                              alt={`${fullName} profile picture`}
                              onError={() => true}
                            >
                              {postAuthor.firstname?.[0] || "U"}
                              {postAuthor.lastname?.[0] || ""}
                            </Avatar>
                          </Link>
                        ) : (
                          <Avatar className="post-avatar">U</Avatar>
                        )}
                        <div className="post-author-meta">
                          {postAuthor?._id ? (
                            <Link
                              className="post-author-name-link"
                              to={`/profile/${postAuthor._id}`}
                            >
                              <Text strong className="post-author-name">
                                {fullName}
                              </Text>
                            </Link>
                          ) : (
                            <Text strong className="post-author-name">
                              {fullName}
                            </Text>
                          )}
                          <br />
                          <Tooltip
                            title={
                              postedAt && !Number.isNaN(postedAt.getTime())
                                ? postedAt.toLocaleString()
                                : "Post time unavailable"
                            }
                          >
                            <Text type="secondary" className="post-time">
                              <time
                                dateTime={
                                  postedAt && !Number.isNaN(postedAt.getTime())
                                    ? postedAt.toISOString()
                                    : undefined
                                }
                              >
                                {formatPostTime(postedAt)}
                              </time>{" "}
                              · {post.viewsCount || 0} views
                            </Text>
                          </Tooltip>
                        </div>
                        {isOwnPost && (
                          <Dropdown
                            menu={{
                              items: actionItems,
                              onClick: handlePostAction,
                            }}
                            trigger={["click"]}
                            placement="bottomRight"
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
                      <div className="post-social-actions">
                        <Button
                          type="default"
                          className={`social-action${post.likedByMe ? " is-liked" : ""}`}
                          icon={
                            post.likedByMe ? <LikeFilled /> : <LikeOutlined />
                          }
                          onClick={() => toggleLike(post)}
                          aria-pressed={Boolean(post.likedByMe)}
                        >
                          Like <span>{post.likesCount || 0}</span>
                        </Button>
                        <Button
                          type="default"
                          className="social-action"
                          icon={<MessageOutlined />}
                          onClick={() => toggleComments(post._id)}
                          aria-expanded={Boolean(openComments[post._id])}
                        >
                          Comment <span>{comments.length}</span>
                        </Button>
                        <Button
                          type="default"
                          className="social-action"
                          icon={<ShareAltOutlined />}
                          onClick={() => sharePost(post)}
                        >
                          Share
                        </Button>
                        <Button
                          type="default"
                          className="social-action view-full-post-button"
                          icon={<EyeOutlined />}
                          onClick={() => navigate(`/post/${post._id}`)}
                        >
                          View full post
                        </Button>
                      </div>
                      {openComments[post._id] && (
                        <section
                          className="post-comments"
                          aria-label="Post comments"
                        >
                          {comments.length > 0 && (
                            <div className="comment-list">
                              {comments.map((comment) => {
                                const commenter = comment.user;
                                const commenterName = commenter
                                  ? `${commenter.firstname || ""} ${commenter.lastname || ""}`.trim()
                                  : "Former member";
                                return (
                                  <div
                                    className="post-comment"
                                    key={comment._id}
                                  >
                                    {commenter?._id ? (
                                      <Link
                                        to={`/profile/${commenter._id}`}
                                        aria-label={`View ${commenterName}'s profile`}
                                      >
                                        <Avatar
                                          size={34}
                                          src={
                                            commenter.profilePicture ||
                                            undefined
                                          }
                                          onError={() => true}
                                        >
                                          {commenter.firstname?.[0] || "U"}
                                          {commenter.lastname?.[0] || ""}
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
                                          <Text strong>{commenterName}</Text>
                                        </Link>
                                      ) : (
                                        <Text strong>{commenterName}</Text>
                                      )}
                                      <Paragraph>{comment.text}</Paragraph>
                                      <Text
                                        type="secondary"
                                        className="comment-time"
                                      >
                                        {formatPostTime(
                                          new Date(comment.createdAt),
                                        )}
                                      </Text>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          <form
                            className="comment-composer"
                            onSubmit={(event) => addComment(event, post)}
                          >
                            <Input.TextArea
                              value={commentDrafts[post._id] || ""}
                              onChange={(event) =>
                                setCommentDrafts((current) => ({
                                  ...current,
                                  [post._id]: event.target.value,
                                }))
                              }
                              placeholder="Write a comment..."
                              maxLength={1000}
                              autoSize={{ minRows: 1, maxRows: 4 }}
                              aria-label={`Comment on ${post.title}`}
                            />
                            <Button
                              type="primary"
                              htmlType="submit"
                              icon={<SendOutlined />}
                              disabled={!(commentDrafts[post._id] || "").trim()}
                            >
                              Post
                            </Button>
                          </form>
                        </section>
                      )}
                    </Card>
                  );
                })
              )}
            </div>
          </Col>
        </Row>
      </Content>
    </Layout>
  );
}

export default Post;
