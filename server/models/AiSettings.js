const mongoose = require("mongoose");

/** Per-user brand voice. Turned into the Claude system prompt on every reply. */
const AiSettingsSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },

    businessName: { type: String, default: "" },
    businessDescription: { type: String, default: "" },
    tone: {
      type: String,
      enum: ["friendly", "professional", "playful", "concise", "enthusiastic"],
      default: "friendly",
    },
    language: { type: String, default: "English" },
    signature: { type: String, default: "" },
    maxSentences: { type: Number, default: 1, min: 1, max: 4 },
    useEmojis: { type: Boolean, default: true },
    // When the context does not answer the comment, send this instead of guessing.
    fallbackMessage: { type: String, default: "Thanks for reaching out! We'll get back to you shortly." },
    customInstructions: { type: String, default: "" },
    // Used for posts that have no context of their own.
    globalContext: { type: String, default: "" },
    // New posts inherit this when synced.
    autoReplyByDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.models.AiSettings || mongoose.model("AiSettings", AiSettingsSchema);
