const mongoose = require("mongoose");

const MediaOwnerSchema = new mongoose.Schema(
    {
        postId: { type: String, required: true, unique: true, index: true },
        appUserId: { type: mongoose.Schema.Types.ObjectId, ref: "AppUser", required: true, index: true },
        basicUserId: { type: String, default: null, index: true },
        igBusinessId: { type: String, default: null, index: true },
    },
    { timestamps: true }
);
module.exports = mongoose.model("MediaOwner", MediaOwnerSchema);
