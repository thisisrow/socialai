const mongoose = require("mongoose");

/** Append-only feed powering the dashboard timeline. Capped by a TTL index. */
const ActivityLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: [
        "auth.login",
        "auth.signup",
        "instagram.connected",
        "instagram.disconnected",
        "instagram.error",
        "posts.synced",
        "automation.enabled",
        "automation.disabled",
        "reply.sent",
        "reply.failed",
        "context.updated",
        "settings.updated",
      ],
      required: true,
    },
    message: { type: String, default: "" },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    // No `index: true` here: declaring it both ways makes Mongo keep only the
    // first definition and silently drop expireAfterSeconds, so the TTL below
    // would never take effect.
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

ActivityLogSchema.index({ userId: 1, createdAt: -1 });
ActivityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

module.exports = mongoose.models.ActivityLog || mongoose.model("ActivityLog", ActivityLogSchema);
