import express from "express";
import { isValidObjectId } from "mongoose";
import { ConversationModel, MessageModel } from "../models/chat.mjs";
import { UserModel } from "../models/users/index.mjs";
import { postImageMiddleware } from "../multer.mjs";
import { uploadonCloudinary } from "../cloudinary.mjs";

const router = express.Router();
const participantFields = "_id firstname lastname profilePicture";
const roomFor = (conversationId) => "conversation:" + conversationId;
const sameId = (left, right) =>
  String(left?._id ?? left) === String(right?._id ?? right);

const populateConversation = (query) =>
  query
    .populate("participants", participantFields)
    .populate("admins", participantFields)
    .populate({
      path: "lastMessage",
      select: "text imageUrl type sender createdAt deletedAt",
    })
    .populate("lastMessage.sender", participantFields);

const requireMembership = async (conversationId, userId) => {
  if (!isValidObjectId(conversationId))
    return { error: "conversation id is invalid", status: 400 };
  const conversation = await ConversationModel.findOne({
    _id: conversationId,
    participants: userId,
  });
  if (!conversation) return { error: "conversation not found", status: 404 };
  return { conversation };
};

const sendConversationUpdate = async (req, conversationId) => {
  const io = req.app.get("io");
  const conversation = await populateConversation(
    ConversationModel.findById(conversationId),
  );
  if (conversation)
    io?.to(roomFor(conversationId)).emit("conversation-updated", conversation);
  return conversation;
};

router.get("/conversations/unread", async (req, res) => {
  try {
    const conversations = await ConversationModel.find({
      participants: req.currentUser._id,
    }).select("_id");
    const unreadCount = await MessageModel.countDocuments({
      conversation: { $in: conversations.map((item) => item._id) },
      sender: { $ne: req.currentUser._id },
      readBy: { $ne: req.currentUser._id },
      deletedAt: null,
    });
    return res.send({ unreadCount });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: "could not load unread chats" });
  }
});

router.get("/conversations", async (req, res) => {
  try {
    const conversations = await populateConversation(
      ConversationModel.find({ participants: req.currentUser._id }).sort({
        updatedAt: -1,
      }),
    );
    const data = await Promise.all(
      conversations.map(async (conversation) => {
        const item = conversation.toObject();
        item.unreadCount = await MessageModel.countDocuments({
          conversation: conversation._id,
          sender: { $ne: req.currentUser._id },
          readBy: { $ne: req.currentUser._id },
          deletedAt: null,
        });
        return item;
      }),
    );
    return res.send({ conversations: data });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: "could not load conversations" });
  }
});

router.post("/conversations/direct", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!isValidObjectId(userId))
      return res.status(400).send({ message: "user id is invalid" });
    if (sameId(userId, req.currentUser._id))
      return res
        .status(400)
        .send({ message: "you cannot start a chat with yourself" });
    if (!(await UserModel.exists({ _id: userId })))
      return res.status(404).send({ message: "user not found" });

    const ids = [String(req.currentUser._id), String(userId)].sort();
    const conversation = await ConversationModel.findOneAndUpdate(
      { directKey: ids.join(":") },
      {
        $setOnInsert: {
          participants: ids,
          createdBy: req.currentUser._id,
          isGroup: false,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    return res.send({
      conversation: await populateConversation(
        ConversationModel.findById(conversation._id),
      ),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: "could not start chat" });
  }
});

router.post("/conversations/group", async (req, res) => {
  try {
    const groupName =
      typeof req.body.name === "string"
        ? req.body.name.trim().slice(0, 60)
        : "";
    const memberIds = Array.isArray(req.body.memberIds)
      ? req.body.memberIds
      : [];
    const uniqueIds = [
      ...new Set([String(req.currentUser._id), ...memberIds.map(String)]),
    ];
    if (groupName.length < 2)
      return res
        .status(400)
        .send({ message: "group name must be at least 2 characters" });
    if (uniqueIds.length < 3)
      return res
        .status(400)
        .send({ message: "choose at least two other people for a group" });
    if (
      uniqueIds.length > 100 ||
      uniqueIds.some((id) => !isValidObjectId(id))
    ) {
      return res
        .status(400)
        .send({
          message: "group members are invalid or exceed the 100 member limit",
        });
    }
    if (
      (await UserModel.countDocuments({ _id: { $in: uniqueIds } })) !==
      uniqueIds.length
    ) {
      return res
        .status(404)
        .send({ message: "one or more members were not found" });
    }

    const created = await ConversationModel.create({
      participants: uniqueIds,
      admins: [req.currentUser._id],
      createdBy: req.currentUser._id,
      groupName,
      isGroup: true,
    });
    const conversation = await populateConversation(
      ConversationModel.findById(created._id),
    );
    uniqueIds.forEach((userId) =>
      req.app
        .get("io")
        ?.to("user:" + userId)
        .emit("conversation-created", conversation),
    );
    return res.status(201).send({ conversation });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: "could not create group" });
  }
});

