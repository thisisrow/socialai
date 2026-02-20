const express = require("express");
const { PostState } = require("../db");
const { authMiddleware } = require("../lib/auth");

const router = express.Router();

// ---------- POST STATE ----------
router.get("/api/post-state", authMiddleware, async (req, res) => {
  console.log(`GET /api/post-state called for user: ${req.appUserId}`);
  const docs = await PostState.find({ appUserId: req.appUserId }).lean();
  const stateMap = {};
  for (const s of docs) {
    stateMap[s.postId] = { autoReplyEnabled: !!s.autoReplyEnabled, sinceMs: s.sinceMs ?? null };
  }
  console.log(`Returning ${Object.keys(stateMap).length} post state items.`);
  return res.json({ ok: true, stateMap });
});

router.put("/api/post-state", authMiddleware, async (req, res) => {
  console.log(`PUT /api/post-state called for user: ${req.appUserId}`);
  const { postId, enabled } = req.body || {};
  if (!postId || typeof enabled !== "boolean") {
    console.log("Update post state failed: postId or enabled missing/invalid.");
    return res.status(400).json({ error: "postId and enabled(boolean) required" });
  }
  console.log(`Updating post state for post ${postId} to ${enabled}.`);

  const doc = await PostState.findOneAndUpdate(
    { appUserId: req.appUserId, postId: String(postId) },
    { $set: { autoReplyEnabled: enabled, sinceMs: enabled ? Date.now() : null } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  console.log("Post state updated successfully.");

  return res.json({ ok: true, state: { autoReplyEnabled: !!doc.autoReplyEnabled, sinceMs: doc.sinceMs ?? null } });
});

module.exports = router;
