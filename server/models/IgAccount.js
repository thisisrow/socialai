const mongoose = require("mongoose");

/**
 * A connected Instagram professional account.
 *
 * Two different Instagram IDs matter and confusing them is what broke webhook
 * routing before:
 *   - igUserId      : app-scoped id returned by the OAuth token exchange.
 *   - igBusinessId  : the professional account id (`me?fields=user_id`). This is
 *                     what arrives as `entry[].id` on webhook events.
 * Both are captured at connect time and both are indexed, so an inbound webhook
 * resolves to exactly one user with a single query and no guesswork.
 */
const IgAccountSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    igUserId: { type: String, default: null },
    igBusinessId: { type: String, default: null },
    username: { type: String, default: "" },
    accountType: { type: String, default: "" },
    profilePictureUrl: { type: String, default: "" },
    followersCount: { type: Number, default: 0 },
    mediaCount: { type: Number, default: 0 },

    accessToken: { type: String, required: true },
    tokenType: { type: String, default: "bearer" },
    tokenExpiresAt: { type: Date, default: null },
    lastRefreshedAt: { type: Date, default: null },

    connectedAt: { type: Date, default: Date.now },
    lastSyncedAt: { type: Date, default: null },
    // Set when Instagram rejects the token so the UI can prompt a reconnect.
    invalidatedAt: { type: Date, default: null },
    lastError: { type: String, default: "" },
  },
  { timestamps: true }
);

IgAccountSchema.index({ igUserId: 1 }, { unique: true, sparse: true });
IgAccountSchema.index({ igBusinessId: 1 }, { unique: true, sparse: true });

IgAccountSchema.methods.toPublic = function toPublic() {
  return {
    connected: true,
    igUserId: this.igUserId,
    igBusinessId: this.igBusinessId,
    username: this.username,
    accountType: this.accountType,
    profilePictureUrl: this.profilePictureUrl,
    followersCount: this.followersCount,
    mediaCount: this.mediaCount,
    connectedAt: this.connectedAt,
    lastSyncedAt: this.lastSyncedAt,
    tokenExpiresAt: this.tokenExpiresAt,
    needsReconnect: Boolean(this.invalidatedAt),
    lastError: this.lastError || "",
  };
};

module.exports = mongoose.models.IgAccount || mongoose.model("IgAccount", IgAccountSchema);
