const mongoose = require("mongoose");
const { env } = require("../config/env");

const User = require("./User");
const RefreshToken = require("./RefreshToken");
const IgAccount = require("./IgAccount");
const Post = require("./Post");
const Comment = require("./Comment");
const AiSettings = require("./AiSettings");
const ActivityLog = require("./ActivityLog");

async function connectMongo() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.mongodbUri, { serverSelectionTimeoutMS: 15000 });
  return mongoose.connection;
}

async function disconnectMongo() {
  await mongoose.disconnect();
}

/** Fire-and-forget: a failed audit write must never break the request. */
function logActivity(userId, type, message, meta = {}) {
  ActivityLog.create({ userId, type, message, meta }).catch((e) =>
    console.error("[activity] write failed:", e.message)
  );
}

module.exports = {
  connectMongo,
  disconnectMongo,
  logActivity,
  User,
  RefreshToken,
  IgAccount,
  Post,
  Comment,
  AiSettings,
  ActivityLog,
};
