const express = require("express");
const axios = require("axios");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const {
  connectMongo,
  AppUser,
  IgAccount,
  Context,
  Replied,
  PostState,
} = require("./db");

const app = express();
app.use(express.json());

// CORS: allow your Vercel domain
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "https://socialai-theta.vercel.app",
    ],
    credentials: false,
  })
);

const port = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const JWT_SECRET = process.env.JWT_SECRET;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

console.log("Global constants initialized");
app.get("/", (req, res) => {
  res.send("Rumo Server is running.");
})
function must(v, name) {
  // console.log(`Checking requirement for: ${name}`);
  if (!v) {
    console.error(`Requirement failed: Missing ${name}`);
    throw new Error(`Missing ${name}`);
  }
  // console.log(`Requirement met for: ${name}`);
  return v;
}

function redactToken(token) {
  if (!token) return "";
  const s = String(token);
  if (s.length <= 12) return "****";
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function signToken(user) {
  console.log(`Signing token for user: ${user._id}`);
  const token = jwt.sign(
    { sub: String(user._id), email: user.email },
    must(JWT_SECRET, "JWT_SECRET"),
    { expiresIn: "30d" }
  );
  console.log("Token signed successfully.");
  return token;
}

function authMiddleware(req, res, next) {
  console.log("Auth middleware triggered.");
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) {
    console.log("Auth failed: Missing Authorization Bearer token.");
    return res.status(401).json({ error: "Missing Authorization Bearer token" });
  }
  try {
    const payload = jwt.verify(token, must(JWT_SECRET, "JWT_SECRET"));
    req.appUserId = payload.sub;
    console.log(`Auth success. User ID: ${req.appUserId}`);
    next();
  } catch(e) {
    console.error("Auth failed: Invalid token.", e.message);
    return res.status(401).json({ error: "Invalid token" });
  }
}

