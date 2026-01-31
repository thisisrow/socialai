const mongoose = require("mongoose");

const ContextSchema = new mongoose.Schema(
    {
        appUserId: { type: mongoose.Schema.Types.ObjectId, ref: "AppUser", required: true, index: true },
        postId: { type: String, required: true, index: true },
        text: { type: String, required: true },
    },
    { timestamps: true }
);
ContextSchema.index({ appUserId: 1, postId: 1 }, { unique: true });
module.exports = mongoose.model("Context", ContextSchema);
