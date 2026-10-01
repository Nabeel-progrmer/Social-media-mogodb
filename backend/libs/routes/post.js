import express from "express";
import { postModle } from "../../libs/models/index.mjs";
import { UserModel } from "../../libs/models/users/index.mjs";
import { isValidObjectId } from "mongoose";
import { postImageMiddleware } from "../multer.mjs";
import { uploadonCloudinary } from "../cloudinary.mjs";

const router = express.Router();
const postAuthorFields = "_id firstname lastname profilePicture";

const serializePostForViewer = (post, viewerId) => {
  const postData = typeof post.toObject === "function" ? post.toObject() : post;
  const authorId = postData.author?._id ?? postData.author;
  const likes = postData.likes || [];
  const likesCount = likes.length;
  const likedByMe = likes.some(
    (like) => String(like?._id ?? like) === String(viewerId),
  );
  const viewsCount = (postData.views || []).length;
  delete postData.likes;
  delete postData.views;

  return {
    ...postData,
    isOwner: Boolean(authorId && String(authorId) === String(viewerId)),
    likesCount,
    likedByMe,
    viewsCount,
  };
};

const postOwnerFilter = (postId, viewerId) => ({
  _id: postId,
  author: viewerId,
});

const populatePostUsers = (query) =>
  query
    .populate("author", postAuthorFields)
    .populate("comments.user", postAuthorFields);

const hiddenPrivateAuthorsFor = async () =>
  UserModel.distinct("_id", {
    accountPrivacy: "private",
  });

const requirePostVisibility = async (req, res, next) => {
  try {
    const { postId } = req.params;
    if (!isValidObjectId(postId)) {
      return res.status(400).send({ message: "id is invalid" });
    }
    const post = await postModle.findById(postId).select("author");
    if (!post) return res.status(404).send({ message: "post not found" });
    const author = await UserModel.findById(post.author).select("accountPrivacy");
    if (
      author?.accountPrivacy === "private" &&
      String(post.author) !== String(req.currentUser._id)
    ) {
      return res.status(404).send({ message: "post not found" });
    }
    return next();
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: "could not check post visibility" });
  }
};

router.get("/search", async (req, res) => {
  try {
    const keyword =
      typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    if (keyword.length < 2) {
      return res
        .status(400)
        .send({ message: "search keyword must be at least 2 characters" });
    }

    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const nameRegex = new RegExp(escapedKeyword, "i");
    const userQuery = {
      $or: [
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
      ],
    };
    const postQuery = {
      $or: [{ title: nameRegex }, { description: nameRegex }],
      author: { $nin: await hiddenPrivateAuthorsFor() },
    };

    const [users, posts] = await Promise.all([
      UserModel.find(userQuery)
        .select("_id firstname lastname profilePicture")
        .sort({ firstname: 1, lastname: 1, _id: 1 })
        .collation({ locale: "en", strength: 2 })
        .limit(10),
      populatePostUsers(
        postModle.find(postQuery).sort({ createdAt: -1 }).limit(10),
      ),
    ]);

    return res.send({
      message: "search results fetched",
      users,
      posts: posts.map((post) =>
        serializePostForViewer(post, req.currentUser._id),
      ),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: "internal server error" });
  }
});

