const express = require("express");
const { Context } = require("../db");
const { authMiddleware } = require("../lib/auth");

const router = express.Router();

// ---------- CONTEXT ----------
router.get("/api/context", authMiddleware, async (req, res) => {
  console.log(`GET /api/context called for user: ${req.appUserId}`);
  const docs = await Context.find({ appUserId: req.appUserId }).lean();
  const contextMap = {};
  for (const d of docs) contextMap[d.postId] = d.text;
  console.log(`Returning ${Object.keys(contextMap).length} context items.`);
  return res.json({ ok: true, contextMap });
});

router.put("/api/context", authMiddleware, async (req, res) => {
  console.log(`PUT /api/context called for user: ${req.appUserId}`);
  const { postId, text } = req.body || {};
  if (!postId || !text) {
    console.log("Update context failed: postId or text missing.");
    return res.status(400).json({ error: "postId and text required" });
  }
  console.log(`Updating context for post: ${postId}`);

  const doc = await Context.findOneAndUpdate(
    { appUserId: req.appUserId, postId: String(postId) },
    { $set: { text: String(text) } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  console.log("Context updated successfully.");

  return res.json({ ok: true, context: { postId: doc.postId, text: doc.text } });
});

router.delete("/api/context", authMiddleware, async (req, res) => {
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

module.exports = router;
