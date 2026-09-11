const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    commentId: { type: String, required: true },
    mediaId: { type: String, required: true },
    parentCommentId: { type: String, default: null },

    fromId: { type: String, default: "" },
    username: { type: String, default: "" },
    text: { type: String, default: "" },
    commentedAt: { type: Date, default: Date.now },

    // pending  - seen, no reply yet
    // replied  - a reply was posted to Instagram
    // skipped  - deliberately ignored (automation off, own comment, too old)
    // failed   - a reply was attempted and Instagram rejected it
    status: {
      type: String,
      enum: ["pending", "replied", "skipped", "failed"],
      default: "pending",
    },
    source: { type: String, enum: ["webhook", "sync"], default: "sync" },

    replyText: { type: String, default: "" },
    replyId: { type: String, default: "" },
    replyMode: { type: String, enum: ["ai", "manual", ""], default: "" },
    repliedAt: { type: Date, default: null },
    error: { type: String, default: "" },
  },
  { timestamps: true }
);

// The uniqueness guard that makes the webhook idempotent: Instagram redelivers
// events, and this index turns a duplicate into a no-op instead of a 2nd reply.
CommentSchema.index({ userId: 1, commentId: 1 }, { unique: true });
CommentSchema.index({ userId: 1, status: 1, commentedAt: -1 });
CommentSchema.index({ userId: 1, commentedAt: -1 });
CommentSchema.index({ userId: 1, mediaId: 1, commentedAt: -1 });

module.exports = mongoose.models.Comment || mongoose.model("Comment", CommentSchema);
