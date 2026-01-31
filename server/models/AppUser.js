const mongoose = require("mongoose");

const AppUserSchema = new mongoose.Schema(
    {
        email: { type: String, required: true, unique: true, index: true },
        passwordHash: { type: String, required: true },
    },
    { timestamps: true }
);

module.exports = mongoose.model("AppUser", AppUserSchema);
