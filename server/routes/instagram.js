const express = require("express");
const axios = require("axios");
const { IgAccount } = require("../db");
const { env, must } = require("../config/env");
const { authMiddleware } = require("../lib/auth");
const { extractErrorMessage, isDuplicateKeyError } = require("../lib/errors");
const { redactToken } = require("../lib/instagram");

const router = express.Router();

// Save IG business id manually (helps webhook mapping)
router.post("/api/instagram-business-id", authMiddleware, async (req, res) => {
  console.log(`POST /api/instagram-business-id called for user: ${req.appUserId}`);
  try {
    const { igBusinessId } = req.body || {};
    must(igBusinessId, "igBusinessId");

    const updated = await IgAccount.findOneAndUpdate(
      { appUserId: req.appUserId },
      { $set: { igBusinessId: String(igBusinessId) } },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) return res.status(400).json({ error: "Instagram not connected yet" });
    return res.json({ ok: true, igBusinessId: updated.igBusinessId });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ---------- Instagram OAuth exchange ----------
router.post("/api/instagram-token", authMiddleware, async (req, res) => {
  console.log(`POST /api/instagram-token called for user: ${req.appUserId}`);
  try {
    const { client_id, redirect_uri, code } = req.body || {};
    console.log("Requesting Instagram access token with code.");
    must(client_id, "client_id");
    must(redirect_uri, "redirect_uri");
    must(code, "code");
    must(env.instagramClientSecret, "INSTAGRAM_CLIENT_SECRET");

    const form = new URLSearchParams();
    form.append("client_id", String(client_id));
    form.append("client_secret", String(env.instagramClientSecret));
    form.append("grant_type", "authorization_code");
    form.append("redirect_uri", String(redirect_uri));
    form.append("code", String(code));

    const tokenResp = await axios.post(
      "https://api.instagram.com/oauth/access_token",
      form,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { access_token: shortLivedToken, user_id } = tokenResp.data || {};
    if (!shortLivedToken || !user_id) {
      console.error("Instagram token response missing fields.");
      return res.status(500).json({ error: "Instagram token response missing fields" });
    }
    console.log(`Received IG User ID: ${user_id}. Exchanging for long-lived token.`);
    console.log(`Received short-lived token: ${redactToken(shortLivedToken)}`);

    const longResp = await axios.get("https://graph.instagram.com/access_token", {
      params: {
        grant_type: "ig_exchange_token",
        client_secret: String(env.instagramClientSecret),
        access_token: String(shortLivedToken),
      },
    });

    const { access_token: accessToken, token_type: tokenType, expires_in: expiresInSec } = longResp.data || {};
    if (!accessToken) {
      console.error("Instagram long-lived token response missing access_token.");
      return res.status(500).json({ error: "Instagram long-lived token response missing access_token" });
    }
    console.log(`Received long-lived token: ${redactToken(accessToken)}. Saving to DB.`);

    // Save mapping appUserId <-> basicUserId + token
    const tokenExpiresAt =
      typeof expiresInSec === "number" && Number.isFinite(expiresInSec) && expiresInSec > 0
        ? new Date(Date.now() + expiresInSec * 1000)
        : null;

    await IgAccount.findOneAndUpdate(
      { appUserId: req.appUserId },
      {
        $set: {
          basicUserId: String(user_id),
          accessToken: String(accessToken),
          tokenType: tokenType ? String(tokenType) : null,
          tokenExpiresAt,
        },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    console.log(`Saved mapping for app user ${req.appUserId}`);

    return res.json({ ok: true, basicUserId: String(user_id) });
  } catch (e) {
    const msg = extractErrorMessage(e);
    console.error("Instagram token exchange error:", e?.response?.data || e.message);

    if (isDuplicateKeyError(e)) {
      return res.status(409).json({ error: msg || "Instagram account already linked" });
    }
    const status = e?.response?.status;
    if (typeof status === "number" && status >= 400 && status < 600) {
      return res.status(status).json({ error: msg || `HTTP ${status}` });
    }
    return res.status(500).json({ error: msg || "Instagram token exchange failed" });
  }
});

module.exports = router;
