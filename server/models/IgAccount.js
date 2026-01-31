const mongoose = require("mongoose");

const IgAccountSchema = new mongoose.Schema(
    {
        appUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AppUser",
            required: true,
            unique: true,
            index: true,
        },
        basicUserId: { type: String, default: null },
        igBusinessId: { type: String, default: null },
        accessToken: { type: String, required: true },
        tokenType: { type: String, default: null },
        tokenExpiresAt: { type: Date, default: null },
    },
    { timestamps: true }
);

// indexes ONLY here (avoid duplicate warning)
IgAccountSchema.index({ basicUserId: 1 }, { unique: true, sparse: true });
IgAccountSchema.index({ igBusinessId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("IgAccount", IgAccountSchema);
