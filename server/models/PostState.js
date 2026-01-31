const mongoose = require("mongoose");

const PostStateSchema = new mongoose.Schema(
    {
        appUserId: { type: mongoose.Schema.Types.ObjectId, ref: "AppUser", required: true, index: true },
        postId: { type: String, required: true, index: true },
        autoReplyEnabled: { type: Boolean, default: false },
        sinceMs: { type: Number, default: null },
    },
    { timestamps: true }
);
PostStateSchema.index({ appUserId: 1, postId: 1 }, { unique: true });
module.exports = mongoose.model("PostState", PostStateSchema);
