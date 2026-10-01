import express from "express";
import bcrypt from "bcryptjs";
import { isValidObjectId } from "mongoose";
import { UserModel } from "../models/users/index.mjs";
import { postModle } from "../models/index.mjs";
import { multerMiddleweare } from "../multer.mjs";
import { uploadonCloudinary } from "../cloudinary.mjs";

const router = express.Router();

router.get("/users", async (req, res) => {
  try {
    const keyword =
      typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(48, Math.max(1, Number.parseInt(req.query.limit, 10) || 24));
    const query = {};

    if (keyword) {
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const nameRegex = new RegExp(escapedKeyword, "i");
      query.$or = [
        { firstname: nameRegex },
        { lastname: nameRegex },
        {
          $expr: {
            $regexMatch: {
              input: { $concat: ["$firstname", " ", "$lastname"] },
              regex: escapedKeyword,
              options: "i",
            },
          },
        },
      ];
    }

    const [users, total] = await Promise.all([
      UserModel.find(query)
        .select("_id firstname lastname profilePicture")
        .sort({ firstname: 1, lastname: 1, _id: 1 })
        .collation({ locale: "en", strength: 2 })
        .skip((page - 1) * limit)
        .limit(limit),
      UserModel.countDocuments(query),
    ]);

    return res.send({
      message: "users fetched",
      users,
      total,
      page,
      pages: Math.ceil(total / limit),
      limit,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: "could not load users" });
  }
});

router.get("/profile/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isValidObjectId(userId)) {
      return res.status(400).send({ message: "user id is invalid" });
    }

    const isOwner = String(req.currentUser._id) === String(userId);
    const profileFields = "_id firstname lastname profilePicture bio";
    const profile = await UserModel.findById(userId).select(
      `${profileFields}${isOwner ? " email" : ""} following accountPrivacy`,
    );

    if (!profile) {
      return res.status(404).send({ message: "user not found" });
    }

    const profileData = profile.toObject();
    const isFollowing = profileData.following.some(
      (id) => String(id) === String(req.currentUser._id),
    );
    const canViewPrivateProfile =
      !profileData.accountPrivacy ||
      profileData.accountPrivacy === "public" ||
      isOwner;
    const [posts, followersCount] = await Promise.all([
      canViewPrivateProfile
        ? postModle
            .find({ author: profile._id })
            .select("title description imageUrl author createdAt updatedAt")
            .sort({ createdAt: -1 })
            .populate("author", "_id firstname lastname profilePicture")
        : Promise.resolve([]),
      UserModel.countDocuments({ following: profile._id }),
    ]);
    const followingCount = profileData.following.length;
    delete profileData.following;

    return res.send({
      message: "public profile fetched",
      data: { ...profileData, followersCount, followingCount, isFollowing },
      posts: posts.map((post) => ({
        ...post.toObject(),
        isOwner,
      })),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: "internal server error" });
  }
});

router.put("/profile/:userId/follow", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isValidObjectId(userId)) {
      return res.status(400).send({ message: "user id is invalid" });
    }
    if (String(req.currentUser._id) === String(userId)) {
      return res
        .status(400)
        .send({ message: "you cannot follow your own account" });
    }

    const targetExists = await UserModel.exists({ _id: userId });
    if (!targetExists) {
      return res.status(404).send({ message: "user not found" });
    }

    const followResult = await UserModel.updateOne(
      { _id: req.currentUser._id, following: { $ne: userId } },
      { $addToSet: { following: userId } },
    );
    const followedProfile =
      await UserModel.findById(userId).select("following");
    if (followResult.modifiedCount > 0) {
      await UserModel.updateOne(
        { _id: userId },
        {
          $push: {
            notifications: {
              $each: [{ type: "follow", actor: req.currentUser._id }],
              $position: 0,
              $slice: 50,
            },
          },
        },
      );
    }

    return res.send({
      message: "user followed",
      isFollowing: true,
      followingCount: followedProfile.following.length,
      followersCount: await UserModel.countDocuments({ following: userId }),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: "internal server error" });
  }
});

router.get("/notifications", async (req, res) => {
  try {
    const user = await UserModel.findById(req.currentUser._id)
      .select("notifications")
      .populate("notifications.actor", "_id firstname lastname profilePicture")
      .populate("notifications.post", "_id title");
    const allNotifications = user?.notifications || [];
    const notifications = allNotifications.slice(0, 25);
    const unreadCount = allNotifications.filter((item) => !item.readAt).length;
    return res.send({ notifications, unreadCount });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: "could not load notifications" });
  }
});

router.put("/notifications/read", async (req, res) => {
  try {
    await UserModel.updateOne(
      { _id: req.currentUser._id },
      { $set: { "notifications.$[notification].readAt": new Date() } },
      { arrayFilters: [{ "notification.readAt": null }] },
    );
    return res.send({ message: "notifications marked as read" });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: "could not update notifications" });
  }
});

