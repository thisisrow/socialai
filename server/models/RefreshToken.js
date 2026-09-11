const mongoose = require("mongoose");

/**
 * One row per issued refresh token. Only the SHA-256 hash is stored, so a DB
 * leak does not hand out sessions. Rotated on every refresh; reusing a rotated
 * token revokes the whole family (replay detection).
 */
const RefreshTokenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    familyId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedByHash: { type: String, default: null },
    userAgent: { type: String, default: "" },
    ip: { type: String, default: "" },
  },
  { timestamps: true }
);

// Mongo drops expired rows on its own so the collection does not grow forever.
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.RefreshToken || mongoose.model("RefreshToken", RefreshTokenSchema);
