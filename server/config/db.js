const mongoose = require("mongoose");

function log(...args) {
  console.log(new Date().toISOString(), "-", ...args);
}

async function connectMongo() {
  if (!process.env.MONGODB_URI) throw new Error("Missing MONGODB_URI");
  await mongoose.connect(process.env.MONGODB_URI);
  log("✅ MongoDB connected");
}

module.exports = connectMongo;
