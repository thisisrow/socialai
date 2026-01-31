const axios = require("axios");
const mongoose = require("mongoose");
const IgAccount = require("../models/IgAccount");
const MediaOwner = require("../models/MediaOwner");
const Context = require("../models/Context");
const PostState = require("../models/PostState");
const { must, redactToken, extractErrorMessage, isDuplicateKeyError } = require("../utils/helpers");

exports.saveBusinessId = async (req, res) => {
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
};

exports.exchangeToken = async (req, res) => {
    console.log(`POST /api/instagram-token called for user: ${req.appUserId}`);
    try {
        const { client_id, redirect_uri, code } = req.body || {};
        console.log("Requesting Instagram access token with code.");
        must(client_id, "client_id");
        must(redirect_uri, "redirect_uri");
        must(code, "code");
        must(process.env.INSTAGRAM_CLIENT_SECRET, "INSTAGRAM_CLIENT_SECRET");

        const form = new URLSearchParams();
        form.append("client_id", String(client_id));
        form.append("client_secret", String(process.env.INSTAGRAM_CLIENT_SECRET));
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
                client_secret: String(process.env.INSTAGRAM_CLIENT_SECRET),
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
};

exports.getPosts = async (req, res) => {
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
        for (const s of stDocs) stateMap[s.postId] = { autoReplyEnabled: !!s.autoReplyEnabled, sinceMs: s.sinceMs ?? null };
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
};