router.delete("/profile/:userId/follow", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isValidObjectId(userId)) {
      return res.status(400).send({ message: "user id is invalid" });
    }

    const currentUser = await UserModel.findById(req.currentUser._id).select(
      "following",
    );

    if (!currentUser) {
      return res.status(404).send({ message: "account not found" });
    }
    if (!(await UserModel.exists({ _id: userId }))) {
      return res.status(404).send({ message: "user not found" });
    }

    const unfollowResult = await UserModel.updateOne(
      { _id: req.currentUser._id, following: userId },
      { $pull: { following: userId } },
    );
    if (unfollowResult.modifiedCount > 0) {
      await UserModel.updateOne(
        { _id: userId },
        {
          $push: {
            notifications: {
              $each: [{ type: "unfollow", actor: req.currentUser._id }],
              $position: 0,
              $slice: 50,
            },
          },
        },
      );
    }

    const followedProfile =
      await UserModel.findById(userId).select("following");
    return res.send({
      message:
        unfollowResult.modifiedCount > 0
          ? "user unfollowed"
          : "user was not followed",
      isFollowing: false,
      followingCount: followedProfile.following.length,
      followersCount: await UserModel.countDocuments({ following: userId }),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: "internal server error" });
  }
});

router.get("/profile", async (req, res) => {
  const user = await UserModel.findById(req.currentUser._id).select(
    "firstname lastname email profilePicture accountPrivacy bio",
  );
  return res.send({
    message: "profile is fetched",
    data: user || req.currentUser,
  });
});

router.get("/settings", async (req, res) => {
  try {
    const user = await UserModel.findById(req.currentUser._id).select(
      "accountPrivacy",
    );
    if (!user) return res.status(404).send({ message: "account not found" });
    return res.send({ settings: { accountPrivacy: user.accountPrivacy || "public" } });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: "could not load settings" });
  }
});

router.put("/settings", async (req, res) => {
  try {
    const { accountPrivacy } = req.body || {};
    if (!["public", "private"].includes(accountPrivacy)) {
      return res.status(400).send({ message: "accountPrivacy must be public or private" });
    }
    const user = await UserModel.findByIdAndUpdate(
      req.currentUser._id,
      { $set: { accountPrivacy } },
      { new: true, runValidators: true },
    ).select("accountPrivacy");
    if (!user) return res.status(404).send({ message: "account not found" });
    return res.send({
      message: "privacy setting updated",
      settings: { accountPrivacy: user.accountPrivacy },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: "could not update privacy setting" });
  }
});

router.put("/profile", async (req, res) => {
  try {
    const updates = {};
    if (typeof req.body.firstname === "string") {
      updates.firstname = req.body.firstname.trim();
    }
    if (typeof req.body.lastname === "string") {
      updates.lastname = req.body.lastname.trim();
    }
    if (typeof req.body.bio === "string") {
      updates.bio = req.body.bio.trim();
      if (updates.bio.length > 160) {
        return res.status(400).send({ message: "bio must be 160 characters or fewer" });
      }
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).send({ message: "profile fields are required" });
    }

    const user = await UserModel.findByIdAndUpdate(
      req.currentUser._id,
      { $set: updates },
      { new: true, runValidators: true },
    ).select("_id firstname lastname email profilePicture accountPrivacy bio");

    if (!user) {
      return res.status(404).send({ message: "account not found" });
    }

    return res.send({ message: "profile updated", data: user });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: "internal server error" });
  }
});

router.put("/profile-picture", multerMiddleweare, async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).send({
        message: "file is required",
      });
    }

    const fileResp = await uploadonCloudinary(file);
    if (!fileResp?.secure_url && !fileResp?.url) {
      throw new Error("Cloudinary did not return an image URL");
    }

    const user = await UserModel.findByIdAndUpdate(
      req.currentUser._id,
      { $set: { profilePicture: fileResp.secure_url || fileResp.url } },
      { new: true },
    ).select("_id firstname lastname email profilePicture accountPrivacy bio");

    if (!user?.profilePicture) {
      return res.status(404).send({ message: "account not found" });
    }

    return res.send({ message: "profile picture uploaded", data: user });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: "internal server error" });
  }
});

router.put("/passward", async (req, res) => {
  try {
    const { currentPassward, newPassward } = req.body;
    if (!currentPassward || !newPassward) {
      return res.status(400).send({ message: "both passwords are required" });
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassward,
      req.currentUser.passward,
    );
    if (!isCurrentPasswordValid) {
      return res.status(400).send({ message: "current passward is invalid" });
    }

    const passward = await bcrypt.hash(newPassward, 12);
    await UserModel.findByIdAndUpdate(req.currentUser._id, {
      $set: { passward },
    });
    return res.send({ message: "passward is updated" });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: "internal server error" });
  }
});

export default router;
