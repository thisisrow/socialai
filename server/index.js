const express = require("express");
const axios = require("axios");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const { connectMongo, AppUser, IgAccount, Context, Replied, PostState } = require("./db");

const app = express();
app.use(express.json());

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000", "https://socialai-theta.vercel.app"],
    credentials: false,
  })
);

const port = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const JWT_SECRET = process.env.JWT_SECRET;

const FB_GRAPH_VERSION = process.env.FB_GRAPH_VERSION || "v19.0";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.get("/", (req, res) => res.send("Rumo Server is running."));

function must(v, name) {
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function redactToken(token) {
  if (!token) return "";
  const s = String(token);
  if (s.length <= 12) return "****";
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function safeJson(obj, maxLen = 2500) {
  try {
    const s = JSON.stringify(obj);
    return s.length > maxLen ? s.slice(0, maxLen) + "..." : s;
  } catch {
    return "[unserializable]";
  }
}

function extractErrorMessage(e) {
  const data = e?.response?.data;
  if (typeof data === "string") return data;
  if (data?.error_message) return String(data.error_message);
  if (data?.error?.message) return String(data.error.message);
  if (data?.message) return String(data.message);
  if (e?.message) return String(e.message);
  try {
    return JSON.stringify(data);
  } catch {
    return "Unknown error";
  }
}

function signToken(user) {
  return jwt.sign({ sub: String(user._id), email: user.email }, must(JWT_SECRET, "JWT_SECRET"), { expiresIn: "30d" });
}

function authMiddleware(req, res, next) {
  console.log("[AUTH] middleware triggered");
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Missing Authorization Bearer token" });

  try {
    const payload = jwt.verify(token, must(JWT_SECRET, "JWT_SECRET"));
    req.appUserId = payload.sub;
    console.log("[AUTH] success appUserId:", req.appUserId);
    next();
  } catch (e) {
    console.error("[AUTH] invalid token:", e.message);
    return res.status(401).json({ error: "Invalid token" });
  }
}

// ---------- AUTH ----------
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "email and password required" });
    if (String(password).length < 6) return res.status(400).json({ error: "password must be 6+ characters" });

    const existing = await AppUser.findOne({ email: String(email).toLowerCase() }).lean();
    if (existing) return res.status(409).json({ error: "email already registered" });

    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await AppUser.create({ email: String(email).toLowerCase(), passwordHash });

    const token = signToken(user);
    return res.json({ ok: true, token, user: { id: String(user._id), email: user.email } });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "email and password required" });

    const user = await AppUser.findOne({ email: String(email).toLowerCase() });
    if (!user) return res.status(401).json({ error: "invalid credentials" });

    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) return res.status(401).json({ error: "invalid credentials" });

    const token = signToken(user);
    return res.json({ ok: true, token, user: { id: String(user._id), email: user.email } });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.get("/api/me", authMiddleware, async (req, res) => {
  const user = await AppUser.findById(req.appUserId).lean();
  if (!user) return res.status(404).json({ error: "user not found" });

  const ig = await IgAccount.findOne({ appUserId: user._id }).lean();
  return res.json({
    ok: true,
    user: { id: String(user._id), email: user.email },
    instagramConnected: !!ig,
    basicUserId: ig?.basicUserId || null,
    igBusinessId: ig?.igBusinessId || null,
  });
});

// ---------- IMPORTANT NOTE ----------
// Your current /api/instagram-token uses Basic Display (graph.instagram.com).
// That token CANNOT reply to comments.
// Keep it if you only need to read media for personal accounts,
// but for replying you MUST store a Facebook/IG Graph token for a Business/Creator account.

