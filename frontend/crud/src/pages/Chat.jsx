import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";
import {
  Avatar,
  Button,
  Card,
  Checkbox,
  Empty,
  Input,
  Layout,
  List,
  Modal,
  Popconfirm,
  Popover,
  Skeleton,
  Tooltip,
  Typography,
  message,
} from "antd";
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  MessageOutlined,
  PictureOutlined,
  PlusOutlined,
  SendOutlined,
  SmileOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import Header from "../components/Header";
import { store } from "../store/states";
import { baseUrl } from "../core";
import "../App.css";

const { Content } = Layout;
const { Text, Title } = Typography;
const apiUrl = baseUrl + "/api/v1";
const quickReactions = ["❤️", "😂", "😮", "😢", "👍", "🔥"];
const authHeaders = () => ({
  Authorization: "Bearer " + (localStorage.getItem("token") || ""),
});

const apiRequest = async (path, options = {}) => {
  const response = await fetch(apiUrl + path, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Chat request failed");
  return data;
};

const fullName = (person) =>
  [person?.firstname, person?.lastname].filter(Boolean).join(" ") ||
  "Circle member";
const readableTime = (value) =>
  value
    ? new Date(value).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
const idOf = (value) => String(value?._id || value || "");

export default function Chat() {
  const currentUser = store((state) => state.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [conversationSearch, setConversationSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingName, setTypingName] = useState("");
  const [directModalOpen, setDirectModalOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupBeingEdited, setGroupBeingEdited] = useState(null);
  const [groupName, setGroupName] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [savingGroup, setSavingGroup] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState("");
  const socketRef = useRef(null);
  const selectedRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimerRef = useRef(null);
  const messageLoadSequence = useRef(0);

  const loadConversations = useCallback(async () => {
    try {
      const data = await apiRequest("/conversations");
      setConversations(data.conversations || []);
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (conversationId) => {
    const requestSequence = ++messageLoadSequence.current;
    setLoadingMessages(true);
    try {
      const [data] = await Promise.all([
        apiRequest("/conversations/" + conversationId + "/messages"),
        apiRequest("/conversations/" + conversationId + "/read", {
          method: "PUT",
        }),
      ]);
      if (requestSequence !== messageLoadSequence.current) return;
      const loadedMessages = data.messages || [];
      const loadedIds = new Set(loadedMessages.map((item) => idOf(item)));
      setMessages((current) =>
        [
          ...loadedMessages,
          ...current.filter(
            (item) =>
              idOf(item.conversation) === conversationId &&
              !loadedIds.has(idOf(item)),
          ),
        ].sort(
          (left, right) => new Date(left.createdAt) - new Date(right.createdAt),
        ),
      );
      setConversations((current) =>
        current.map((item) =>
          idOf(item) === conversationId ? { ...item, unreadCount: 0 } : item,
        ),
      );
    } catch (error) {
      if (requestSequence === messageLoadSequence.current)
        message.error(error.message);
    } finally {
      if (requestSequence === messageLoadSequence.current)
        setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadConversations, 0);
    const interval = window.setInterval(loadConversations, 15000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [loadConversations]);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    const socket = io(baseUrl, {
      auth: { token: localStorage.getItem("token") || "" },
    });
    socketRef.current = socket;
    socket.on("connect", () => {
      if (selectedRef.current?._id)
        socket.emit("join-conversation", selectedRef.current._id);
    });
    socket.on("online-users", (ids) => setOnlineUsers(new Set(ids || [])));
    socket.on("conversation-online-users", ({ userIds }) =>
      setOnlineUsers(new Set(userIds || [])),
    );
    socket.on("presence", ({ userId, online }) =>
      setOnlineUsers((current) => {
        const next = new Set(current);
        if (online) next.add(userId);
        else next.delete(userId);
        return next;
      }),
    );
    socket.on("new-message", (incoming) => {
      const conversationId = idOf(incoming.conversation);
      if (idOf(selectedRef.current) === conversationId) {
        setMessages((current) =>
          current.some((item) => idOf(item) === idOf(incoming))
            ? current
            : [...current, incoming],
        );
        if (idOf(incoming.sender) !== idOf(currentUser?._id)) {
          apiRequest("/conversations/" + conversationId + "/read", {
            method: "PUT",
          }).catch(() => {});
        }
      }
      loadConversations();
    });
    socket.on("message-updated", (updated) => {
      if (idOf(selectedRef.current) === idOf(updated.conversation)) {
        setMessages((current) =>
          current.map((item) =>
            idOf(item) === idOf(updated) ? updated : item,
          ),
        );
      }
      loadConversations();
    });
    socket.on("read-receipt", ({ userId }) => {
      setMessages((current) =>
        current.map((item) =>
          idOf(item.sender) === idOf(currentUser?._id)
            ? {
                ...item,
                readBy: [
                  ...new Set([...(item.readBy || []).map(idOf), userId]),
                ],
              }
            : item,
        ),
      );
    });
    socket.on("typing", (payload) => {
      if (
        idOf(selectedRef.current) !== payload.conversationId ||
        idOf(currentUser?._id) === payload.userId
      )
        return;
      setTypingName(payload.isTyping ? payload.name : "");
      window.clearTimeout(typingTimerRef.current);
      if (payload.isTyping)
        typingTimerRef.current = window.setTimeout(
          () => setTypingName(""),
          1800,
        );
    });
    socket.on("conversation-created", loadConversations);
    socket.on("chat-list-updated", loadConversations);
    socket.on("conversation-updated", (updated) => {
      setConversations((current) =>
        current.map((item) =>
          idOf(item) === idOf(updated) ? { ...item, ...updated } : item,
        ),
      );
      setSelected((current) =>
        idOf(current) === idOf(updated) ? { ...current, ...updated } : current,
      );
    });
    socket.on("conversation-removed", ({ conversationId }) => {
      socket.emit("leave-conversation", conversationId);
      setConversations((current) =>
        current.filter((item) => idOf(item) !== conversationId),
      );
      if (idOf(selectedRef.current) === conversationId) {
        setSelected(null);
        setMessages([]);
      }
    });
    return () => {
      window.clearTimeout(typingTimerRef.current);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [currentUser?._id, loadConversations]);

  const activeConversationId = idOf(selected);
  useEffect(() => {
    if (!activeConversationId) {
      const clearTimer = window.setTimeout(() => setMessages([]), 0);
      return () => window.clearTimeout(clearTimer);
    }
    const conversationId = activeConversationId;
    socketRef.current?.emit("join-conversation", conversationId);
    const timer = window.setTimeout(() => loadMessages(conversationId), 0);
    return () => {
      window.clearTimeout(timer);
      messageLoadSequence.current += 1;
      socketRef.current?.emit("leave-conversation", conversationId);
    };
  }, [activeConversationId, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, typingName]);

  const openDirectChat = useCallback(
    async (userId) => {
      try {
        const data = await apiRequest("/conversations/direct", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
        const conversation = data.conversation;
        setSelected(conversation);
        setConversations((current) => [
          conversation,
          ...current.filter((item) => idOf(item) !== idOf(conversation)),
        ]);
        setDirectModalOpen(false);
        setSearchParams({}, { replace: true });
      } catch (error) {
        message.error(error.message);
      }
    },
    [setSearchParams],
  );

  useEffect(() => {
    const targetId = searchParams.get("userId");
    if (!targetId) return undefined;
    const timer = window.setTimeout(() => openDirectChat(targetId), 0);
    return () => window.clearTimeout(timer);
  }, [searchParams, openDirectChat]);

  useEffect(() => {
    if (userSearch.trim().length < 2) {
      const timer = window.setTimeout(() => {
        setUserResults([]);
        setIsSearchingUsers(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setIsSearchingUsers(true);
      try {
        const data = await apiRequest(
          "/search?q=" + encodeURIComponent(userSearch.trim()),
        );
        if (!cancelled) setUserResults(data.users || []);
      } catch {
        if (!cancelled) setUserResults([]);
      } finally {
        if (!cancelled) setIsSearchingUsers(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [userSearch]);

  const visibleConversations = useMemo(
    () =>
      conversations.filter((conversation) => {
        const label = conversation.isGroup
          ? conversation.groupName
          : fullName(
              conversation.participants.find(
                (person) => idOf(person) !== idOf(currentUser?._id),
              ),
            );
        return label.toLowerCase().includes(conversationSearch.toLowerCase());
      }),
    [conversations, conversationSearch, currentUser?._id],
  );

  const getConversationName = (conversation) =>
    conversation?.isGroup
      ? conversation.groupName || "Group chat"
      : fullName(
          conversation?.participants?.find(
            (person) => idOf(person) !== idOf(currentUser?._id),
          ),
        );

  const startTyping = (value) => {
    setDraft(value);
    const conversationId = idOf(selected);
    if (conversationId)
      socketRef.current?.emit("typing", {
        conversationId,
        isTyping: Boolean(value.trim()),
      });
    window.clearTimeout(typingTimerRef.current);
    if (value.trim()) {
      typingTimerRef.current = window.setTimeout(() => {
        socketRef.current?.emit("typing", { conversationId, isTyping: false });
      }, 900);
    }
  };

  const sendText = async (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !selected?._id || sending) return;
    setSending(true);
    try {
      if (editingMessageId) {
        const data = await apiRequest("/messages/" + editingMessageId, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        setMessages((current) =>
          current.map((item) =>
            idOf(item) === editingMessageId ? data.message : item,
          ),
        );
        setEditingMessageId("");
      } else {
        const data = await apiRequest(
          "/conversations/" + selected._id + "/messages",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
          },
        );
        setMessages((current) =>
          current.some((item) => idOf(item) === idOf(data.message))
            ? current
            : [...current, data.message],
        );
      }
      setDraft("");
      socketRef.current?.emit("typing", {
        conversationId: selected._id,
        isTyping: false,
      });
      await loadConversations();
    } catch (error) {
      message.error(error.message);
    } finally {
      setSending(false);
    }
  };

  const sendImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selected?._id) return;
    if (!file.type.startsWith("image/"))
      return message.error("Choose an image file");
    if (file.size > 5_000_000)
      return message.error("Image must be 5 MB or smaller");
    const formData = new FormData();
    formData.append("image", file);
    const caption = draft.trim();
    if (caption) formData.append("text", caption);
    setSending(true);
    try {
      const data = await apiRequest(
        "/conversations/" + selected._id + "/messages/image",
        { method: "POST", body: formData },
      );
      setMessages((current) =>
        current.some((item) => idOf(item) === idOf(data.message))
          ? current
          : [...current, data.message],
      );
      setDraft("");
      await loadConversations();
    } catch (error) {
      message.error(error.message);
    } finally {
      setSending(false);
    }
  };

  const deleteMessage = async (item) => {
    try {
      const data = await apiRequest("/messages/" + item._id, {
        method: "DELETE",
      });
      setMessages((current) =>
        current.map((messageItem) =>
          idOf(messageItem) === idOf(item) ? data.message : messageItem,
        ),
      );
    } catch (error) {
      message.error(error.message);
    }
  };

  const toggleReaction = async (item, emoji) => {
    try {
      const data = await apiRequest(
        "/conversations/" +
          selected._id +
          "/messages/" +
          item._id +
          "/reaction",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji }),
        },
      );
      setMessages((current) =>
        current.map((messageItem) =>
          idOf(messageItem) === idOf(item) ? data.message : messageItem,
        ),
      );
    } catch (error) {
      message.error(error.message);
    }
  };

  const openNewGroup = () => {
    setGroupBeingEdited(null);
    setGroupName("");
    setSelectedUserIds([]);
    setUserSearch("");
    setUserResults([]);
    setGroupModalOpen(true);
  };

  const openGroupSettings = () => {
    setGroupBeingEdited(selected);
    setGroupName(selected.groupName || "");
    setSelectedUserIds([]);
    setUserSearch("");
    setUserResults([]);
    setGroupModalOpen(true);
  };

  const saveGroup = async () => {
    if (savingGroup) return;
    setSavingGroup(true);
    try {
      if (groupBeingEdited) {
        if (groupName.trim() !== groupBeingEdited.groupName) {
          await apiRequest("/conversations/" + groupBeingEdited._id, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: groupName.trim() }),
          });
        }
        if (selectedUserIds.length) {
          await apiRequest(
            "/conversations/" + groupBeingEdited._id + "/members",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ memberIds: selectedUserIds }),
            },
          );
        }
        message.success("Group updated");
      } else {
        const data = await apiRequest("/conversations/group", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: groupName.trim(),
            memberIds: selectedUserIds,
          }),
        });
        setSelected(data.conversation);
        message.success("Group created");
      }
      setGroupModalOpen(false);
      await loadConversations();
    } catch (error) {
      message.error(error.message);
    } finally {
      setSavingGroup(false);
    }
  };

  const removeGroupMember = async (memberId) => {
    try {
      const data = await apiRequest(
        "/conversations/" + selected._id + "/members/" + memberId,
        { method: "DELETE" },
      );
      if (idOf(memberId) === idOf(currentUser?._id)) {
        setGroupModalOpen(false);
        socketRef.current?.emit("leave-conversation", selected._id);
        setSelected(null);
        await loadConversations();
        return;
      }
      setSelected(data.conversation);
      setGroupBeingEdited(data.conversation);
      await loadConversations();
    } catch (error) {
      message.error(error.message);
    }
  };

  const isGroupAdmin = (conversation) =>
    conversation?.admins?.some(
      (admin) => idOf(admin) === idOf(currentUser?._id),
    );
  const filteredUsers = userResults.filter(
    (item) => idOf(item) !== idOf(currentUser?._id),
  );
  const selectedParticipant = selected?.participants?.find(
    (person) => idOf(person) !== idOf(currentUser?._id),
  );
  const isDirectOnline = Boolean(
    selectedParticipant && onlineUsers.has(idOf(selectedParticipant)),
  );

  return (
    <Layout className="app-layout">
      <Header />
      <Content className="dashboard-content chat-page-content">
        <div className="chat-page-heading">
          <div>
            <Text className="eyebrow">YOUR INBOX</Text>
            <Title level={1}>Messages</Title>
            <Text type="secondary">Private conversations and group chats.</Text>
          </div>
        </div>
        <Card
          className={"chat-shell" + (selected ? " has-selected-chat" : "")}
          bordered={false}
          bodyStyle={{ padding: 0 }}
        >
          <aside className="chat-sidebar">
            <div className="chat-sidebar-heading">
              <Title level={3}>Inbox</Title>
              <div className="chat-new-actions">
                <Tooltip title="Start a direct chat">
                  <Button
                    aria-label="Start a chat"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      setUserSearch("");
                      setUserResults([]);
                      setDirectModalOpen(true);
                    }}
                  />
                </Tooltip>
                <Tooltip title="Create a group">
                  <Button
                    aria-label="Create a group"
                    icon={<TeamOutlined />}
                    onClick={openNewGroup}
                  />
                </Tooltip>
              </div>
            </div>
            <Input.Search
              placeholder="Search chats"
              value={conversationSearch}
              allowClear
              onChange={(event) => setConversationSearch(event.target.value)}
            />
            <div className="chat-conversation-list">
              {loading ? (
                <Skeleton active paragraph={{ rows: 4 }} />
              ) : visibleConversations.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No chats yet"
                />
              ) : (
                visibleConversations.map((conversation) => {
                  const participant = conversation.participants.find(
                    (person) => idOf(person) !== idOf(currentUser?._id),
                  );
                  const name = getConversationName(conversation);
                  const avatar = conversation.isGroup
                    ? null
                    : participant?.profilePicture;
                  const preview = conversation.lastMessage?.deletedAt
                    ? "Message deleted"
                    : conversation.lastMessage?.imageUrl
                      ? "📷 Photo"
                      : conversation.lastMessage?.text ||
                        "Start a conversation";
                  return (
                    <button
                      type="button"
                      key={conversation._id}
                      className={
                        "chat-conversation-item" +
                        (idOf(selected) === idOf(conversation)
                          ? " is-selected"
                          : "")
                      }
                      onClick={() => setSelected(conversation)}
                    >
                      <Avatar
                        src={avatar || undefined}
                        icon={
                          conversation.isGroup ? <TeamOutlined /> : undefined
                        }
                      >
                        {!conversation.isGroup && name[0]}
                      </Avatar>
                      <span className="chat-conversation-copy">
                        <strong>{name}</strong>
                        <small>{preview}</small>
                      </span>
                      <span className="chat-conversation-meta">
                        {conversation.lastMessage?.createdAt && (
                          <small>
                            {readableTime(conversation.lastMessage.createdAt)}
                          </small>
                        )}
                        {conversation.unreadCount > 0 && (
                          <b>{conversation.unreadCount}</b>
                        )}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <section className="chat-thread">
            {!selected ? (
              <div className="chat-empty-state">
                <div className="chat-empty-icon">
                  <MessageOutlined />
                </div>
                <Title level={3}>Your messages</Title>
                <Text type="secondary">
                  Choose a conversation or start a new one.
                </Text>
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={() => {
                    setUserSearch("");
                    setDirectModalOpen(true);
                  }}
                >
                  Send a message
                </Button>
              </div>
            ) : (
              <>
                <header className="chat-thread-header">
                  <div className="chat-thread-person">
                    <Button
                      className="chat-thread-back"
                      type="text"
                      icon={<ArrowLeftOutlined />}
                      onClick={() => setSelected(null)}
                      aria-label="Back to inbox"
                    />
                    <Avatar
                      src={
                        !selected.isGroup
                          ? selectedParticipant?.profilePicture || undefined
                          : undefined
                      }
                      icon={selected.isGroup ? <TeamOutlined /> : undefined}
                    >
                      {!selected.isGroup && getConversationName(selected)[0]}
                    </Avatar>
                    <div>
                      <strong>{getConversationName(selected)}</strong>
                      <small>
                        {selected.isGroup
                          ? selected.participants.length + " members"
                          : isDirectOnline
                            ? "Active now"
                            : "Direct message"}
                      </small>
                    </div>
                  </div>
                  {selected.isGroup && (
                    <Button icon={<EditOutlined />} onClick={openGroupSettings}>
                      Group details
                    </Button>
                  )}
                </header>
                <div className="chat-message-list">
                  {loadingMessages ? (
                    <Skeleton active paragraph={{ rows: 6 }} />
                  ) : messages.length === 0 ? (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="Say hello to start this chat"
                    />
                  ) : (
                    messages.map((item) => {
                      const mine = idOf(item.sender) === idOf(currentUser?._id);
                      const deleted = Boolean(item.deletedAt);
                      const reactions = item.reactions || [];
                      const seenCount = (item.readBy || []).filter(
                        (reader) => idOf(reader) !== idOf(item.sender),
                      ).length;
                      return (
                        <div
                          key={item._id}
                          className={
                            "chat-message-row" + (mine ? " is-mine" : "")
                          }
                        >
                          {!mine && (
                            <Avatar
                              size={30}
                              src={item.sender?.profilePicture || undefined}
                            >
                              {item.sender?.firstname?.[0] || "U"}
                            </Avatar>
                          )}
                          <div className="chat-message-content">
                            {!mine && selected.isGroup && (
                              <small className="chat-message-sender">
                                {fullName(item.sender)}
                              </small>
                            )}
                            <div
                              className={
                                "chat-bubble" + (mine ? " is-mine" : "")
                              }
                            >
                              {deleted ? (
                                <Text type="secondary">
                                  <i>This message was deleted</i>
                                </Text>
                              ) : (
                                <>
                                  {item.imageUrl && (
                                    <a
                                      href={item.imageUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      <img
                                        className="chat-message-image"
                                        src={item.imageUrl}
                                        alt="Shared in chat"
                                      />
                                    </a>
                                  )}
                                  {item.text && <span>{item.text}</span>}
                                </>
                              )}
                              <small>
                                {readableTime(item.createdAt)}
                                {item.editedAt && !deleted ? " · edited" : ""}
                              </small>
                            </div>
                            {reactions.length > 0 && (
                              <div className="chat-reactions">
                                {reactions.map((reaction) => (
                                  <button
                                    type="button"
                                    key={reaction.emoji}
                                    onClick={() =>
                                      toggleReaction(item, reaction.emoji)
                                    }
                                  >
                                    {reaction.emoji}{" "}
                                    {reaction.users?.length || 0}
                                  </button>
                                ))}
                              </div>
                            )}
                            <div className="chat-message-tools">
                              {!deleted && (
                                <Popover
                                  trigger="click"
                                  content={
                                    <div className="chat-reaction-picker">
                                      {quickReactions.map((emoji) => (
                                        <button
                                          type="button"
                                          key={emoji}
                                          onClick={() =>
                                            toggleReaction(item, emoji)
                                          }
                                        >
                                          {emoji}
                                        </button>
                                      ))}
                                    </div>
                                  }
                                >
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<SmileOutlined />}
                                    aria-label="React to message"
                                  />
                                </Popover>
                              )}
                              {mine && !deleted && (
                                <Popover
                                  trigger="click"
                                  content={
                                    <div className="chat-message-menu">
                                      {item.text && (
                                        <Button
                                          type="text"
                                          icon={<EditOutlined />}
                                          onClick={() => {
                                            setDraft(item.text);
                                            setEditingMessageId(item._id);
                                            document
                                              .getElementById(
                                                "chat-message-input",
                                              )
                                              ?.focus();
                                          }}
                                        >
                                          Edit message
                                        </Button>
                                      )}
                                      <Popconfirm
                                        title="Delete this message for everyone?"
                                        onConfirm={() => deleteMessage(item)}
                                      >
                                        <Button
                                          danger
                                          type="text"
                                          icon={<DeleteOutlined />}
                                        >
                                          Delete message
                                        </Button>
                                      </Popconfirm>
                                    </div>
                                  }
                                >
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<EditOutlined />}
                                    aria-label="Message options"
                                  />
                                </Popover>
                              )}
                            </div>
                            {mine && seenCount > 0 && (
                              <small className="chat-seen-label">
                                {selected.isGroup
                                  ? "Seen by " + seenCount
                                  : "Seen"}
                              </small>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  {typingName && (
                    <div className="chat-typing-indicator">
                      {typingName} is typing…
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <form className="chat-composer" onSubmit={sendText}>
                  {editingMessageId && (
                    <div className="chat-editing-hint">
                      <span>Editing message</span>
                      <Button
                        type="text"
                        size="small"
                        onClick={() => {
                          setEditingMessageId("");
                          setDraft("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                  <label className="chat-attach-button" title="Send a photo">
                    <PictureOutlined />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={sendImage}
                      aria-label="Attach a photo"
                    />
                  </label>
                  <Input.TextArea
                    id="chat-message-input"
                    value={draft}
                    onChange={(event) => startTyping(event.target.value)}
                    placeholder="Write a message..."
                    autoSize={{ minRows: 1, maxRows: 5 }}
                    maxLength={5000}
                  />
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SendOutlined />}
                    disabled={!draft.trim() || sending}
                    loading={sending}
                  >
                    Send
                  </Button>
                </form>
              </>
            )}
          </section>
        </Card>

        <Modal
          open={directModalOpen}
          title="Start a message"
          footer={null}
          onCancel={() => setDirectModalOpen(false)}
        >
          <Input.Search
            autoFocus
            placeholder="Find people by name"
            value={userSearch}
            allowClear
            loading={isSearchingUsers}
            onChange={(event) => setUserSearch(event.target.value)}
          />
          <List
            className="chat-user-results"
            dataSource={filteredUsers}
            locale={{
              emptyText:
                userSearch.length >= 2
                  ? "No people found"
                  : "Search by name to find someone",
            }}
            renderItem={(person) => (
              <List.Item
                actions={[
                  <Button
                    key="message"
                    type="primary"
                    onClick={() => openDirectChat(person._id)}
                  >
                    Message
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar src={person.profilePicture || undefined}>
                      {person.firstname?.[0] || "U"}
                    </Avatar>
                  }
                  title={fullName(person)}
                />
              </List.Item>
            )}
          />
        </Modal>

        <Modal
          open={groupModalOpen}
          title={groupBeingEdited ? "Group details" : "Create a group"}
          okText={groupBeingEdited ? "Save changes" : "Create group"}
          cancelText="Cancel"
          confirmLoading={savingGroup}
          okButtonProps={{
            disabled: groupBeingEdited
              ? !isGroupAdmin(groupBeingEdited) || !groupName.trim()
              : groupName.trim().length < 2 || selectedUserIds.length < 2,
          }}
          onCancel={() => setGroupModalOpen(false)}
          onOk={saveGroup}
        >
          <div className="chat-group-form">
            {(!groupBeingEdited || isGroupAdmin(groupBeingEdited)) && (
              <Input
                value={groupName}
                maxLength={60}
                onChange={(event) => setGroupName(event.target.value)}
                placeholder="Group name"
              />
            )}
            {groupBeingEdited && (
              <section className="chat-member-list">
                <Text strong>
                  Members · {groupBeingEdited.participants.length}
                </Text>
                {groupBeingEdited.participants.map((person) => {
                  const canRemove =
                    isGroupAdmin(groupBeingEdited) ||
                    idOf(person) === idOf(currentUser?._id);
                  return (
                    <div className="chat-member-row" key={person._id}>
                      <Avatar
                        size={30}
                        src={person.profilePicture || undefined}
                      >
                        {person.firstname?.[0] || "U"}
                      </Avatar>
                      <span>
                        {fullName(person)}
                        {idOf(person) === idOf(currentUser?._id)
                          ? " (you)"
                          : ""}
                      </span>
                      {canRemove && (
                        <Popconfirm
                          title={
                            idOf(person) === idOf(currentUser?._id)
                              ? "Leave this group?"
                              : "Remove this member?"
                          }
                          onConfirm={() => removeGroupMember(person._id)}
                        >
                          <Button type="text" danger size="small">
                            {idOf(person) === idOf(currentUser?._id)
                              ? "Leave"
                              : "Remove"}
                          </Button>
                        </Popconfirm>
                      )}
                    </div>
                  );
                })}
              </section>
            )}
            {(!groupBeingEdited || isGroupAdmin(groupBeingEdited)) && (
              <>
                <Input.Search
                  placeholder={
                    groupBeingEdited
                      ? "Add people to this group"
                      : "Find group members"
                  }
                  value={userSearch}
                  allowClear
                  loading={isSearchingUsers}
                  onChange={(event) => setUserSearch(event.target.value)}
                />
                {filteredUsers.length > 0 && (
                  <div className="chat-group-user-list">
                    {filteredUsers.map((person) => (
                      <Checkbox
                        key={person._id}
                        checked={selectedUserIds.includes(person._id)}
                        onChange={(event) =>
                          setSelectedUserIds((current) =>
                            event.target.checked
                              ? [...current, person._id]
                              : current.filter((id) => id !== person._id),
                          )
                        }
                      >
                        <Avatar
                          size={28}
                          src={person.profilePicture || undefined}
                        >
                          {person.firstname?.[0] || "U"}
                        </Avatar>{" "}
                        {fullName(person)}
                      </Checkbox>
                    ))}
                  </div>
                )}
                {userSearch.length >= 2 && filteredUsers.length === 0 && (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="No people found"
                  />
                )}
              </>
            )}
          </div>
        </Modal>
      </Content>
    </Layout>
  );
}
