const express = require("express");
const { Post, Comment, ActivityLog, IgAccount } = require("../models");
const { requireAuth } = require("../middleware/requireAuth");
const { asyncHandler } = require("../lib/errors");
const { clampInt } = require("../lib/validate");

const router = express.Router();

router.use(requireAuth);

const startOfDayUtc = (offsetDays = 0) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - offsetDays);
  return d;
};

/** Everything the dashboard needs, in one round trip. */
router.get(
  "/overview",
  asyncHandler(async (req, res) => {
    const days = clampInt(req.query.days, "days", { min: 7, max: 90, fallback: 14 });
    const since = startOfDayUtc(days - 1);
    const userId = req.userId;

    const [
      account,
      totalPosts,
      automatedPosts,
      postsWithContext,
      statusCounts,
      repliesInRange,
      commentsInRange,
      replyModes,
      recentActivity,
      needsAttention,
    ] = await Promise.all([
      IgAccount.findOne({ userId }),
      Post.countDocuments({ userId }),
      Post.countDocuments({ userId, autoReplyEnabled: true }),
      Post.countDocuments({ userId, context: { $nin: ["", null] } }),
      Comment.aggregate([
        { $match: { userId } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Comment.aggregate([
        { $match: { userId, status: "replied", repliedAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$repliedAt" } }, count: { $sum: 1 } } },
      ]),
      Comment.aggregate([
        { $match: { userId, commentedAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$commentedAt" } }, count: { $sum: 1 } } },
      ]),
      Comment.aggregate([
        { $match: { userId, status: "replied" } },
        { $group: { _id: "$replyMode", count: { $sum: 1 } } },
      ]),
      ActivityLog.find({ userId }).sort({ createdAt: -1 }).limit(12).lean(),
      Comment.find({ userId, status: "failed" }).sort({ updatedAt: -1 }).limit(5).lean(),
    ]);

    const byStatus = Object.fromEntries(statusCounts.map((s) => [s._id, s.count]));
    const repliesByDay = Object.fromEntries(repliesInRange.map((d) => [d._id, d.count]));
    const commentsByDay = Object.fromEntries(commentsInRange.map((d) => [d._id, d.count]));

    // Densify: charts need a point for every day, including zero days.
    const series = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const key = startOfDayUtc(i).toISOString().slice(0, 10);
      series.push({ date: key, replies: repliesByDay[key] || 0, comments: commentsByDay[key] || 0 });
    }

    const replied = byStatus.replied || 0;
    const pending = byStatus.pending || 0;
    const failed = byStatus.failed || 0;
    const skipped = byStatus.skipped || 0;
    const handled = replied + skipped;
    const totalComments = replied + pending + failed + skipped;

    const modes = Object.fromEntries(replyModes.map((m) => [m._id || "unknown", m.count]));

    res.json({
      instagram: account ? account.toPublic() : { connected: false },
      totals: {
        posts: totalPosts,
        automatedPosts,
        postsWithContext,
        comments: totalComments,
        replied,
        pending,
        failed,
        skipped,
        aiReplies: modes.ai || 0,
        manualReplies: modes.manual || 0,
        // Share of comments already dealt with, the headline health number.
        responseRate: totalComments ? Math.round((handled / totalComments) * 100) : 0,
        automationRate: totalPosts ? Math.round((automatedPosts / totalPosts) * 100) : 0,
      },
      series,
      recentActivity: recentActivity.map((a) => ({
        id: String(a._id),
        type: a.type,
        message: a.message,
        meta: a.meta,
        createdAt: a.createdAt,
      })),
      needsAttention: needsAttention.map((c) => ({
        id: String(c._id),
        username: c.username,
        text: c.text,
        error: c.error,
        mediaId: c.mediaId,
      })),
    });
  }),
);

router.get(
  "/activity",
  asyncHandler(async (req, res) => {
    const limit = clampInt(req.query.limit, "limit", { min: 1, max: 100, fallback: 40 });
    const items = await ActivityLog.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.json({
      activity: items.map((a) => ({
        id: String(a._id),
        type: a.type,
        message: a.message,
        meta: a.meta,
        createdAt: a.createdAt,
      })),
    });
  }),
);

module.exports = router;
