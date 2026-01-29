// db.js (COMPLETE)
const mongoose = require("mongoose");

function log(...args) {
  console.log(new Date().toISOString(), "-", ...args);
}

const AppUserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);
const AppUser = mongoose.model("AppUser", AppUserSchema);

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

IgAccountSchema.index({ basicUserId: 1 }, { unique: true, sparse: true });
IgAccountSchema.index({ igBusinessId: 1 }, { unique: true, sparse: true });

const IgAccount = mongoose.model("IgAccount", IgAccountSchema);

const ContextSchema = new mongoose.Schema(
  {
    appUserId: { type: mongoose.Schema.Types.ObjectId, ref: "AppUser", required: true, index: true },
    postId: { type: String, required: true, index: true },
    text: { type: String, required: true },
  },
  { timestamps: true }
);
ContextSchema.index({ appUserId: 1, postId: 1 }, { unique: true });
const Context = mongoose.model("Context", ContextSchema);

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
const Replied = mongoose.model("Replied", RepliedSchema);

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
const PostState = mongoose.model("PostState", PostStateSchema);

async function connectMongo() {
  if (!process.env.MONGODB_URI) throw new Error("Missing MONGODB_URI");
  await mongoose.connect(process.env.MONGODB_URI);
  log("✅ MongoDB connected");
}

module.exports = {
  connectMongo,
  AppUser,
  IgAccount,
  Context,
  Replied,
  PostState,
};
