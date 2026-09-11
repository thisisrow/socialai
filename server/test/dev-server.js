/**
 * Boots the API against a throwaway in-memory MongoDB, seeded with a demo
 * account and sample data. For local UI work without a real Mongo or a real
 * Instagram app. Everything is discarded when the process exits.
 *
 * Run: npm run dev:demo
 */
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = process.env.NODE_ENV || "development";
process.env.JWT_SECRET = process.env.JWT_SECRET || "demo-secret-that-is-long-enough-for-validation-32";
process.env.VERIFY_TOKEN = process.env.VERIFY_TOKEN || "demo-verify-token";
process.env.CORS_ORIGINS = process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:4173";

const DEMO = { email: "demo@socialai.app", password: "demo1234", name: "Demo User" };

const CAPTIONS = [
  "Fresh pasta, made this morning. Come get it while it lasts.",
  "New autumn menu drops Friday. Three new plates, one very good dessert.",
  "Behind the scenes: our kitchen at 6am.",
  "Sunday roast is back. Bookings open now.",
  "We are hiring a part-time barista. DM for details.",
  "Thank you for an incredible first year.",
];

const COMMENTS = [
  ["pasta_lover_88", "Do you deliver?"],
  ["marco.eats", "What time do you open on Sundays?"],
  ["jules_k", "This looks incredible!!"],
  ["hungry.in.lisbon", "How much is the pasta special?"],
  ["sofia_r", "Do you have gluten free options?"],
  ["tomtomtom", "Is the barista job still open?"],
  ["ana.m", "Can I book a table for 8 people?"],
  ["chef_dan", "Recipe please 🙏"],
];

async function main() {
  const mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri("socialai_demo");

  const { connectMongo, User, AiSettings, IgAccount, Post, Comment, ActivityLog } = require("../models");
  const { hashPassword } = require("../lib/auth");
  const { env } = require("../config/env");
  const { app } = require("../app");

  await connectMongo();

  const user = await User.create({
    email: DEMO.email,
    name: DEMO.name,
    passwordHash: await hashPassword(DEMO.password),
    lastLoginAt: new Date(),
  });

  await AiSettings.create({
    userId: user._id,
    businessName: "Rumo Kitchen",
    businessDescription: "A neighbourhood Italian kitchen in Lisbon, open for lunch and dinner.",
    tone: "friendly",
    globalContext:
      "Open 11am to 11pm daily.\nTakeaway available, no delivery.\nBookings through the link in bio.\nThe pasta special is 12 EUR and runs on Fridays.",
  });

  await IgAccount.create({
    userId: user._id,
    igUserId: "demo-app-scoped-id",
    igBusinessId: "demo-business-id",
    username: "rumokitchen",
    accountType: "BUSINESS",
    followersCount: 4821,
    accessToken: "demo-token-not-real",
    tokenExpiresAt: new Date(Date.now() + 55 * 24 * 60 * 60 * 1000),
    lastSyncedAt: new Date(),
  });

  const day = 24 * 60 * 60 * 1000;

  for (let i = 0; i < CAPTIONS.length; i += 1) {
    const automated = i < 4;
    await Post.create({
      userId: user._id,
      mediaId: `demo-media-${i}`,
      igBusinessId: "demo-business-id",
      caption: CAPTIONS[i],
      mediaType: i === 2 ? "VIDEO" : "IMAGE",
      // picsum gives stable, real images so the grid looks like the real thing.
      mediaUrl: `https://picsum.photos/seed/socialai${i}/600/600`,
      thumbnailUrl: `https://picsum.photos/seed/socialai${i}/300/300`,
      permalink: "https://instagram.com",
      postedAt: new Date(Date.now() - (i + 1) * 2 * day),
      likeCount: 120 + i * 37,
      commentsCount: 2,
      autoReplyEnabled: automated,
      autoReplySince: automated ? new Date(Date.now() - 10 * day) : null,
      context: i < 3 ? "Open 11am-11pm daily. Takeaway only, no delivery." : "",
      repliesSent: automated ? 2 + i : 0,
    });
  }

  for (let i = 0; i < COMMENTS.length; i += 1) {
    const [username, text] = COMMENTS[i];
    const replied = i % 3 === 0;
    const failed = i === 5;
    await Comment.create({
      userId: user._id,
      commentId: `demo-comment-${i}`,
      mediaId: `demo-media-${i % CAPTIONS.length}`,
      username,
      text,
      fromId: `demo-follower-${i}`,
      commentedAt: new Date(Date.now() - i * 5 * 60 * 60 * 1000),
      source: i % 2 ? "webhook" : "sync",
      status: failed ? "failed" : replied ? "replied" : "pending",
      replyMode: replied ? "ai" : "",
      replyText: replied ? "We are takeaway only at the moment, but we would love to see you in person!" : "",
      repliedAt: replied ? new Date(Date.now() - i * 5 * 60 * 60 * 1000 + 120000) : null,
      error: failed ? "Instagram rejected the reply: comment no longer available" : "",
    });
  }

  const activity = [
    ["instagram.connected", "Connected @rumokitchen", 9],
    ["posts.synced", "Synced 6 posts", 8],
    ["automation.enabled", "Auto-reply enabled on 4 posts", 7],
    ["reply.sent", "Auto-replied to @pasta_lover_88", 5],
    ["reply.sent", "Auto-replied to @jules_k", 3],
    ["reply.failed", "Auto-reply to @tomtomtom failed: comment no longer available", 2],
    ["settings.updated", "AI settings updated", 1],
  ];
  for (const [type, message, hoursAgo] of activity) {
    await ActivityLog.create({
      userId: user._id,
      type,
      message,
      createdAt: new Date(Date.now() - hoursAgo * 60 * 60 * 1000),
    });
  }

  app.listen(env.port, () => {
    console.log("\n  SocialAI demo API (in-memory database, data is not persisted)");
    console.log(`  http://localhost:${env.port}`);
    console.log(`\n  Sign in with:  ${DEMO.email}  /  ${DEMO.password}`);
    console.log(`  Claude model:  ${env.claudeModel} (${env.anthropicApiKey ? "key set" : "no key"})\n`);
  });
}

main().catch((e) => {
  console.error("Demo server failed to start:", e);
  process.exit(1);
});
