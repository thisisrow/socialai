const crypto = require("crypto");
const express = require("express");
const { env } = require("../config/env");
const { IgAccount, Post, Comment, logActivity } = require("../models");
const { generateReply } = require("../services/ai");
const ig = require("../lib/instagram");
const { extractErrorMessage, isDuplicateKeyError } = require("../lib/errors");

const router = express.Router();

/** Tolerance for the automation cutoff comparison. See handleCommentChange. */
const CUTOFF_GRACE_MS = 5000;

/**
 * Render-friendly structured logs for tracing a webhook from receipt to reply.
 * Deliberately excludes comment text, usernames, tokens and signatures.
 */
function webhookLog(level, event, details = {}) {
  const write = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  write(
    `[instagram-webhook] ${JSON.stringify({
      timestamp: new Date().toISOString(),
      event,
      ...details,
    })}`,
  );
}

function finishChange(trace, outcome, details = {}) {
  webhookLog(outcome === "replied" ? "info" : "warn", "change_finished", {
    ...trace,
    outcome,
    ...details,
  });
  return outcome;
}

// ------------------------------------------------------ verification ---
router.get("/instagram", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && env.verifyToken && token === env.verifyToken) {
    webhookLog("info", "verification_succeeded");
    return res.status(200).send(String(challenge));
  }
  webhookLog("warn", "verification_rejected", {
    mode: mode || null,
    hasConfiguredToken: Boolean(env.verifyToken),
    hasPresentedToken: Boolean(token),
  });
  return res.sendStatus(403);
});

/**
 * Resolves the tenant an inbound event belongs to.
 *
 * `entry[].id` is the Instagram professional account id, which connect-time
 * profile lookup already stored on the account, so the primary path is a single
 * indexed query with no inference. The mediaId fallback only exists for accounts
 * connected before that field was captured, and it repairs the row when it hits.
 */
async function resolveAccount(entryId, mediaId) {
  let account = await IgAccount.findOne({
    $or: [{ igBusinessId: entryId }, { igUserId: entryId }],
  });
  if (account) return account;

  if (!mediaId) return null;

  // Posts are synced per user, so mediaId already identifies the owner.
  const post = await Post.findOne({ mediaId }).lean();
  if (!post) return null;

  account = await IgAccount.findOne({ userId: post.userId });
  if (!account) return null;

  if (!account.igBusinessId) {
    account.igBusinessId = entryId;
    await account.save().catch((e) => {
      // A conflict here means another tenant already claims this Instagram id.
      if (!isDuplicateKeyError(e)) throw e;
      console.error(`[webhook] igBusinessId ${entryId} already claimed by another account`);
    });
  }
  return account;
}

