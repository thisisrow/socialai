const mongoose = require("mongoose");
const { log } = require("../utils/helpers");

async function connectMongo() {
    if (!process.env.MONGODB_URI) throw new Error("Missing MONGODB_URI");
    await mongoose.connect(process.env.MONGODB_URI);
    log("✅ MongoDB connected");
}

module.exports = connectMongo;