router.post("/post", postImageMiddleware, async (req, res) => {
  try {
    if (!req.body.title) {
      return res.status(400).send({
        message: "title is requioired",
      });
    }
    if (!req.body.description) {
      return res.status(400).send({
        message: "Desciption is required ",
      });
    }

    const uploadedImage = req.file ? await uploadonCloudinary(req.file) : null;
    const createdPost = await postModle.create({
      title: req.body.title,
      description: req.body.description,
      author: req.currentUser._id,
      imageUrl: uploadedImage?.secure_url || uploadedImage?.url || null,
    });
    await createdPost.populate([
      { path: "author", select: postAuthorFields },
      { path: "comments.user", select: postAuthorFields },
    ]);
    return res.send({
      message: "post is created",
      post: serializePostForViewer(createdPost, req.currentUser._id),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send({
      message: "internal server error",
    });
  }
});

router.get("/post", async (req, res) => {
  try {
    const hiddenAuthorIds = await hiddenPrivateAuthorsFor();
    const allPosts = await populatePostUsers(
      postModle.find({ author: { $nin: hiddenAuthorIds } }),
    );
    return res.send({
      message: "all post is fetched",
      posts: allPosts.map((post) =>
        serializePostForViewer(post, req.currentUser._id),
      ),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send({
      messaage: "internal server error",
    });
  }
});

router.get("/post/:postId", requirePostVisibility, async (req, res) => {
  try {
    const postId = req.params.postId;

    if (!postId) {
      return res.status(400).send({
        message: "id is required",
      });
    }

    if (!isValidObjectId(postId)) {
      return res.status(400).send({
        message: "id is invalid",
      });
    }
    const solopost = await populatePostUsers(
      postModle.findOne({ _id: postId }),
    );

    if (!solopost) {
      return res.status(404).send({
        message: "post not found",
      });
    }
    return res.send({
      message: "single post is fetched",
      post: serializePostForViewer(solopost, req.currentUser._id),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send({
      messaage: "internal server error",
    });
  }
});

router.put("/post/:postId/like", requirePostVisibility, async (req, res) => {
  try {
    const { postId } = req.params;
    if (!isValidObjectId(postId)) {
      return res.status(400).send({ message: "id is invalid" });
    }

    const likeResult = await postModle.updateOne(
      { _id: postId, likes: { $ne: req.currentUser._id } },
      { $addToSet: { likes: req.currentUser._id } },
    );
    const post = await populatePostUsers(postModle.findById(postId));

    if (!post) {
      return res.status(404).send({ message: "post not found" });
    }
    const authorId = post.author?._id ?? post.author;
    if (
      likeResult.modifiedCount > 0 &&
      String(authorId) !== String(req.currentUser._id)
    ) {
      await UserModel.updateOne(
        { _id: authorId },
        {
          $push: {
            notifications: {
              $each: [
                { type: "like", actor: req.currentUser._id, post: post._id },
              ],
              $position: 0,
              $slice: 50,
            },
          },
        },
      );
    }

    return res.send({
      message: "post liked",
      post: serializePostForViewer(post, req.currentUser._id),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: "internal server error" });
  }
});

router.post("/post/:postId/view", requirePostVisibility, async (req, res) => {
  try {
    const { postId } = req.params;
    if (!isValidObjectId(postId)) {
      return res.status(400).send({ message: "id is invalid" });
    }

    const existingPost = await postModle
      .findById(postId)
      .select("author views");
    if (!existingPost) {
      return res.status(404).send({ message: "post not found" });
    }
    const existingAuthorId = existingPost.author?._id ?? existingPost.author;
    if (String(existingAuthorId) === String(req.currentUser._id)) {
      return res.send({
        message: "owner views are not counted",
        viewsCount: (existingPost.views || []).length,
      });
    }

    let post = await postModle.findOneAndUpdate(
      { _id: postId, views: { $ne: req.currentUser._id } },
      { $addToSet: { views: req.currentUser._id } },
      { new: true },
    );
    const viewAdded = Boolean(post);
    if (!post) {
      post = await postModle.findById(postId);
    }
    if (!post) {
      return res.status(404).send({ message: "post not found" });
    }
    await post.populate([
      { path: "author", select: postAuthorFields },
      { path: "comments.user", select: postAuthorFields },
    ]);

    const viewsCount = (post.views || []).length;
    const authorId = post.author?._id ?? post.author;
    const viewMilestones = new Set([
      10, 25, 50, 100, 250, 500, 1000, 2500, 5000,
    ]);
    if (
      viewAdded &&
      viewMilestones.has(viewsCount) &&
      String(authorId) !== String(req.currentUser._id)
    ) {
      await UserModel.updateOne(
        { _id: authorId },
        {
          $push: {
            notifications: {
              $each: [
                {
                  type: "post_views",
                  actor: req.currentUser._id,
                  post: post._id,
                  count: viewsCount,
                },
              ],
              $position: 0,
              $slice: 50,
            },
          },
        },
      );
    }

    return res.send({
      message: "post view recorded",
      viewsCount,
      post: serializePostForViewer(post, req.currentUser._id),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: "could not record post view" });
  }
});

router.delete("/post/:postId/like", requirePostVisibility, async (req, res) => {
  try {
    const { postId } = req.params;
    if (!isValidObjectId(postId)) {
      return res.status(400).send({ message: "id is invalid" });
    }

    const post = await postModle.findByIdAndUpdate(
      postId,
      { $pull: { likes: req.currentUser._id } },
      { new: true },
    );

    if (!post) {
      return res.status(404).send({ message: "post not found" });
    }

    await post.populate([
      { path: "author", select: postAuthorFields },
      { path: "comments.user", select: postAuthorFields },
    ]);

    return res.send({
      message: "post unliked",
      post: serializePostForViewer(post, req.currentUser._id),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: "internal server error" });
  }
});

router.post("/post/:postId/comments", requirePostVisibility, async (req, res) => {
  try {
    const { postId } = req.params;
    const text = typeof req.body.text === "string" ? req.body.text.trim() : "";

    if (!isValidObjectId(postId)) {
      return res.status(400).send({ message: "id is invalid" });
    }
    if (!text) {
      return res.status(400).send({ message: "comment is required" });
    }
    if (text.length > 1000) {
      return res
        .status(400)
        .send({ message: "comment must be 1000 characters or fewer" });
    }

    const post = await postModle.findByIdAndUpdate(
      postId,
      { $push: { comments: { user: req.currentUser._id, text } } },
      { new: true, runValidators: true },
    );

    if (!post) {
      return res.status(404).send({ message: "post not found" });
    }

    await post.populate([
      { path: "author", select: postAuthorFields },
      { path: "comments.user", select: postAuthorFields },
    ]);
    const authorId = post.author?._id ?? post.author;
    if (String(authorId) !== String(req.currentUser._id)) {
      await UserModel.updateOne(
        { _id: authorId },
        {
          $push: {
            notifications: {
              $each: [
                {
                  type: "comment",
                  actor: req.currentUser._id,
                  post: post._id,
                  text: text.slice(0, 180),
                },
              ],
              $position: 0,
              $slice: 50,
            },
          },
        },
      );
    }

    return res.status(201).send({
      message: "comment added",
      post: serializePostForViewer(post, req.currentUser._id),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: "internal server error" });
  }
});

router.delete("/post/:postId", requirePostVisibility, async (req, res) => {
  try {
    const postId = req.params.postId;

    if (!postId) {
      return res.status(400).send({
        message: "id is required",
      });
    }

    if (!isValidObjectId(postId)) {
      return res.status(400).send({
        message: "id is invalid",
      });
    }

    const deletedPost = await postModle.findOneAndDelete(
      postOwnerFilter(postId, req.currentUser._id),
    );

    if (!deletedPost) {
      return res.status(404).send({
        message: "post not found or you are not allowed to delete it",
      });
    }

    return res.send({
      message: "single post deleted",
      post: deletedPost,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).send({
      message: "internal server error",
    });
  }
});

router.put("/post/:postId", requirePostVisibility, postImageMiddleware, async (req, res) => {
  try {
    const postId = req.params.postId;

    if (!postId) {
      return res.status(400).send({
        message: "id is required",
      });
    }

    if (!isValidObjectId(postId)) {
      return res.status(400).send({
        message: "id is invalid",
      });
    }

    if (!req.body.title) {
      return res.status(400).send({
        message: "title is required",
      });
    }
    if (!req.body.description) {
      return res.status(400).send({
        message: "Description is required",
      });
    }

    const ownerPostExists = await postModle.exists(
      postOwnerFilter(postId, req.currentUser._id),
    );
    if (!ownerPostExists) {
      return res.status(404).send({
        message: "post not found or you are not allowed to update it",
      });
    }

    const uploadedImage = req.file ? await uploadonCloudinary(req.file) : null;
    const updatedPost = await postModle.findOneAndUpdate(
      postOwnerFilter(postId, req.currentUser._id),
      {
        $set: {
          title: req.body.title,
          description: req.body.description,
          ...(uploadedImage && {
            imageUrl: uploadedImage.secure_url || uploadedImage.url,
          }),
        },
      },
      { new: true },
    );

    if (!updatedPost) {
      return res.status(404).send({
        message: "post not found or you are not allowed to update it",
      });
    }

    const populatedPost = await updatedPost.populate([
      { path: "author", select: postAuthorFields },
      { path: "comments.user", select: postAuthorFields },
    ]);
    return res.send({
      message: "single post updated",
      post: serializePostForViewer(populatedPost, req.currentUser._id),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send({
      message: "internal server error",
    });
  }
});

export default router;