router.get("/conversations/:conversationId/messages", async (req, res) => {
  try {
    const { conversationId } = req.params;
    const membership = await requireMembership(
      conversationId,
      req.currentUser._id,
    );
    if (membership.error)
      return res.status(membership.status).send({ message: membership.error });
    const limit = Math.min(
      Math.max(Number.parseInt(req.query.limit, 10) || 50, 1),
      100,
    );
    const filter = { conversation: conversationId };
    if (req.query.before && !Number.isNaN(Date.parse(req.query.before)))
      filter.createdAt = { $lt: new Date(req.query.before) };
    const messages = await MessageModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("sender", participantFields)
      .populate("reactions.users", participantFields);
    return res.send({
      messages: messages.reverse(),
      hasMore: messages.length === limit,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: "could not load messages" });
  }
});

const createMessage = async (req, res, imageUrl = null) => {
  const { conversationId } = req.params;
  const membership = await requireMembership(
    conversationId,
    req.currentUser._id,
  );
  if (membership.error)
    return res.status(membership.status).send({ message: membership.error });
  const text =
    typeof req.body.text === "string"
      ? req.body.text.trim().slice(0, 5000)
      : "";
  if (!text && !imageUrl)
    return res
      .status(400)
      .send({ message: "write a message or attach an image" });

  const created = await MessageModel.create({
    conversation: conversationId,
    sender: req.currentUser._id,
    text,
    imageUrl,
    type: imageUrl ? "image" : "text",
    readBy: [req.currentUser._id],
  });
  await ConversationModel.updateOne(
    { _id: conversationId },
    { $set: { lastMessage: created._id }, $currentDate: { updatedAt: true } },
  );
  const message = await MessageModel.findById(created._id).populate(
    "sender",
    participantFields,
  );
  const io = req.app.get("io");
  io?.to(roomFor(conversationId)).emit("new-message", message);
  membership.conversation.participants.forEach((participantId) => {
    if (!sameId(participantId, req.currentUser._id)) {
      io?.to("user:" + participantId).emit("chat-list-updated", {
        conversationId,
      });
    }
  });
  return res.status(201).send({ message });
};

router.post("/conversations/:conversationId/messages", async (req, res) => {
  try {
    return await createMessage(req, res);
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: "could not send message" });
  }
});

router.post(
  "/conversations/:conversationId/messages/image",
  postImageMiddleware,
  async (req, res) => {
    try {
      if (!req.file)
        return res.status(400).send({ message: "choose an image first" });
      const membership = await requireMembership(
        req.params.conversationId,
        req.currentUser._id,
      );
      if (membership.error)
        return res
          .status(membership.status)
          .send({ message: membership.error });
      const uploaded = await uploadonCloudinary(req.file);
      return await createMessage(
        req,
        res,
        uploaded?.secure_url || uploaded?.url,
      );
    } catch (error) {
      console.error(error);
      return res.status(500).send({ message: "could not send image" });
    }
  },
);

router.put("/conversations/:conversationId/read", async (req, res) => {
  try {
    const { conversationId } = req.params;
    const membership = await requireMembership(
      conversationId,
      req.currentUser._id,
    );
    if (membership.error)
      return res.status(membership.status).send({ message: membership.error });
    const result = await MessageModel.updateMany(
      {
        conversation: conversationId,
        sender: { $ne: req.currentUser._id },
        readBy: { $ne: req.currentUser._id },
      },
      { $addToSet: { readBy: req.currentUser._id } },
    );
    req.app
      .get("io")
      ?.to(roomFor(conversationId))
      .emit("read-receipt", { userId: req.currentUser._id });
    return res.send({
      message: "messages marked as read",
      count: result.modifiedCount,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: "could not mark messages as read" });
  }
});

