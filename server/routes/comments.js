const express = require("express");
const { Comment, Post, IgAccount, logActivity } = require("../models");
const { requireAuth } = require("../middleware/requireAuth");
const { ApiError, asyncHandler, extractErrorMessage } = require("../lib/errors");
const { requireString, optionalString, clampInt, oneOf } = require("../lib/validate");
const { generateReply } = require("../services/ai");
const ig = require("../lib/instagram");

const router = express.Router();

router.use(requireAuth);

const shape = (c, post) => ({
  id: String(c._id),
  commentId: c.commentId,
  mediaId: c.mediaId,
  username: c.username,
  text: c.text,
  commentedAt: c.commentedAt,
  status: c.status,
  source: c.source,
  replyText: c.replyText,
  replyMode: c.replyMode,
  repliedAt: c.repliedAt,
  error: c.error,
  post: post
    ? {
        mediaId: post.mediaId,
        caption: post.caption,
        thumbnailUrl: post.thumbnailUrl || post.mediaUrl,
        permalink: post.permalink,
        mediaType: post.mediaType,
        autoReplyEnabled: post.autoReplyEnabled,
        hasContext: Boolean(post.context),
      }
    : null,
});

/** Attaches each comment's post in one extra query rather than N. */
async function withPosts(userId, comments) {
  const mediaIds = [...new Set(comments.map((c) => c.mediaId))];
  const posts = await Post.find({ userId, mediaId: { $in: mediaIds } }).lean();
  const byMediaId = Object.fromEntries(posts.map((p) => [p.mediaId, p]));
  return comments.map((c) => shape(c, byMediaId[c.mediaId]));
}

// --------------------------------------------------------------- list ---
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = clampInt(req.query.limit, "limit", { min: 1, max: 100, fallback: 30 });
    const skip = clampInt(req.query.skip, "skip", { min: 0, max: 100000, fallback: 0 });
    const status = oneOf(req.query.status, "status", ["pending", "replied", "skipped", "failed"], null);
    const search = optionalString(req.query.search, "search", { max: 120 });

    const query = { userId: req.userId };
    if (status) query.status = status;
    if (req.query.mediaId) query.mediaId = String(req.query.mediaId);
    if (search) {
      const safe = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { text: { $regex: safe, $options: "i" } },
        { username: { $regex: safe, $options: "i" } },
      ];
    }

    const [comments, total, counts] = await Promise.all([
      Comment.find(query).sort({ commentedAt: -1 }).skip(skip).limit(limit).lean(),
      Comment.countDocuments(query),
      Comment.aggregate([
        { $match: { userId: req.userId } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);

    res.json({
      comments: await withPosts(req.userId, comments),
      total,
      limit,
      skip,
      counts: Object.fromEntries(counts.map((c) => [c._id, c.count])),
    });
  }),
);

// ----------------------------------------------------------- AI draft ---
router.post(
  "/:id/draft",
  asyncHandler(async (req, res) => {
    const comment = await Comment.findOne({ _id: req.params.id, userId: req.userId });
    if (!comment) throw ApiError.notFound("Comment not found", "comment_not_found");

    const post = await Post.findOne({ userId: req.userId, mediaId: comment.mediaId }).lean();

    const result = await generateReply({
      userId: req.userId,
      comment: comment.text,
      context: post?.context || "",
      username: comment.username,
      caption: post?.caption || "",
    });

    res.json({
      draft: result.text,
      ok: result.ok,
      error: result.error || null,
      code: result.code || null,
      model: result.model || null,
      usage: result.usage || null,
    });
  }),
);

// --------------------------------------------------------------- reply ---
router.post(
  "/:id/reply",
  asyncHandler(async (req, res) => {
    const comment = await Comment.findOne({ _id: req.params.id, userId: req.userId });
    if (!comment) throw ApiError.notFound("Comment not found", "comment_not_found");
    if (comment.status === "replied") {
      throw ApiError.conflict("This comment has already been replied to", "already_replied");
    }

    const account = await IgAccount.findOne({ userId: req.userId });
    if (!account) throw ApiError.badRequest("Connect an Instagram account first", "ig_not_connected");

    const post = await Post.findOne({ userId: req.userId, mediaId: comment.mediaId });

    // Either send the text the user typed, or ask Claude for one on the spot.
    let message = optionalString(req.body?.message, "message", { max: 1000 });
    let mode = "manual";

    if (!message) {
      const result = await generateReply({
        userId: req.userId,
        comment: comment.text,
        context: post?.context || "",
        username: comment.username,
        caption: post?.caption || "",
      });
      if (!result.ok) {
        throw ApiError.badRequest(result.error || "Could not generate a reply", result.code);
      }
      message = result.text;
      mode = "ai";
    }

    try {
      const token = await ig.ensureFreshToken(account);
      const replyId = await ig.replyToComment({
        commentId: comment.commentId,
        message,
        accessToken: token,
      });

      comment.status = "replied";
      comment.replyText = message;
      comment.replyId = replyId;
      comment.replyMode = mode;
      comment.repliedAt = new Date();
      comment.error = "";
      await comment.save();

      if (post) {
        post.repliesSent = (post.repliesSent || 0) + 1;
        await post.save();
      }

      logActivity(req.userId, "reply.sent", `Replied to @${comment.username}`, {
        mediaId: comment.mediaId,
        mode,
      });

      res.json({ comment: shape(comment, post) });
    } catch (e) {
      const message2 = extractErrorMessage(e);
      if (ig.isTokenError(e)) await ig.markAccountInvalid(account, e);

      comment.status = "failed";
      comment.error = message2.slice(0, 300);
      await comment.save();

      logActivity(req.userId, "reply.failed", `Reply to @${comment.username} failed: ${message2}`);
      throw new ApiError(e?.response?.status || 502, message2, "ig_reply_failed");
    }
  }),
);

// ------------------------------------------------------- mark skipped ---
router.post(
  "/:id/skip",
  asyncHandler(async (req, res) => {
    const comment = await Comment.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: { status: "skipped" } },
      { returnDocument: "after" },
    );
    if (!comment) throw ApiError.notFound("Comment not found", "comment_not_found");
    res.json({ comment: shape(comment, null) });
  }),
);

router.post(
  "/:id/reopen",
  asyncHandler(async (req, res) => {
    const comment = await Comment.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId, status: { $in: ["skipped", "failed"] } },
      { $set: { status: "pending", error: "" } },
      { returnDocument: "after" },
    );
    if (!comment) throw ApiError.notFound("Comment not found or already replied", "comment_not_found");
    res.json({ comment: shape(comment, null) });
  }),
);

module.exports = router;
