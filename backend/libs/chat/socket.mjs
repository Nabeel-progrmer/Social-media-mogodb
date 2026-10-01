import jwt from "jsonwebtoken";
import { isValidObjectId } from "mongoose";
import { UserModel } from "../models/users/index.mjs";
import { ConversationModel } from "../models/chat.mjs";

const conversationRoom = (id) => "conversation:" + id;
const userRoom = (id) => "user:" + id;
const onlineUsers = new Map();

export const attachChatSockets = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("unauthorized"));
      const decoded = jwt.verify(token, process.env.JWT_KEY);
      const user = await UserModel.findById(decoded._id).select(
        "_id firstname lastname",
      );
      if (!user) return next(new Error("unauthorized"));
      socket.data.user = {
        id: String(user._id),
        firstname: user.firstname,
        lastname: user.lastname,
      };
      return next();
    } catch {
      return next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;
    const sockets = onlineUsers.get(user.id) || new Set();
    sockets.add(socket.id);
    onlineUsers.set(user.id, sockets);
    socket.join(userRoom(user.id));
    socket.emit("online-users", [...onlineUsers.keys()]);
    if (sockets.size === 1)
      io.emit("presence", { userId: user.id, online: true });

    socket.on("join-conversation", async (conversationId) => {
      if (!isValidObjectId(conversationId)) return;
      const conversation = await ConversationModel.findOne({
        _id: conversationId,
        participants: user.id,
      }).select("participants");
      if (!conversation) return;
      socket.join(conversationRoom(conversationId));
      socket.data.conversations ||= new Set();
      socket.data.conversations.add(String(conversationId));
      socket.emit("conversation-online-users", {
        conversationId: String(conversationId),
        userIds: conversation.participants
          .map(String)
          .filter((userId) => onlineUsers.has(userId)),
      });
    });

    socket.on("leave-conversation", (conversationId) => {
      if (!isValidObjectId(conversationId)) return;
      socket.leave(conversationRoom(conversationId));
      socket.data.conversations?.delete(String(conversationId));
    });

    socket.on("typing", ({ conversationId, isTyping } = {}) => {
      if (
        !conversationId ||
        !socket.data.conversations?.has(String(conversationId))
      )
        return;
      socket.to(conversationRoom(conversationId)).emit("typing", {
        conversationId: String(conversationId),
        userId: user.id,
        name: user.firstname,
        isTyping: Boolean(isTyping),
      });
    });

    socket.on("disconnect", () => {
      const current = onlineUsers.get(user.id);
      current?.delete(socket.id);
      if (current?.size === 0) {
        onlineUsers.delete(user.id);
        io.emit("presence", { userId: user.id, online: false });
      }
    });
  });
};
