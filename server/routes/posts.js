const express = require("express");
const { Post, Comment, logActivity } = require("../models");
const { requireAuth } = require("../middleware/requireAuth");
const { rateLimit } = require("../middleware/rateLimit");
const { ApiError, asyncHandler } = require("../lib/errors");
const { optionalString, requireBoolean, clampInt } = require("../lib/validate");
const { syncAccount } = require("../services/sync");

const router = express.Router();

router.use(requireAuth);

// Syncing hits the Graph API once per post, so keep the hand on the brake.
const syncLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 6,
  keyPrefix: "sync",
  message: "Sync is rate limited. Wait a minute before syncing again.",
});

// -------------------------------------------------------------- list ---
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = clampInt(req.query.limit, "limit", { min: 1, max: 100, fallback: 50 });
    const skip = clampInt(req.query.skip, "skip", { min: 0, max: 100000, fallback: 0 });
    const search = optionalString(req.query.search, "search", { max: 120 });

    const query = { userId: req.userId };
    if (req.query.automation === "on") query.autoReplyEnabled = true;
    if (req.query.automation === "off") query.autoReplyEnabled = false;
    if (search) query.caption = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };

    const [posts, total] = await Promise.all([
      Post.find(query).sort({ postedAt: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      Post.countDocuments(query),
    ]);

    // One grouped count instead of a query per post.
    const pendingCounts = await Comment.aggregate([
      { $match: { userId: req.userId, status: "pending" } },
      { $group: { _id: "$mediaId", count: { $sum: 1 } } },
    ]);
    const pendingByMedia = Object.fromEntries(pendingCounts.map((c) => [c._id, c.count]));

    res.json({
      posts: posts.map((p) => ({
        id: String(p._id),
        mediaId: p.mediaId,
        caption: p.caption,
        mediaType: p.mediaType,
        mediaUrl: p.mediaUrl,
        thumbnailUrl: p.thumbnailUrl,
        permalink: p.permalink,
        postedAt: p.postedAt,
        likeCount: p.likeCount,
        commentsCount: p.commentsCount,
        autoReplyEnabled: p.autoReplyEnabled,
        autoReplySince: p.autoReplySince,
        context: p.context || "",
        hasContext: Boolean(p.context),
        repliesSent: p.repliesSent || 0,
        pendingComments: pendingByMedia[p.mediaId] || 0,
      })),
      total,
      limit,
      skip,
    });
  }),
);

// -------------------------------------------------------------- sync ---
router.post(
  "/sync",
  syncLimiter,
  asyncHandler(async (req, res) => {
    const result = await syncAccount(req.userId, {
      mediaLimit: clampInt(req.body?.limit, "limit", { min: 1, max: 50, fallback: 25 }),
    });
    res.json(result);
  }),
);

// ------------------------------------------------------------ single ---
router.get(
  "/:mediaId",
  asyncHandler(async (req, res) => {
    const post = await Post.findOne({ userId: req.userId, mediaId: String(req.params.mediaId) }).lean();
    if (!post) throw ApiError.notFound("Post not found", "post_not_found");

    const comments = await Comment.find({ userId: req.userId, mediaId: post.mediaId })
      .sort({ commentedAt: -1 })
      .limit(100)
      .lean();

    res.json({
      post: { ...post, id: String(post._id) },
      comments: comments.map((c) => ({ ...c, id: String(c._id) })),
    });
  }),
);

// ----------------------------------------------------------- context ---
router.put(
  "/:mediaId/context",
  asyncHandler(async (req, res) => {
    const context = optionalString(req.body?.context, "context", { max: 4000 });
    const post = await Post.findOneAndUpdate(
      { userId: req.userId, mediaId: String(req.params.mediaId) },
      { $set: { context } },
      { returnDocument: "after" },
    );
    if (!post) throw ApiError.notFound("Post not found", "post_not_found");

    logActivity(req.userId, "context.updated", context ? "Context saved" : "Context cleared", {
      mediaId: post.mediaId,
    });
    res.json({ mediaId: post.mediaId, context: post.context, hasContext: Boolean(post.context) });
  }),
);

// -------------------------------------------------------- automation ---
router.put(
  "/:mediaId/automation",
  asyncHandler(async (req, res) => {
    const enabled = requireBoolean(req.body?.enabled, "enabled");

    const post = await Post.findOneAndUpdate(
      { userId: req.userId, mediaId: String(req.params.mediaId) },
      {
        $set: {
          autoReplyEnabled: enabled,
          // Stamping "now" on enable is the backlog guard: comments that
          // predate this moment are skipped rather than answered in a burst.
          autoReplySince: enabled ? new Date() : null,
        },
      },
      { returnDocument: "after" },
    );
    if (!post) throw ApiError.notFound("Post not found", "post_not_found");

    logActivity(
      req.userId,
      enabled ? "automation.enabled" : "automation.disabled",
      `Auto-reply ${enabled ? "enabled" : "disabled"}`,
      { mediaId: post.mediaId },
    );

    res.json({
      mediaId: post.mediaId,
      autoReplyEnabled: post.autoReplyEnabled,
      autoReplySince: post.autoReplySince,
    });
  }),
);

// --------------------------------------------------- bulk automation ---
router.post(
  "/automation/bulk",
  asyncHandler(async (req, res) => {
    const enabled = requireBoolean(req.body?.enabled, "enabled");
    const mediaIds = Array.isArray(req.body?.mediaIds) ? req.body.mediaIds.map(String) : null;

    const filter = { userId: req.userId };
    if (mediaIds?.length) filter.mediaId = { $in: mediaIds };

    const result = await Post.updateMany(filter, {
      $set: { autoReplyEnabled: enabled, autoReplySince: enabled ? new Date() : null },
    });

    logActivity(
      req.userId,
      enabled ? "automation.enabled" : "automation.disabled",
      `Auto-reply ${enabled ? "enabled" : "disabled"} on ${result.modifiedCount} posts`,
    );
    res.json({ updated: result.modifiedCount });
  }),
);

module.exports = router;