/** Handles one `comments` change. Returns a short reason string for the log. */
async function handleCommentChange(entryId, value, { requestId } = {}) {
  const commentId = value?.id ? String(value.id) : "";
  const mediaId = ig.extractMediaId(value);
  const parentId = value?.parent_id ? String(value.parent_id) : "";
  const fromId = value?.from?.id ? String(value.from.id) : "";
  const username = value?.from?.username || "";
  const text = String(value?.text || "");
  const trace = { requestId, entryId, mediaId, commentId };

  webhookLog("info", "comment_change_received", {
    ...trace,
    hasParent: Boolean(parentId),
    hasSender: Boolean(fromId),
    commentLength: text.length,
  });

  if (!commentId || !mediaId) return finishChange(trace, "missing_comment_or_media_id");
  // A reply to a reply would otherwise start a loop with our own answer.
  if (parentId) return finishChange(trace, "threaded_reply_ignored");

  const account = await resolveAccount(entryId, mediaId);
  if (!account) return finishChange(trace, "account_not_found");

  const userId = account.userId;

  if (fromId && (fromId === account.igBusinessId || fromId === account.igUserId)) {
    return finishChange(trace, "account_owner_comment_ignored");
  }

  const post = await Post.findOne({ userId, mediaId });
  const commentedAt = value?.timestamp ? new Date(Number(value.timestamp) * 1000) : new Date();

  // Persist first, and let the unique (userId, commentId) index decide whether
  // this is new. Instagram redelivers events; this is what stops double replies.
  let comment;
  try {
    comment = await Comment.create({
      userId,
      commentId,
      mediaId,
      parentCommentId: null,
      fromId,
      username,
      text,
      commentedAt,
      status: "pending",
      source: "webhook",
    });
  } catch (e) {
    if (isDuplicateKeyError(e)) return finishChange(trace, "duplicate_ignored");
    throw e;
  }

  if (!post) {
    comment.status = "skipped";
    comment.error = "Post not synced yet";
    await comment.save();
    return finishChange(trace, "post_not_synced");
  }

  if (!post.autoReplyEnabled) {
    comment.status = "skipped";
    await comment.save();
    return finishChange(trace, "automation_disabled", {
      hasContext: Boolean(post.context),
    });
  }

  // Backlog guard: only answer comments made after automation was switched on.
  // Instagram timestamps have one-second resolution while autoReplySince is
  // millisecond-precise, so a comment posted in the same second as the toggle
  // can read as up to a second "older". The grace window stops that being
  // misfiled as backlog.
  if (post.autoReplySince && commentedAt.getTime() < post.autoReplySince.getTime() - CUTOFF_GRACE_MS) {
    comment.status = "skipped";
    comment.error = "Predates automation being enabled";
    await comment.save();
    return finishChange(trace, "predates_automation", {
      commentedAt: commentedAt.toISOString(),
      autoReplySince: post.autoReplySince.toISOString(),
    });
  }

  const aiStartedAt = Date.now();
  const result = await generateReply({
    userId,
    comment: text,
    context: post.context || "",
    username,
    caption: post.caption || "",
  });
  webhookLog(result.ok ? "info" : "warn", "ai_generation_finished", {
    ...trace,
    ok: result.ok,
    code: result.code || null,
    model: result.model || env.claudeModel,
    replyLength: String(result.text || "").length,
    durationMs: Date.now() - aiStartedAt,
  });

  try {
    const sendStartedAt = Date.now();
    const token = await ig.ensureFreshToken(account);
    const replyId = await ig.replyToComment({
      commentId,
      message: result.text,
      accessToken: token,
    });

    comment.status = "replied";
    comment.replyText = result.text;
    comment.replyId = replyId;
    comment.replyMode = "ai";
    comment.repliedAt = new Date();
    // A fallback still gets sent, but the reason it was a fallback is recorded.
    comment.error = result.ok ? "" : String(result.error || "").slice(0, 300);
    await comment.save();

    post.repliesSent = (post.repliesSent || 0) + 1;
    await post.save();

    logActivity(userId, "reply.sent", `Auto-replied to @${username}`, {
      mediaId,
      fallback: !result.ok,
    });
    return finishChange(trace, "replied", {
      fallback: !result.ok,
      replyId: replyId || null,
      durationMs: Date.now() - sendStartedAt,
    });
  } catch (e) {
    const message = extractErrorMessage(e);
    if (ig.isTokenError(e)) await ig.markAccountInvalid(account, e);

    comment.status = "failed";
    comment.error = message.slice(0, 300);
    await comment.save();

    logActivity(userId, "reply.failed", `Auto-reply to @${username} failed: ${message}`, { mediaId });
    return finishChange(trace, "reply_failed", {
      error: message.slice(0, 300),
      tokenError: ig.isTokenError(e),
    });
  }
}

// ------------------------------------------------------------ receive ---
router.post("/instagram", async (req, res) => {
  const requestId = crypto.randomUUID();
  const receivedAt = Date.now();
  webhookLog("info", "request_received", {
    requestId,
    contentLength: req.rawBody?.length || 0,
    hasSignature: Boolean(req.headers["x-hub-signature-256"]),
  });

  // Meta retries anything that is not a fast 200, so acknowledge before working.
  if (!ig.verifyWebhookSignature(req.rawBody, req.headers["x-hub-signature-256"])) {
    webhookLog("warn", "signature_rejected", { requestId });
    return res.sendStatus(403);
  }
  res.sendStatus(200);

  const body = req.body;
  webhookLog("info", "request_accepted", {
    requestId,
    object: body?.object || null,
    entryCount: Array.isArray(body?.entry) ? body.entry.length : 0,
    acknowledgedInMs: Date.now() - receivedAt,
  });
  if (body?.object !== "instagram") {
    webhookLog("warn", "non_instagram_object_ignored", { requestId });
    return;
  }

  try {
    for (const entry of body.entry || []) {
      const entryId = entry?.id ? String(entry.id) : "";
      if (!entryId) {
        webhookLog("warn", "entry_without_id_ignored", { requestId });
        continue;
      }

      for (const change of entry.changes || []) {
        if (change?.field !== "comments") {
          webhookLog("info", "field_ignored", {
            requestId,
            entryId,
            field: change?.field || null,
          });
          continue;
        }
        try {
          await handleCommentChange(entryId, change.value || {}, { requestId });
        } catch (e) {
          webhookLog("error", "change_handler_failed", {
            requestId,
            entryId,
            commentId: change.value?.id ? String(change.value.id) : null,
            error: extractErrorMessage(e).slice(0, 300),
          });
        }
      }
    }
  } catch (e) {
    webhookLog("error", "request_processing_failed", {
      requestId,
      error: extractErrorMessage(e).slice(0, 300),
    });
  }
});

module.exports = router;
