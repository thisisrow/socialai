const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, default: "" },
    passwordHash: { type: String, required: true },
    // Bumped on password change / "log out everywhere" so old access tokens stop verifying.
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

UserSchema.methods.toPublic = function toPublic() {
  return {
    id: String(this._id),
    email: this.email,
    name: this.name || "",
    createdAt: this.createdAt,
    lastLoginAt: this.lastLoginAt,
  };
};

module.exports = mongoose.models.User || mongoose.model("User", UserSchema);
