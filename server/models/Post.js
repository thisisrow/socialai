const mongoose = require("mongoose");

/**
 * A synced Instagram media item. Owning it locally means the CRM lists posts
 * instantly and the webhook can resolve `mediaId -> user` without calling Meta.
 */
const PostSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    mediaId: { type: String, required: true },
    igBusinessId: { type: String, default: null, index: true },

    caption: { type: String, default: "" },
    mediaType: { type: String, default: "" },
    mediaUrl: { type: String, default: "" },
    thumbnailUrl: { type: String, default: "" },
    permalink: { type: String, default: "" },
    postedAt: { type: Date, default: null },

    likeCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },

    // --- Automation config, per post ---
    autoReplyEnabled: { type: Boolean, default: false },
    // Comments older than this are ignored, so turning automation on does not
    // fire off replies to a year of backlog.
    autoReplySince: { type: Date, default: null },
    context: { type: String, default: "" },

    repliesSent: { type: Number, default: 0 },
    lastSyncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// { userId, mediaId } also serves every userId-only query as a prefix.
PostSchema.index({ userId: 1, mediaId: 1 }, { unique: true });
PostSchema.index({ userId: 1, postedAt: -1 });
// Standalone mediaId lookup: the webhook resolves an unknown media to its owner.
PostSchema.index({ mediaId: 1 });

module.exports = mongoose.models.Post || mongoose.model("Post", PostSchema);