// ---------- Save IG business id manually ----------
app.post("/api/instagram-business-id", authMiddleware, async (req, res) => {
  console.log("[IG-BIZ] called by appUserId:", req.appUserId);
  try {
    const { igBusinessId } = req.body || {};
    must(igBusinessId, "igBusinessId");

    const updated = await IgAccount.findOneAndUpdate(
      { appUserId: req.appUserId },
      { $set: { igBusinessId: String(igBusinessId) } },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) return res.status(400).json({ error: "Instagram not connected yet" });

    console.log("[IG-BIZ] saved igBusinessId:", updated.igBusinessId);
    return res.json({ ok: true, igBusinessId: updated.igBusinessId });
  } catch (e) {
    console.error("[IG-BIZ] error:", e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ---------- POSTS (still uses your stored token) ----------
app.post("/posts", authMiddleware, async (req, res) => {
  console.log("[POSTS] called by appUserId:", req.appUserId);
  try {
    const ig = await IgAccount.findOne({ appUserId: req.appUserId }).lean();
    if (!ig) return res.status(400).json({ error: "Instagram not connected" });
    if (!ig.accessToken || !ig.basicUserId) return res.status(400).json({ error: "Instagram token missing. Reconnect." });

    const access_token = ig.accessToken;
    const user_id = ig.basicUserId;

    console.log("[POSTS] fetching media for basicUserId:", user_id);

    const mediaResp = await axios.get(`https://graph.instagram.com/${user_id}/media`, {
      params: { access_token, fields: "id,caption,media_type,media_url,permalink,timestamp", limit: 12 },
      timeout: 20000,
    });

    const mediaList = mediaResp.data?.data || [];
    console.log("[POSTS] media count:", mediaList.length);

    const posts = [];
    for (const m of mediaList) {
      let comments = [];
      try {
        const cResp = await axios.get(`https://graph.instagram.com/${m.id}/comments`, {
          params: { access_token, fields: "id,text,username,timestamp", limit: 10 },
          timeout: 20000,
        });
        comments = cResp.data?.data || [];
      } catch (e) {
        console.error("[POSTS] comments fetch failed for media:", m.id, e?.response?.data || e.message);
        comments = [];
      }
      posts.push({ ...m, comments });
    }

    const [ctxDocs, stDocs] = await Promise.all([
      Context.find({ appUserId: req.appUserId }).lean(),
      PostState.find({ appUserId: req.appUserId }).lean(),
    ]);

    const contextMap = {};
    for (const d of ctxDocs) contextMap[d.postId] = d.text;

    const stateMap = {};
    for (const s of stDocs) stateMap[s.postId] = { autoReplyEnabled: !!s.autoReplyEnabled, sinceMs: s.sinceMs ?? null };

    return res.json({ ok: true, posts, contextMap, stateMap });
  } catch (e) {
    const msg = extractErrorMessage(e);
    console.error("[POSTS] error:", e?.response?.status, e?.response?.data || e.message);
    return res.status(500).json({ error: msg || "Failed to fetch posts" });
  }
});

// ---------- AI Reply ----------
async function generateReply(comment, context) {
  console.log("[AI] generating reply...");
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt = `
You are a friendly customer support agent for Rumo Restaurant.
Rules:
- Answer ONLY using the provided context.
- If the answer isn't in the context, be polite but do not invent details, use few words from context if possible.
- Return EXACTLY ONE sentence.
- User Comment: "${comment}"
- Context: "${context}"
`;
    const result = await model.generateContent(prompt);
    const replyText = result.response.text().trim();
    console.log("[AI] reply:", replyText);
    return replyText;
  } catch (e) {
    console.error("[AI] failed:", e.message);
    return "Thank you for reaching out! 😊";
  }
}

// ---------- Reply to comment (Facebook Graph ONLY) ----------
async function replyToComment({ commentId, message, accessToken }) {
  const url = `https://graph.facebook.com/${FB_GRAPH_VERSION}/${commentId}/replies`;

  console.log("[REPLY] sending reply");
  console.log("[REPLY] commentId:", commentId);
  console.log("[REPLY] message:", String(message || "").slice(0, 300));
  console.log("[REPLY] token:", redactToken(accessToken));
  console.log("[REPLY] POST:", url);

  try {
    const resp = await axios.post(
      url,
      null,
      {
        params: {
          message: String(message || ""),
          access_token: String(accessToken),
        },
        timeout: 20000,
      }
    );

    console.log("[REPLY] success:", safeJson(resp?.data));
    return resp?.data;
  } catch (e) {
    console.error("[REPLY] failed:", e?.response?.status, e?.response?.data || e.message);
    throw e;
  }
}

function extractPostId(commentData) {
  return (
    commentData?.media?.id ||
    commentData?.media_id ||
    commentData?.post_id ||
    commentData?.mediaId ||
    commentData?.object_id ||
    null
  );
}

// ---------- WEBHOOK VERIFY ----------
app.get("/api/instagram-webhook", (req, res) => {
  console.log("[WEBHOOK-VERIFY] query:", safeJson(req.query));
  if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === VERIFY_TOKEN) {
    console.log("[WEBHOOK-VERIFY] ok");
    return res.status(200).send(req.query["hub.challenge"]);
  }
  console.log("[WEBHOOK-VERIFY] not verification");
  return res.status(200).send("Webhook active");
});

// ---------- WEBHOOK RECEIVE (logs: incoming comment + reply path) ----------
app.post("/api/instagram-webhook", async (req, res) => {
  res.sendStatus(200);

  const body = req.body;
  console.log("[WEBHOOK] raw:", safeJson(body, 2500));

  if (body?.object !== "instagram") {
    console.log("[WEBHOOK] skip: not instagram object");
    return;
  }

  try {
    for (const entry of body.entry || []) {
      const igBusinessId = String(entry.id || "");
      console.log("[WEBHOOK] entry igBusinessId:", igBusinessId);

      for (const change of entry.changes || []) {
        console.log("[WEBHOOK] change.field:", change.field);
        if (change.field !== "comments") continue;

        const commentData = change.value || {};
        const commentId = String(commentData.id || "");
        const parentId = commentData.parent_id ? String(commentData.parent_id) : "";
        const commenterId = String(commentData.from?.id || "");
        const commenterUsername = String(commentData.from?.username || "");
        const postId = String(extractPostId(commentData) || "");
        const incomingText = String(commentData.text || "");

        console.log("[WEBHOOK] incoming comment:");
        console.log("[WEBHOOK] commentId:", commentId);
        console.log("[WEBHOOK] postId:", postId);
        console.log("[WEBHOOK] parentId:", parentId);
        console.log("[WEBHOOK] commenterId:", commenterId);
        console.log("[WEBHOOK] username:", commenterUsername);
        console.log("[WEBHOOK] text:", incomingText);

        if (!commentId || !postId) {
          console.log("[WEBHOOK] skip: missing commentId/postId");
          continue;
        }
        if (parentId) {
          console.log("[WEBHOOK] skip: reply thread (parent_id exists)");
          continue;
        }
        if (commenterId && commenterId === igBusinessId) {
          console.log("[WEBHOOK] skip: comment from page owner");
          continue;
        }

        // Find account mapping by igBusinessId
        let ig = await IgAccount.findOne({ igBusinessId }).lean();
        if (!ig) {
          console.log("[WEBHOOK] skip: no IgAccount mapping for igBusinessId:", igBusinessId);
          continue;
        }

        console.log("[WEBHOOK] db match:");
        console.log("[WEBHOOK] appUserId:", String(ig.appUserId));
        console.log("[WEBHOOK] igBusinessId:", ig.igBusinessId);
        console.log("[WEBHOOK] accessToken:", redactToken(ig.accessToken));

        if (!ig?.accessToken) {
          console.log("[WEBHOOK] skip: missing accessToken (must be IG Graph/Page token)");
          continue;
        }

        const already = await Replied.findOne({ appUserId: ig.appUserId, commentId }).lean();
        if (already) {
          console.log("[WEBHOOK] skip: already replied:", commentId);
          continue;
        }

        const state = await PostState.findOne({ appUserId: ig.appUserId, postId }).lean();
        console.log("[WEBHOOK] autoReplyEnabled:", !!state?.autoReplyEnabled);
        if (!state?.autoReplyEnabled) {
          console.log("[WEBHOOK] skip: auto-reply disabled for postId:", postId);
          continue;
        }

        const ctx = await Context.findOne({ appUserId: ig.appUserId, postId }).lean();
        const contextText = ctx?.text || "We serve delicious food at Rumo Restaurant.";
        console.log("[WEBHOOK] context length:", contextText.length);

        console.log("[WEBHOOK] generating reply...");
        const reply = await generateReply(incomingText, contextText);
        console.log("[WEBHOOK] reply text:", reply);

        console.log("[WEBHOOK] sending reply...");
        const apiResult = await replyToComment({ commentId, message: reply, accessToken: ig.accessToken });
        console.log("[WEBHOOK] reply api result:", safeJson(apiResult));

        await Replied.create({ appUserId: ig.appUserId, postId, commentId });
        console.log("[WEBHOOK] saved replied record:", commentId);
      }
    }
  } catch (e) {
    console.error("[WEBHOOK] error:", e?.response?.status, e?.response?.data || e.message);
  }
});

// ---------- START ----------
connectMongo()
  .then(() => {
    console.log("Server running on port", port);
    app.listen(port);
  })
  .catch((e) => {
    console.error("Mongo connection failed:", e.message);
    process.exit(1);
  });
