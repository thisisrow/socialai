/**
 * End-to-end smoke test against a throwaway in-memory MongoDB.
 *
 * Covers the parts that are easy to get subtly wrong: auth token lifecycle,
 * refresh rotation and replay detection, per-user data isolation, webhook
 * signature verification, and webhook-to-tenant routing.
 *
 * Run: npm test
 */
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { MongoMemoryServer } = require("mongodb-memory-server");

/*
 * Set every variable the app reads BEFORE anything requires config/env.
 * dotenv does not overwrite keys that are already present, so assigning here -
 * including the empty string for ANTHROPIC_API_KEY - makes the run hermetic
 * whether or not a developer has a real server/.env on disk.
 */
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-that-is-definitely-long-enough-32";
process.env.INSTAGRAM_APP_ID = "test-app-id";
process.env.INSTAGRAM_APP_SECRET = "test-app-secret";
process.env.INSTAGRAM_REDIRECT_URI = "http://localhost:5173/auth/instagram/callback";
process.env.VERIFY_TOKEN = "test-verify-token";
process.env.CORS_ORIGINS = "http://localhost:5173";
process.env.CLAUDE_MODEL = "claude-opus-5";
// Empty, not deleted: exercises the fallback path with no network calls.
process.env.ANTHROPIC_API_KEY = "";

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failed += 1;
    console.error(`  FAIL  ${name}\n        ${e.message}`);
  }
}