// ---------- AUTH ----------
app.post("/api/auth/signup", async (req, res) => {
  console.log("POST /api/auth/signup called.");
  try {
    const { email, password } = req.body || {};
     console.log(`Signup attempt for email: ${email}`);
    if (!email || !password) {
      console.log("Signup failed: email or password missing.");
      return res.status(400).json({ error: "email and password required" });
    }
    if (String(password).length < 6) {
      console.log("Signup failed: password too short.");
      return res.status(400).json({ error: "password must be 6+ characters" });
    }

    const existing = await AppUser.findOne({ email: String(email).toLowerCase() }).lean();
    if (existing) {
      console.log("Signup failed: email already registered.");
      return res.status(409).json({ error: "email already registered" });
    }

    console.log("Hashing password...");
    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await AppUser.create({ email: String(email).toLowerCase(), passwordHash });
    console.log(`User created with ID: ${user._id}`);

    const token = signToken(user);
    return res.json({ ok: true, token, user: { id: String(user._id), email: user.email } });
  } catch (e) {
    console.error("Signup error:", e.message);
    return res.status(500).json({ error: e.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  console.log("POST /api/auth/login called.");
  try {
    const { email, password } = req.body || {};
    console.log(`Login attempt for email: ${email}`);
    if (!email || !password) {
      console.log("Login failed: email or password missing.");
      return res.status(400).json({ error: "email and password required" });
    }

    const user = await AppUser.findOne({ email: String(email).toLowerCase() });
    if (!user) {
      console.log("Login failed: invalid credentials (user not found).");
      return res.status(401).json({ error: "invalid credentials" });
    }

    console.log("Comparing password...");
    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) {
      console.log("Login failed: invalid credentials (password mismatch).");
      return res.status(401).json({ error: "invalid credentials" });
    }

    console.log("Login successful.");
    const token = signToken(user);
    return res.json({ ok: true, token, user: { id: String(user._id), email: user.email } });
  } catch (e) {
    console.error("Login error:", e.message);
    return res.status(500).json({ error: e.message });
  }
});

app.get("/api/me", authMiddleware, async (req, res) => {
  console.log(`GET /api/me called for user: ${req.appUserId}`);
  const user = await AppUser.findById(req.appUserId).lean();
  if (!user) {
    console.log("GET /api/me: user not found.");
    return res.status(404).json({ error: "user not found" });
  }
  const ig = await IgAccount.findOne({ appUserId: user._id }).lean();
  console.log(`GET /api/me: Found user. Instagram connected: ${!!ig}`);
  return res.json({
    ok: true,
    user: { id: String(user._id), email: user.email },
    instagramConnected: !!ig,
    basicUserId: ig?.basicUserId || null,
    igBusinessId: ig?.igBusinessId || null,
  });
});

// Save IG business id manually (helps webhook mapping)
app.post("/api/instagram-business-id", authMiddleware, async (req, res) => {
  console.log(`POST /api/instagram-business-id called for user: ${req.appUserId}`);
  try {
    const { igBusinessId } = req.body || {};
    must(igBusinessId, "igBusinessId");

    const updated = await IgAccount.findOneAndUpdate(
      { appUserId: req.appUserId },
      { igBusinessId: String(igBusinessId) },
      { new: true }
    ).lean();

    if (!updated) return res.status(400).json({ error: "Instagram not connected yet" });
    return res.json({ ok: true, igBusinessId: updated.igBusinessId });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ---------- Instagram OAuth exchange ----------
app.post("/api/instagram-token", authMiddleware, async (req, res) => {
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

    const { access_token, user_id } = tokenResp.data || {};
    if (!access_token || !user_id) {
       console.error("Instagram token response missing fields.");
       return res.status(500).json({ error: "Instagram token response missing fields" });
    }
     console.log(`Received IG User ID: ${user_id}. Saving to DB.`);
     console.log(`Received access token: ${redactToken(access_token)}`);

    // Delete any existing connections for this user (handles reconnections)
    await IgAccount.deleteMany({ appUserId: req.appUserId });
    console.log(`Deleted old IG connections for app user ${req.appUserId}`);

    // Delete any existing connections for this basicUserId (avoid conflicts)
    await IgAccount.deleteMany({ basicUserId: String(user_id) });
    console.log(`Deleted old IG connections for basicUserId ${user_id}`);

    // Create fresh mapping appUserId <-> basicUserId + token
    const newIgAccount = await IgAccount.create({
      appUserId: req.appUserId,
      basicUserId: String(user_id),
      accessToken: String(access_token)
    });
    console.log(`Created new IG account mapping for app user ${req.appUserId}`);

    return res.json({ ok: true, basicUserId: String(user_id) });
  } catch (e) {
    console.error("Instagram token exchange error:", e?.response?.data || e.message);
    return res.status(500).json({ error: e?.response?.data || e.message });
  }
});

// ---------- POSTS ----------
app.post("/posts", authMiddleware, async (req, res) => {
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
      } catch(e) {
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
    console.error("Fetch posts error:", e?.response?.data || e.message);
    return res.status(500).json({ error: e?.response?.data || e.message });
  }
});

// ---------- CONTEXT ----------
app.get("/api/context", authMiddleware, async (req, res) => {
  console.log(`GET /api/context called for user: ${req.appUserId}`);
  const docs = await Context.find({ appUserId: req.appUserId }).lean();
  const contextMap = {};
  for (const d of docs) contextMap[d.postId] = d.text;
  console.log(`Returning ${Object.keys(contextMap).length} context items.`);
  return res.json({ ok: true, contextMap });
});

app.put("/api/context", authMiddleware, async (req, res) => {
  console.log(`PUT /api/context called for user: ${req.appUserId}`);
  const { postId, text } = req.body || {};
  if (!postId || !text) {
    console.log("Update context failed: postId or text missing.");
    return res.status(400).json({ error: "postId and text required" });
  }
  console.log(`Updating context for post: ${postId}`);

  const doc = await Context.findOneAndUpdate(
    { appUserId: req.appUserId, postId: String(postId) },
    { text: String(text) },
    { upsert: true, new: true }
  );
  console.log("Context updated successfully.");

  return res.json({ ok: true, context: { postId: doc.postId, text: doc.text } });
});

app.delete("/api/context", authMiddleware, async (req, res) => {
  console.log(`DELETE /api/context called for user: ${req.appUserId}`);
  const { postId } = req.body || {};
  if (!postId) {
    console.log("Delete context failed: postId missing.");
    return res.status(400).json({ error: "postId required" });
  }
  console.log(`Deleting context for post: ${postId}`);

  await Context.deleteOne({ appUserId: req.appUserId, postId: String(postId) });
  console.log("Context deleted successfully.");
  return res.json({ ok: true });
});

// ---------- POST STATE ----------
app.get("/api/post-state", authMiddleware, async (req, res) => {
  console.log(`GET /api/post-state called for user: ${req.appUserId}`);
  const docs = await PostState.find({ appUserId: req.appUserId }).lean();
  const stateMap = {};
  for (const s of docs) stateMap[s.postId] = { autoReplyEnabled: !!s.autoReplyEnabled, sinceMs: s.sinceMs ?? null };
  console.log(`Returning ${Object.keys(stateMap).length} post state items.`);
  return res.json({ ok: true, stateMap });
});

app.put("/api/post-state", authMiddleware, async (req, res) => {
  console.log(`PUT /api/post-state called for user: ${req.appUserId}`);
  const { postId, enabled } = req.body || {};
  if (!postId || typeof enabled !== "boolean") {
    console.log("Update post state failed: postId or enabled missing/invalid.");
    return res.status(400).json({ error: "postId and enabled(boolean) required" });
  }
  console.log(`Updating post state for post ${postId} to ${enabled}.`);

  const doc = await PostState.findOneAndUpdate(
    { appUserId: req.appUserId, postId: String(postId) },
    { autoReplyEnabled: enabled, sinceMs: enabled ? Date.now() : null },
    { upsert: true, new: true }
  );
  console.log("Post state updated successfully.");

  return res.json({ ok: true, state: { autoReplyEnabled: !!doc.autoReplyEnabled, sinceMs: doc.sinceMs ?? null } });
});

// ---------- AI Reply helpers ----------
async function generateReply(comment, context) {
  console.log("Generating AI reply...");
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
    console.log(`Generated reply: "${replyText}"`);
    return replyText;
  } catch(e) {
    console.error("AI reply generation failed:", e.message);
    return "Thank you for reaching out! 😊";
  }
}

async function replyToComment({ commentId, message, accessToken }) {
  console.log(`Replying to comment: ${commentId}`);
  console.log(`Using access token: ${redactToken(accessToken)}`);
  const fbGraphVersion = process.env.FB_GRAPH_VERSION || "v19.0";
  const urls = [
    `https://graph.facebook.com/${fbGraphVersion}/${commentId}/replies`,
    `https://graph.instagram.com/${commentId}/replies`,
  ];
  try {
    let lastErr = null;
    for (const url of urls) {
      try {
        console.log(`POST ${url} message="${String(message || "").slice(0, 200)}"`);
        await axios.post(url, null, { params: { message, access_token: accessToken } });
        console.log("Successfully posted reply to Instagram.");
        return;
      } catch (e) {
        lastErr = e;
        console.error("Reply attempt failed:", url, e?.response?.data || e.message);
      }
    }
    throw lastErr || new Error("All reply attempts failed");
  } catch (e) {
    console.error("Failed to post reply to Instagram:", e?.response?.data || e.message);
    throw e; // re-throw to be caught by webhook handler
  }
}

function extractPostId(commentData) {
  const postId =
    commentData?.media?.id ||
    commentData?.media_id ||
    commentData?.post_id ||
    commentData?.mediaId ||
    commentData?.object_id ||
    null;
  // console.log(`Extracted Post ID: ${postId}`);
  return postId;
}

// ---------- WEBHOOK VERIFY ----------
app.get("/api/instagram-webhook", (req, res) => {
  console.log("GET /api/instagram-webhook (verification) called.");
  if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === VERIFY_TOKEN) {
    console.log("Webhook verification successful.");
    return res.status(200).send(req.query["hub.challenge"]);
  }
  console.log("Webhook received, but not a verification request.");
  return res.status(200).send("Webhook active");
});

// ---------- WEBHOOK RECEIVE ----------
app.post("/api/instagram-webhook", async (req, res) => {
  // console.log("POST /api/instagram-webhook called.");
  res.sendStatus(200); // Respond immediately

  const body = req.body;
  if (body?.object !== "instagram") {
    // console.log("Webhook received, but not from Instagram. Skipping.");
    return;
  }
  
  console.log("Processing Instagram webhook notification...");
  // console.dir(body, { depth: 5 });


  try {
    for (const entry of body.entry || []) {
      const igBusinessId = String(entry.id || "");
      if (!igBusinessId) {
        console.log("Skipping entry, no IG Business ID found.");
        continue;
      }
      console.log(`Processing entry for IG Business ID: ${igBusinessId}`);

      for (const change of entry.changes || []) {
        if (change.field !== "comments") continue;
        console.log("Processing 'comments' field change.");

        const commentData = change.value || {};
        const commentId = String(commentData.id || "");
        const parentId = commentData.parent_id ? String(commentData.parent_id) : "";
        const commenterId = String(commentData.from?.id || "");
        const postId = String(extractPostId(commentData) || "");

        console.log(
          `Comment Data: commentId=${commentId}, postId=${postId}, parentId=${parentId}, commenterId=${commenterId}`
        );

        if (!commentId || !postId) {
          console.log("Skipping: Missing commentId or postId.");
          continue;
        }
        if (parentId) {
          console.log("Skipping: Is a reply to another comment (has parentId).");
          continue;
        }
        if (commenterId && commenterId === igBusinessId) {
          console.log("Skipping: Comment is from the page owner (avoiding loop).");
          continue;
        }

        // Resolve which app user owns this webhook event.
        let ig = await IgAccount.findOne({ igBusinessId }).lean();
        if (!ig) {
          // Some setups only store the Basic Display user id; try that too.
          ig = await IgAccount.findOne({ basicUserId: igBusinessId }).lean();
        }

        if (!ig) {
          // Infer ownership by postId (auto-reply state/context saved via UI uses the app user id).
          const stateAny = await PostState.findOne({ postId: String(postId) }).lean();
          const ctxAny = stateAny ? null : await Context.findOne({ postId: String(postId) }).lean();
          const inferredAppUserId = stateAny?.appUserId || ctxAny?.appUserId || null;

          if (inferredAppUserId) {
            console.log(`Inferred app user via postId=${postId}: ${String(inferredAppUserId)}`);
            ig = await IgAccount.findOne({ appUserId: inferredAppUserId }).lean();
            if (ig?.appUserId && !ig.igBusinessId) {
              console.log(`Binding igBusinessId=${igBusinessId} to appUserId=${String(ig.appUserId)}`);
              await IgAccount.updateOne({ appUserId: ig.appUserId }, { igBusinessId });
              ig = await IgAccount.findOne({ appUserId: inferredAppUserId }).lean();
            } else if (ig?.igBusinessId && ig.igBusinessId !== igBusinessId) {
              console.log(
                `Not binding igBusinessId=${igBusinessId}; existing igBusinessId=${ig.igBusinessId} for appUserId=${String(
                  ig.appUserId
                )}`
              );
            }
          }
        }

        if (!ig) {
          console.log(
            `Skipping: No IgAccount mapping for igBusinessId=${igBusinessId}. Set it via POST /api/instagram-business-id.`
          );
          continue;
        }

        console.log("DB match:", {
          appUserId: String(ig.appUserId),
          igBusinessId: ig.igBusinessId,
          basicUserId: ig.basicUserId,
          accessToken: redactToken(ig.accessToken),
        });

        if (!ig?.accessToken || !ig?.appUserId) {
          console.log(`Skipping: IgAccount missing accessToken/appUserId for igBusinessId=${igBusinessId}.`);
          continue;
        }

        const already = await Replied.findOne({ appUserId: ig.appUserId, commentId }).lean();
        if (already) {
          console.log(`Skipping: Already replied to comment ${commentId}.`);
          continue;
        }

        const state = await PostState.findOne({ appUserId: ig.appUserId, postId }).lean();
        if (!state?.autoReplyEnabled) {
          console.log(`Skipping: Auto-reply is not enabled for post ${postId}.`);
          continue;
        }
        console.log(`Auto-reply is enabled for post ${postId}.`);

        const ctx = await Context.findOne({ appUserId: ig.appUserId, postId }).lean();
        const contextText = ctx?.text || "We serve delicious food at Rumo Restaurant.";
        console.log(`Using context of length ${contextText.length}`);

        const userText = String(commentData.text || "");
        console.log(`Incoming comment text: "${userText}"`);
        const reply = await generateReply(userText, contextText);
        console.log(`Reply text: "${reply}"`);

        await replyToComment({ commentId, message: reply, accessToken: ig.accessToken });
        await Replied.create({ appUserId: ig.appUserId, postId, commentId });
        console.log(`Successfully processed and replied to comment ${commentId}.`);
      }
    }
  } catch (e) {
	    console.error("Webhook error:", e?.response?.data || e.message);
	  }
});

// ---------- START ----------
console.log("Connecting to MongoDB...");
connectMongo()
  .then(() => {
    console.log("MongoDB connected. Starting server...");
    app.listen(port, () => console.log(`Server running on port ${port}`));
  })
  .catch((e) => {
    console.error("Mongo connection failed:", e.message);
    process.exit(1);
  });
