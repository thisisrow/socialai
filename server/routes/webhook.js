const express = require("express");
const { env } = require("../config/env");
const { IgAccount, MediaOwner, Context, Replied, PostState } = require("../db");
const { generateReply } = require("../services/ai");
const { redactToken, replyToComment, extractPostId } = require("../lib/instagram");

const router = express.Router();

// ---------- WEBHOOK VERIFY ----------
router.get("/api/instagram-webhook", (req, res) => {
  console.log("GET /api/instagram-webhook (verification) called.");
  if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === env.verifyToken) {
    console.log("Webhook verification successful.");
    return res.status(200).send(req.query["hub.challenge"]);
  }
  console.log("Webhook received, but not a verification request.");
  return res.status(200).send("Webhook active");
});

// ---------- WEBHOOK RECEIVE ----------
router.post("/api/instagram-webhook", async (req, res) => {
  res.sendStatus(200); // Respond immediately

  const body = req.body;
  if (body?.object !== "instagram") {
    return;
  }

  console.log("Processing Instagram webhook notification...");

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
          // Prefer the global media id -> app user mapping captured during /posts.
          const owner = await MediaOwner.findOne({ postId: String(postId) }).lean();
          if (owner?.appUserId) {
            console.log(`Resolved owner via MediaOwner postId=${postId}: ${String(owner.appUserId)}`);
            ig = await IgAccount.findOne({ appUserId: owner.appUserId }).lean();

            if (ig?.appUserId && !ig.igBusinessId) {
              console.log(`Binding igBusinessId=${igBusinessId} to appUserId=${String(ig.appUserId)} (via MediaOwner)`);
              try {
                await IgAccount.updateOne({ appUserId: ig.appUserId }, { $set: { igBusinessId } });
                ig = await IgAccount.findOne({ appUserId: owner.appUserId }).lean();
              } catch (e) {
                console.error("Failed to bind igBusinessId to IgAccount:", e?.message || e);
              }
            }

            if (!owner.igBusinessId) {
              try {
                await MediaOwner.updateOne({ postId: String(postId) }, { $set: { igBusinessId } });
              } catch (e) {
                console.error("Failed to bind igBusinessId to MediaOwner:", e?.message || e);
              }
            }
          }
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
              await IgAccount.updateOne({ appUserId: ig.appUserId }, { $set: { igBusinessId } });
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
            `Skipping: No IgAccount mapping for igBusinessId=${igBusinessId}. Call /posts once to create MediaOwner mappings, or set it via POST /api/instagram-business-id.`
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
        const contextText = ctx?.text || env.defaultContext;
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

module.exports = router;
