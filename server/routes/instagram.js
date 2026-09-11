const express = require("express");
const { IgAccount, Post, Comment, logActivity } = require("../models");
const { env } = require("../config/env");
const { requireAuth } = require("../middleware/requireAuth");
const { ApiError, asyncHandler, extractErrorMessage, isDuplicateKeyError } = require("../lib/errors");
const { requireString } = require("../lib/validate");
const ig = require("../lib/instagram");

const router = express.Router();

const IG_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_comments",
  "instagram_business_manage_messages",
  "instagram_business_content_publish",
  "instagram_business_manage_insights",
];

/**
 * The frontend asks the server for the authorize URL rather than building it
 * from a VITE_ variable, so the app id and redirect URI live in one place.
 */
router.get(
  "/authorize-url",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!env.instagramAppId) {
      throw ApiError.badRequest("INSTAGRAM_APP_ID is not configured on the server", "ig_not_configured");
    }
    const redirectUri = req.query.redirectUri
      ? String(req.query.redirectUri)
      : env.instagramRedirectUri;
    if (!redirectUri) {
      throw ApiError.badRequest(
        "INSTAGRAM_REDIRECT_URI is not configured on the server",
        "ig_not_configured",
      );
    }
    res.json({ url: ig.buildAuthorizeUrl({ redirectUri, scopes: IG_SCOPES }), redirectUri });
  }),
);

// --------------------------------------------------------------- connect ---
router.post(
  "/connect",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!env.instagramAppId || !env.instagramAppSecret) {
      throw ApiError.badRequest("Instagram app credentials are not configured", "ig_not_configured");
    }

    // Instagram appends "#_" to the code in the browser redirect.
    const code = requireString(req.body?.code, "code", { max: 1000 }).replace(/#_$/, "");
    const redirectUri = req.body?.redirectUri
      ? requireString(req.body.redirectUri, "redirectUri", { max: 500 })
      : env.instagramRedirectUri;
    if (!redirectUri) throw ApiError.badRequest("redirectUri is required", "validation_error");

    let shortLived;
    let longLived;
    let profile;
    try {
      shortLived = await ig.exchangeCodeForToken({ code, redirectUri });
      longLived = await ig.exchangeForLongLivedToken(shortLived.accessToken);
      profile = await ig.fetchProfile(longLived.accessToken);
    } catch (e) {
      const message = extractErrorMessage(e);
      logActivity(req.userId, "instagram.error", `Connect failed: ${message}`);
      throw new ApiError(e?.response?.status || 400, message, "ig_connect_failed");
    }

    // Both ids are captured now: igUserId (app-scoped) and igBusinessId (the id
    // webhooks arrive under). Storing both is what removes the old guesswork.
    const update = {
      userId: req.userId,
      igUserId: profile.igUserId || shortLived.userId,
      igBusinessId: profile.igBusinessId || profile.igUserId || shortLived.userId,
      username: profile.username,
      accountType: profile.accountType,
      profilePictureUrl: profile.profilePictureUrl,
      followersCount: profile.followersCount,
      mediaCount: profile.mediaCount,
      accessToken: longLived.accessToken,
      tokenType: longLived.tokenType,
      tokenExpiresAt: longLived.expiresAt,
      lastRefreshedAt: new Date(),
      connectedAt: new Date(),
      invalidatedAt: null,
      lastError: "",
    };

    let account;
    try {
      account = await IgAccount.findOneAndUpdate(
        { userId: req.userId },
        { $set: update },
        { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true },
      );
    } catch (e) {
      if (isDuplicateKeyError(e)) {
        // The unique index on igBusinessId is intentional: one Instagram account
        // must not be driven by two tenants, or both would reply to every comment.
        throw ApiError.conflict(
          "That Instagram account is already connected to another SocialAI account.",
          "ig_already_linked",
        );
      }
      throw e;
    }

    logActivity(req.userId, "instagram.connected", `Connected @${profile.username}`, {
      igBusinessId: account.igBusinessId,
    });

    res.json({ instagram: account.toPublic() });
  }),
);

// ------------------------------------------------------------ disconnect ---
router.delete(
  "/connect",
  requireAuth,
  asyncHandler(async (req, res) => {
    const account = await IgAccount.findOne({ userId: req.userId });
    if (!account) throw ApiError.notFound("No Instagram account is connected", "ig_not_connected");

    const purge = req.query.purge === "true";
    await IgAccount.deleteOne({ _id: account._id });
    if (purge) {
      await Promise.all([
        Post.deleteMany({ userId: req.userId }),
        Comment.deleteMany({ userId: req.userId }),
      ]);
    }

    logActivity(req.userId, "instagram.disconnected", `Disconnected @${account.username}`);
    res.json({ ok: true, purged: purge });
  }),
);

// ---------------------------------------------------------------- status ---
router.get(
  "/status",
  requireAuth,
  asyncHandler(async (req, res) => {
    const account = await IgAccount.findOne({ userId: req.userId });
    if (!account) return res.json({ connected: false });

    // Refresh opportunistically while the user is looking at the page.
    await ig.ensureFreshToken(account);
    res.json(account.toPublic());
  }),
);

module.exports = { router, IG_SCOPES };
