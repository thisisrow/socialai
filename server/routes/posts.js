const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
const { IgAccount, MediaOwner, Context, PostState } = require("../db");
const { authMiddleware } = require("../lib/auth");
const { extractErrorMessage } = require("../lib/errors");

const router = express.Router();

// ---------- POSTS ----------
router.post("/posts", authMiddleware, async (req, res) => {
  console.log(`POST /posts called for user: ${req.appUserId}`);
  try {
    const ig = await IgAccount.findOne({ appUserId: req.appUserId }).lean();
    if (!ig) {
      console.log("Fetch posts failed: Instagram not connected.");
      return res.status(400).json({ error: "Instagram not connected" });
    }

    const access_token = ig.accessToken;
    const user_id = ig.basicUserId;
    console.log(`Fetching posts for IG User ID: ${user_id}`);

    const mediaResp = await axios.get(`https://graph.instagram.com/${user_id}/media`, {
      params: {
        access_token,
        fields: "id,caption,media_type,media_url,permalink,timestamp",
        limit: 12,
      },
    });

    const mediaList = mediaResp.data?.data || [];
    console.log(`Found ${mediaList.length} media items.`);

    // Persist a global mapping from IG media id -> app user, so webhook can route events correctly.
    try {
      if (mediaList.length) {
        const appUserObjectId = new mongoose.Types.ObjectId(String(req.appUserId));
        await MediaOwner.bulkWrite(
          mediaList.map((m) => ({
            updateOne: {
              filter: { postId: String(m.id) },
              update: {
                $set: {
                  postId: String(m.id),
                  appUserId: appUserObjectId,
                  basicUserId: user_id ? String(user_id) : null,
                },
              },
              upsert: true,
            },
          })),
          { ordered: false }
        );
      }
    } catch (e) {
      console.error("Failed to persist MediaOwner mapping:", e?.message || e);
    }

    const posts = [];
    for (const m of mediaList) {
      let comments = [];
      try {
        console.log(`Fetching comments for media: ${m.id}`);
        const cResp = await axios.get(`https://graph.instagram.com/${m.id}/comments`, {
          params: { access_token, fields: "id,text,username,timestamp", limit: 10 },
        });
        comments = cResp.data?.data || [];
        console.log(`Found ${comments.length} comments.`);
      } catch (e) {
        console.error(`Failed to fetch comments for media ${m.id}:`, e.message);
        comments = [];
      }
      posts.push({ ...m, comments });
    }

    console.log("Fetching context and post states from DB.");
    const [ctxDocs, stDocs] = await Promise.all([
      Context.find({ appUserId: req.appUserId }).lean(),
      PostState.find({ appUserId: req.appUserId }).lean(),
    ]);

    const contextMap = {};
    for (const d of ctxDocs) contextMap[d.postId] = d.text;
    console.log(`Loaded ${Object.keys(contextMap).length} context items.`);

    const stateMap = {};
    for (const s of stDocs) {
      stateMap[s.postId] = { autoReplyEnabled: !!s.autoReplyEnabled, sinceMs: s.sinceMs ?? null };
    }
    console.log(`Loaded ${Object.keys(stateMap).length} state items.`);

    return res.json({ ok: true, posts, contextMap, stateMap });
  } catch (e) {
    const msg = extractErrorMessage(e);
    const data = e?.response?.data;
    console.error("Fetch posts error:", data || e.message);

    // IG token expired (OAuthException code 190)
    const igCode = data?.code ?? data?.error?.code;
    if (igCode === 190) {
      return res.status(401).json({ error: msg || "Instagram access token expired. Reconnect Instagram." });
    }
    const status = e?.response?.status;
    if (typeof status === "number" && status >= 400 && status < 600) {
      return res.status(status).json({ error: msg || `HTTP ${status}` });
    }
    return res.status(500).json({ error: msg || "Failed to fetch posts" });
  }
});

module.exports = router;