router.put("/messages/:messageId", async (req, res) => {
  try {
    const { messageId } = req.params;
    const text =
      typeof req.body.text === "string"
        ? req.body.text.trim().slice(0, 5000)
        : "";
    if (!isValidObjectId(messageId) || !text)
      return res.status(400).send({ message: "message and text are required" });
    const current = await MessageModel.findOne({
      _id: messageId,
      sender: req.currentUser._id,
      deletedAt: null,
    }).select("conversation");
    if (!current)
      return res
        .status(404)
        .send({ message: "message not found or cannot be edited" });
    const membership = await requireMembership(
      current.conversation,
      req.currentUser._id,
    );
    if (membership.error)
      return res.status(membership.status).send({ message: membership.error });
    const message = await MessageModel.findByIdAndUpdate(
      messageId,
      { $set: { text, editedAt: new Date() } },
      { new: true, runValidators: true },
    ).populate("sender", participantFields);
    req.app
      .get("io")
      ?.to(roomFor(current.conversation))
      .emit("message-updated", message);
    return res.send({ message });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: "could not edit message" });
  }
});

router.delete("/messages/:messageId", async (req, res) => {
  try {
    const { messageId } = req.params;
    if (!isValidObjectId(messageId))
      return res.status(400).send({ message: "message id is invalid" });
    const current = await MessageModel.findOne({
      _id: messageId,
      sender: req.currentUser._id,
      deletedAt: null,
    }).select("conversation");
    if (!current)
      return res
        .status(404)
        .send({ message: "message not found or cannot be deleted" });
    const membership = await requireMembership(
      current.conversation,
      req.currentUser._id,
    );
    if (membership.error)
      return res.status(membership.status).send({ message: membership.error });
    const message = await MessageModel.findByIdAndUpdate(
      messageId,
      { $set: { text: "", imageUrl: null, deletedAt: new Date() } },
      { new: true },
    ).populate("sender", participantFields);
    req.app
      .get("io")
      ?.to(roomFor(current.conversation))
      .emit("message-updated", message);
    return res.send({ message });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: "could not delete message" });
  }
});

router.post(
  "/conversations/:conversationId/messages/:messageId/reaction",
  async (req, res) => {
    try {
      const { conversationId, messageId } = req.params;
      const emoji = typeof req.body.emoji === "string" ? req.body.emoji : "";
      const allowedEmojis = new Set(["❤️", "😂", "😮", "😢", "👍", "🔥"]);
      const membership = await requireMembership(
        conversationId,
        req.currentUser._id,
      );
      if (membership.error)
        return res
          .status(membership.status)
          .send({ message: membership.error });
      if (!isValidObjectId(messageId) || !allowedEmojis.has(emoji))
        return res.status(400).send({ message: "reaction is invalid" });
      const item = await MessageModel.findOne({
        _id: messageId,
        conversation: conversationId,
      });
      if (!item) return res.status(404).send({ message: "message not found" });
      const reaction = item.reactions.find((entry) => entry.emoji === emoji);
      if (!reaction)
        item.reactions.push({ emoji, users: [req.currentUser._id] });
      else if (reaction.users.some((id) => sameId(id, req.currentUser._id))) {
        reaction.users = reaction.users.filter(
          (id) => !sameId(id, req.currentUser._id),
        );
        if (reaction.users.length === 0)
          item.reactions = item.reactions.filter(
            (entry) => entry.emoji !== emoji,
          );
      } else reaction.users.push(req.currentUser._id);
      await item.save();
      await item.populate(
        ["sender", "reactions.users"].map((path) => ({
          path,
          select: participantFields,
        })),
      );
      req.app
        .get("io")
        ?.to(roomFor(conversationId))
        .emit("message-updated", item);
      return res.send({ message: item });
    } catch (error) {
      console.error(error);
      return res.status(500).send({ message: "could not update reaction" });
    }
  },
);

