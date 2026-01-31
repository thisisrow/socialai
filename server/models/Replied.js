const mongoose = require("mongoose");

const RepliedSchema = new mongoose.Schema(
    {
        appUserId: { type: mongoose.Schema.Types.ObjectId, ref: "AppUser", required: true, index: true },
        postId: { type: String, required: true, index: true },
        commentId: { type: String, required: true, index: true },
        repliedAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);
RepliedSchema.index({ appUserId: 1, commentId: 1 }, { unique: true });
module.exports = mongoose.model("Replied", RepliedSchema);