async function main() {
  const mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri("socialai_test");

  const { connectMongo, disconnectMongo, IgAccount, Post, Comment } = require("../models");
  const { app } = require("../app");
  await connectMongo();

  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const call = async (path, { method = "GET", body, token } = {}) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
    return { status: res.status, body: json };
  };

  console.log("\nHealth & config");
  await test("GET /health reports database + model", async () => {
    const { status, body } = await call("/health");
    assert.equal(status, 200);
    assert.equal(body.database, "connected");
    assert.equal(body.ai, "missing_key");
  });

  console.log("\nValidation");
  await test("signup rejects a weak password", async () => {
    const { status, body } = await call("/api/auth/signup", {
      method: "POST",
      body: { email: "weak@example.com", password: "short" },
    });
    assert.equal(status, 400);
    assert.equal(body.code, "validation_error");
  });

  await test("signup rejects a malformed email", async () => {
    const { status } = await call("/api/auth/signup", {
      method: "POST",
      body: { email: "not-an-email", password: "password123" },
    });
    assert.equal(status, 400);
  });

  console.log("\nAuth lifecycle");
  let alice;
  let bob;
  let aliceInstagramState;

  await test("signup returns an access + refresh token pair", async () => {
    const { status, body } = await call("/api/auth/signup", {
      method: "POST",
      body: { name: "Alice", email: "alice@example.com", password: "password123" },
    });
    assert.equal(status, 201);
    assert.ok(body.accessToken && body.refreshToken);
    assert.equal(body.user.email, "alice@example.com");
    assert.equal(body.user.passwordHash, undefined, "password hash must never be serialised");
    alice = body;
  });

  await test("duplicate signup is rejected with 409", async () => {
    const { status, body } = await call("/api/auth/signup", {
      method: "POST",
      body: { email: "alice@example.com", password: "password123" },
    });
    assert.equal(status, 409);
    assert.equal(body.code, "email_taken");
  });

  await test("login with a wrong password does not leak account existence", async () => {
    const wrongPass = await call("/api/auth/login", {
      method: "POST",
      body: { email: "alice@example.com", password: "wrongpassword1" },
    });
    const noSuchUser = await call("/api/auth/login", {
      method: "POST",
      body: { email: "nobody@example.com", password: "wrongpassword1" },
    });
    assert.equal(wrongPass.status, 401);
    assert.equal(noSuchUser.status, 401);
    assert.equal(wrongPass.body.error, noSuchUser.body.error);
  });

  await test("protected route rejects a missing token", async () => {
    const { status, body } = await call("/api/auth/me");
    assert.equal(status, 401);
    assert.equal(body.code, "token_missing");
  });

  await test("protected route rejects a forged token", async () => {
    const { status } = await call("/api/auth/me", { token: "not.a.jwt" });
    assert.equal(status, 401);
  });

  await test("GET /api/auth/me returns the caller", async () => {
    const { status, body } = await call("/api/auth/me", { token: alice.accessToken });
    assert.equal(status, 200);
    assert.equal(body.user.email, "alice@example.com");
    assert.equal(body.instagram.connected, false);
  });

  console.log("\nInstagram OAuth");
  await test("authorize URL includes a signed, user-bound state", async () => {
    const { status, body } = await call("/api/instagram/authorize-url", {
      token: alice.accessToken,
    });
    assert.equal(status, 200);
    const url = new URL(body.url);
    assert.equal(url.searchParams.get("redirect_uri"), process.env.INSTAGRAM_REDIRECT_URI);
    aliceInstagramState = url.searchParams.get("state");
    assert.ok(aliceInstagramState, "OAuth state must be present");
    assert.deepEqual(
      url.searchParams.get("scope").split(",").sort(),
      ["instagram_business_basic", "instagram_business_manage_comments"].sort(),
      "request only the permissions this product uses",
    );
  });

  await test("authorize URL rejects a redirect URI that differs from server config", async () => {
    const { status, body } = await call(
      "/api/instagram/authorize-url?redirectUri=https%3A%2F%2Fevil.example%2Fcallback",
      { token: alice.accessToken },
    );
    assert.equal(status, 400);
    assert.equal(body.code, "ig_redirect_mismatch");
  });

  await test("connect rejects a missing OAuth state before token exchange", async () => {
    const { status, body } = await call("/api/instagram/connect", {
      method: "POST",
      token: alice.accessToken,
      body: { code: "not-a-real-code", redirectUri: process.env.INSTAGRAM_REDIRECT_URI },
    });
    assert.equal(status, 400);
    assert.equal(body.code, "ig_oauth_state_invalid");
  });

  console.log("\nRefresh token rotation");
  let rotated;
  await test("refresh issues a new pair", async () => {
    const { status, body } = await call("/api/auth/refresh", {
      method: "POST",
      body: { refreshToken: alice.refreshToken },
    });
    assert.equal(status, 200);
    assert.notEqual(body.refreshToken, alice.refreshToken, "refresh token must rotate");
    rotated = body;
  });

  await test("replaying a rotated refresh token is refused", async () => {
    const { status, body } = await call("/api/auth/refresh", {
      method: "POST",
      body: { refreshToken: alice.refreshToken },
    });
    assert.equal(status, 401);
    assert.equal(body.code, "refresh_reused");
  });

  await test("replay revokes the whole token family", async () => {
    const { status } = await call("/api/auth/refresh", {
      method: "POST",
      body: { refreshToken: rotated.refreshToken },
    });
    assert.equal(status, 401, "the rotated sibling must be revoked by the replay");
  });

  await test("re-login works after a family revocation", async () => {
    const { status, body } = await call("/api/auth/login", {
      method: "POST",
      body: { email: "alice@example.com", password: "password123" },
    });
    assert.equal(status, 200);
    alice = body;
  });

  await test("changing the password invalidates existing access tokens", async () => {
    const stale = alice.accessToken;
    const changed = await call("/api/auth/change-password", {
      method: "POST",
      token: alice.accessToken,
      body: { currentPassword: "password123", newPassword: "newpassword456" },
    });
    assert.equal(changed.status, 200);
    assert.ok(changed.body.accessToken);

    const withStale = await call("/api/auth/me", { token: stale });
    assert.equal(withStale.status, 401);
    assert.equal(withStale.body.code, "token_stale");

    alice = changed.body;
  });

  console.log("\nMulti-user isolation");
  await test("second account can sign up", async () => {
    const { status, body } = await call("/api/auth/signup", {
      method: "POST",
      body: { name: "Bob", email: "bob@example.com", password: "password123" },
    });
    assert.equal(status, 201);
    bob = body;
  });

  await test("an OAuth state cannot be used by another SocialAI user", async () => {
    const { status, body } = await call("/api/instagram/connect", {
      method: "POST",
      token: bob.accessToken,
      body: {
        code: "not-a-real-code",
        state: aliceInstagramState,
        redirectUri: process.env.INSTAGRAM_REDIRECT_URI,
      },
    });
    assert.equal(status, 400);
    assert.equal(body.code, "ig_oauth_state_invalid");
  });

  // Seed each tenant with a connected account and one post, bypassing the real
  // Instagram OAuth flow.
  const seed = async (session, igBusinessId, mediaId) => {
    const userId = session.user.id;
    await IgAccount.create({
      userId,
      igUserId: `${igBusinessId}-app`,
      igBusinessId,
      username: `acct_${igBusinessId}`,
      accessToken: `token-${igBusinessId}`,
      tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    });
    await Post.create({
      userId,
      mediaId,
      igBusinessId,
      caption: `Post for ${igBusinessId}`,
      autoReplyEnabled: false,
      context: "Secret context",
    });
  };

  await seed(alice, "1111", "media-alice");
  await seed(bob, "2222", "media-bob");

  await test("sync imports posts without overwriting saved context or automation", async () => {
    const instagramApi = require("../lib/instagram");
    const originals = {
      ensureFreshToken: instagramApi.ensureFreshToken,
      fetchMedia: instagramApi.fetchMedia,
      fetchComments: instagramApi.fetchComments,
    };
    instagramApi.ensureFreshToken = async () => "test-token";
    instagramApi.fetchMedia = async () => [
      {
        id: "media-alice",
        caption: "Updated caption from Instagram",
        media_type: "IMAGE",
        timestamp: new Date().toISOString(),
        comments_count: 0,
      },
      {
        id: "media-alice-new",
        caption: "Newly synced post",
        media_type: "IMAGE",
        timestamp: new Date().toISOString(),
        comments_count: 0,
      },
    ];
    instagramApi.fetchComments = async () => [];

    try {
      const { status, body } = await call("/api/posts/sync", {
        method: "POST",
        token: alice.accessToken,
        body: { limit: 25 },
      });
      assert.equal(status, 200);
      assert.equal(body.posts, 2);

      const existing = await Post.findOne({ userId: alice.user.id, mediaId: "media-alice" }).lean();
      const imported = await Post.findOne({ userId: alice.user.id, mediaId: "media-alice-new" }).lean();
      assert.equal(existing.caption, "Updated caption from Instagram");
      assert.equal(existing.context, "Secret context");
      assert.equal(existing.autoReplyEnabled, false);
      assert.ok(imported, "the new Instagram post should be stored");
    } finally {
      Object.assign(instagramApi, originals);
      await Post.deleteOne({ userId: alice.user.id, mediaId: "media-alice-new" });
    }
  });

  await test("each user sees only their own posts", async () => {
    const a = await call("/api/posts", { token: alice.accessToken });
    const b = await call("/api/posts", { token: bob.accessToken });
    assert.equal(a.body.posts.length, 1);
    assert.equal(b.body.posts.length, 1);
    assert.equal(a.body.posts[0].mediaId, "media-alice");
    assert.equal(b.body.posts[0].mediaId, "media-bob");
  });

  await test("a user cannot read another user's post by id", async () => {
    const { status } = await call("/api/posts/media-bob", { token: alice.accessToken });
    assert.equal(status, 404, "cross-tenant reads must 404, not leak");
  });

  await test("a user cannot toggle another user's automation", async () => {
    const { status } = await call("/api/posts/media-bob/automation", {
      method: "PUT",
      token: alice.accessToken,
      body: { enabled: true },
    });
    assert.equal(status, 404);
    const post = await Post.findOne({ mediaId: "media-bob" }).lean();
    assert.equal(post.autoReplyEnabled, false, "Bob's post must be untouched");
  });

  await test("a user cannot overwrite another user's context", async () => {
    await call("/api/posts/media-bob/context", {
      method: "PUT",
      token: alice.accessToken,
      body: { context: "hijacked" },
    });
    const post = await Post.findOne({ mediaId: "media-bob" }).lean();
    assert.equal(post.context, "Secret context");
  });

  await test("a user can save and clear instructions for their own post", async () => {
    const saved = await call("/api/posts/media-alice/context", {
      method: "PUT",
      token: alice.accessToken,
      body: { context: "Open daily from 9am to 6pm." },
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.hasContext, true);

    const cleared = await call("/api/posts/media-alice/context", {
      method: "PUT",
      token: alice.accessToken,
      body: { context: "" },
    });
    assert.equal(cleared.status, 200);
    assert.equal(cleared.body.hasContext, false);
  });

  await test("a user can turn automation on and off for their own post", async () => {
    const enabled = await call("/api/posts/media-alice/automation", {
      method: "PUT",
      token: alice.accessToken,
      body: { enabled: true },
    });
    assert.equal(enabled.status, 200);
    assert.equal(enabled.body.autoReplyEnabled, true);
    assert.ok(enabled.body.autoReplySince, "enabling must stamp the backlog cutoff");

    const disabled = await call("/api/posts/media-alice/automation", {
      method: "PUT",
      token: alice.accessToken,
      body: { enabled: false },
    });
    assert.equal(disabled.status, 200);
    assert.equal(disabled.body.autoReplyEnabled, false);
    assert.equal(disabled.body.autoReplySince, null);
  });

  await test("bulk automation only touches the caller's posts", async () => {
    const { status, body } = await call("/api/posts/automation/bulk", {
      method: "POST",
      token: alice.accessToken,
      body: { enabled: true },
    });
    assert.equal(status, 200);
    assert.equal(body.updated, 1);
    const bobPost = await Post.findOne({ mediaId: "media-bob" }).lean();
    assert.equal(bobPost.autoReplyEnabled, false);
  });

  console.log("\nAI settings");
  await test("settings are created on first read and scoped per user", async () => {
    const a = await call("/api/ai/settings", { token: alice.accessToken });
    assert.equal(a.status, 200);
    assert.equal(a.body.configured, false);
    assert.equal(a.body.settings.tone, "friendly");

    await call("/api/ai/settings", {
      method: "PUT",
      token: alice.accessToken,
      body: {
        tone: "playful",
        businessName: "Alice Co",
        customInstructions: "Never mention competitors.",
        autoReplyByDefault: true,
      },
    });

    const b = await call("/api/ai/settings", { token: bob.accessToken });
    assert.equal(b.body.settings.tone, "friendly", "Bob must not see Alice's settings");
    assert.equal(b.body.settings.businessName, "", "signup must not guess a business name");

    const aAgain = await call("/api/ai/settings", { token: alice.accessToken });
    assert.equal(aAgain.body.settings.customInstructions, "Never mention competitors.");
    assert.equal(aAgain.body.settings.autoReplyByDefault, true);
  });

  await test("an invalid tone is rejected", async () => {
    const { status } = await call("/api/ai/settings", {
      method: "PUT",
      token: alice.accessToken,
      body: { tone: "sarcastic" },
    });
    assert.equal(status, 400);
  });

  await test("preview falls back gracefully with no API key", async () => {
    const { status, body } = await call("/api/ai/preview", {
      method: "POST",
      token: alice.accessToken,
      body: { comment: "Do you deliver?" },
    });
    assert.equal(status, 200);
    assert.equal(body.ok, false);
    assert.equal(body.code, "ai_not_configured");
    assert.ok(body.reply.length, "a fallback reply must still be returned");
  });

  console.log("\nWebhook");
  const sign = (raw) =>
    `sha256=${crypto.createHmac("sha256", process.env.INSTAGRAM_APP_SECRET).update(raw).digest("hex")}`;

  const postWebhook = async (payload, signature) => {
    const raw = JSON.stringify(payload);
    const res = await fetch(`${base}/api/webhook/instagram`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(signature === null ? {} : { "X-Hub-Signature-256": signature ?? sign(raw) }),
      },
      body: raw,
    });
    return res.status;
  };

  const commentEvent = (igBusinessId, mediaId, commentId, text) => ({
    object: "instagram",
    entry: [
      {
        id: igBusinessId,
        changes: [
          {
            field: "comments",
            value: {
              id: commentId,
              text,
              from: { id: "follower-1", username: "curious_cat" },
              media: { id: mediaId },
              timestamp: Math.floor(Date.now() / 1000),
            },
          },
        ],
      },
    ],
  });

  await test("verification handshake accepts the right token", async () => {
    const res = await fetch(
      `${base}/api/webhook/instagram?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=abc123`,
    );
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "abc123");
  });

  await test("verification handshake rejects a wrong token", async () => {
    const res = await fetch(
      `${base}/api/webhook/instagram?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc123`,
    );
    assert.equal(res.status, 403);
  });

  await test("unsigned webhook payloads are rejected", async () => {
    const status = await postWebhook(commentEvent("1111", "media-alice", "c-unsigned", "hi"), null);
    assert.equal(status, 403);
    const saved = await Comment.findOne({ commentId: "c-unsigned" });
    assert.equal(saved, null, "an unsigned payload must not create a comment");
  });

  await test("badly signed webhook payloads are rejected", async () => {
    const status = await postWebhook(
      commentEvent("1111", "media-alice", "c-badsig", "hi"),
      "sha256=deadbeef",
    );
    assert.equal(status, 403);
  });

  const settle = () => new Promise((r) => setTimeout(r, 400));

  await test("a signed comment is routed to the owning user", async () => {
    const status = await postWebhook(commentEvent("1111", "media-alice", "c-1", "Do you deliver?"));
    assert.equal(status, 200);
    await settle();

    const saved = await Comment.findOne({ commentId: "c-1" }).lean();
    assert.ok(saved, "the comment should have been stored");
    assert.equal(String(saved.userId), alice.user.id, "routed to the wrong tenant");
    assert.equal(saved.source, "webhook");
  });

  await test("redelivery of the same comment is idempotent", async () => {
    await postWebhook(commentEvent("1111", "media-alice", "c-1", "Do you deliver?"));
    await settle();
    const count = await Comment.countDocuments({ commentId: "c-1" });
    assert.equal(count, 1, "a redelivered event must not create a second comment");
  });

  await test("comments from the account owner are ignored", async () => {
    const event = commentEvent("1111", "media-alice", "c-own", "our own reply");
    event.entry[0].changes[0].value.from = { id: "1111", username: "acct_1111" };
    await postWebhook(event);
    await settle();
    assert.equal(await Comment.countDocuments({ commentId: "c-own" }), 0);
  });

  await test("threaded replies are ignored", async () => {
    const event = commentEvent("1111", "media-alice", "c-thread", "nested");
    event.entry[0].changes[0].value.parent_id = "c-1";
    await postWebhook(event);
    await settle();
    assert.equal(await Comment.countDocuments({ commentId: "c-thread" }), 0);
  });

  await test("an event for an unknown account is dropped", async () => {
    await postWebhook(commentEvent("9999", "media-unknown", "c-unknown", "hello"));
    await settle();
    assert.equal(await Comment.countDocuments({ commentId: "c-unknown" }), 0);
  });

  await test("routing uses entry id, not the media owner, across tenants", async () => {
    await postWebhook(commentEvent("2222", "media-bob", "c-2", "Bob question"));
    await settle();
    const saved = await Comment.findOne({ commentId: "c-2" }).lean();
    assert.ok(saved);
    assert.equal(String(saved.userId), bob.user.id);
  });

  await test("a comment made before automation was enabled is skipped", async () => {
    await Post.updateOne(
      { mediaId: "media-alice" },
      { $set: { autoReplyEnabled: true, autoReplySince: new Date() } },
    );
    const event = commentEvent("1111", "media-alice", "c-old", "old question");
    // An hour before the toggle: unambiguously backlog.
    event.entry[0].changes[0].value.timestamp = Math.floor((Date.now() - 3600_000) / 1000);
    await postWebhook(event);
    await settle();

    const saved = await Comment.findOne({ commentId: "c-old" }).lean();
    assert.ok(saved);
    assert.equal(saved.status, "skipped");
    assert.match(saved.error, /Predates automation/);
  });

  await test("a comment in the same second as the toggle is not backlog", async () => {
    await Post.updateOne(
      { mediaId: "media-alice" },
      { $set: { autoReplyEnabled: true, autoReplySince: new Date() } },
    );
    // Instagram timestamps are second-resolution, so this can read as slightly
    // older than autoReplySince even though it arrived after it.
    await postWebhook(commentEvent("1111", "media-alice", "c-edge", "edge case"));
    await settle();

    const saved = await Comment.findOne({ commentId: "c-edge" }).lean();
    assert.ok(saved);
    assert.notEqual(saved.status, "skipped", "boundary comment must not be dropped as backlog");
    // There are no real Instagram credentials here, so the send is expected to
    // fail - what matters is that a reply was attempted at all.
    assert.equal(saved.status, "failed");
  });

  console.log("\nInbox");
  await test("each user only sees their own comments", async () => {
    const a = await call("/api/comments", { token: alice.accessToken });
    const b = await call("/api/comments", { token: bob.accessToken });
    const aIds = a.body.comments.map((c) => c.commentId);
    const bIds = b.body.comments.map((c) => c.commentId);
    assert.ok(aIds.includes("c-1"));
    assert.ok(!aIds.includes("c-2"));
    assert.ok(bIds.includes("c-2"));
    assert.ok(!bIds.includes("c-1"));
  });

  await test("stats are scoped per user", async () => {
    const { status, body } = await call("/api/stats/overview", { token: alice.accessToken });
    assert.equal(status, 200);
    assert.equal(body.totals.posts, 1);
    assert.equal(body.series.length, 14);
    assert.equal(body.instagram.connected, true);
  });

  console.log("\nLogout");
  await test("logout revokes the refresh token", async () => {
    const logout = await call("/api/auth/logout", {
      method: "POST",
      body: { refreshToken: alice.refreshToken },
    });
    assert.equal(logout.status, 200);

    const after = await call("/api/auth/refresh", {
      method: "POST",
      body: { refreshToken: alice.refreshToken },
    });
    assert.equal(after.status, 401);
  });

  await test("unknown routes return a JSON 404", async () => {
    const { status, body } = await call("/api/does-not-exist");
    assert.equal(status, 404);
    assert.equal(body.code, "route_not_found");
  });

  server.close();
  await disconnectMongo();
  await mongo.stop();

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("Smoke test crashed:", e);
  process.exit(1);
});