router.put("/conversations/:conversationId", async (req, res) => {
  try {
    const { conversationId } = req.params;
    const membership = await requireMembership(
      conversationId,
      req.currentUser._id,
    );
    if (membership.error)
      return res.status(membership.status).send({ message: membership.error });
    if (
      !membership.conversation.isGroup ||
      !membership.conversation.admins.some((id) =>
        sameId(id, req.currentUser._id),
      )
    ) {
      return res
        .status(403)
        .send({ message: "only group admins can change group details" });
    }
    const groupName =
      typeof req.body.name === "string"
        ? req.body.name.trim().slice(0, 60)
        : "";
    if (groupName.length < 2)
      return res
        .status(400)
        .send({ message: "group name must be at least 2 characters" });
    membership.conversation.groupName = groupName;
    await membership.conversation.save();
    return res.send({
      conversation: await sendConversationUpdate(req, conversationId),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: "could not update group" });
  }
});

router.post("/conversations/:conversationId/members", async (req, res) => {
  try {
    const { conversationId } = req.params;
    const membership = await requireMembership(
      conversationId,
      req.currentUser._id,
    );
    if (membership.error)
      return res.status(membership.status).send({ message: membership.error });
    if (
      !membership.conversation.isGroup ||
      !membership.conversation.admins.some((id) =>
        sameId(id, req.currentUser._id),
      )
    ) {
      return res
        .status(403)
        .send({ message: "only group admins can add members" });
    }
    const requestedIds = Array.isArray(req.body.memberIds)
      ? [...new Set(req.body.memberIds.map(String))]
      : [];
    if (!requestedIds.length || requestedIds.some((id) => !isValidObjectId(id)))
      return res.status(400).send({ message: "choose valid members" });
    const existingIds = membership.conversation.participants.map(String);
    const newIds = requestedIds.filter((id) => !existingIds.includes(id));
    if (existingIds.length + newIds.length > 100)
      return res
        .status(400)
        .send({ message: "groups are limited to 100 members" });
    if (
      (await UserModel.countDocuments({ _id: { $in: newIds } })) !==
      newIds.length
    ) {
      return res
        .status(404)
        .send({ message: "one or more users were not found" });
    }
    await ConversationModel.updateOne(
      { _id: conversationId },
      { $addToSet: { participants: { $each: newIds } } },
    );
    const conversation = await sendConversationUpdate(req, conversationId);
    newIds.forEach((userId) =>
      req.app
        .get("io")
        ?.to("user:" + userId)
        .emit("conversation-created", conversation),
    );
    return res.send({ conversation });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: "could not add group members" });
  }
});

router.delete(
  "/conversations/:conversationId/members/:memberId",
  async (req, res) => {
    try {
      const { conversationId, memberId } = req.params;
      const membership = await requireMembership(
        conversationId,
        req.currentUser._id,
      );
      if (membership.error)
        return res
          .status(membership.status)
          .send({ message: membership.error });
      if (!membership.conversation.isGroup || !isValidObjectId(memberId))
        return res
          .status(400)
          .send({ message: "group or member id is invalid" });
      const isAdmin = membership.conversation.admins.some((id) =>
        sameId(id, req.currentUser._id),
      );
      if (!isAdmin && !sameId(memberId, req.currentUser._id))
        return res
          .status(403)
          .send({ message: "only admins can remove other members" });
      if (
        !membership.conversation.participants.some((id) => sameId(id, memberId))
      )
        return res.status(404).send({ message: "member not found" });
      await ConversationModel.updateOne(
        { _id: conversationId },
        { $pull: { participants: memberId, admins: memberId } },
      );
      const updated = await ConversationModel.findById(conversationId);
      if (updated.admins.length === 0 && updated.participants.length > 0) {
        updated.admins.push(updated.participants[0]);
        await updated.save();
      }
      const conversation = await sendConversationUpdate(req, conversationId);
      req.app
        .get("io")
        ?.to("user:" + memberId)
        .emit("conversation-removed", { conversationId });
      return res.send({ conversation });
    } catch (error) {
      console.error(error);
      return res.status(500).send({ message: "could not remove group member" });
    }
  },
);

export default router;
