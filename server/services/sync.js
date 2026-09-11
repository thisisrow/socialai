const { Post, Comment, AiSettings, IgAccount, logActivity } = require("../models");
const ig = require("../lib/instagram");
const { ApiError, extractErrorMessage } = require("../lib/errors");

/**
 * Pulls media + comments from Instagram into our own collections.
 *
 * Owning the data locally is what lets the CRM render instantly and, more
 * importantly, gives the webhook a `mediaId -> userId` lookup that never has to
 * call Meta to work out who an incoming comment belongs to.
 */
async function syncAccount(userId, { mediaLimit = 25, commentLimit = 50 } = {}) {
  const account = await IgAccount.findOne({ userId });
  if (!account) throw ApiError.badRequest("Connect an Instagram account first", "ig_not_connected");

  const settings = await AiSettings.findOne({ userId }).lean();
  const autoReplyByDefault = Boolean(settings?.autoReplyByDefault);

  let token;
  let media;
  try {
    token = await ig.ensureFreshToken(account);
    media = await ig.fetchMedia(token, { limit: mediaLimit });
  } catch (e) {
    if (ig.isTokenError(e)) {
      await ig.markAccountInvalid(account, e);
      throw new ApiError(401, "Instagram access expired. Reconnect the account.", "ig_token_expired");
    }
    throw new ApiError(e?.response?.status || 502, extractErrorMessage(e), "ig_fetch_failed");
  }

  const postOps = media.map((m) => ({
    updateOne: {
      filter: { userId, mediaId: String(m.id) },
      update: {
        $set: {
          igBusinessId: account.igBusinessId,
          caption: m.caption || "",
          mediaType: m.media_type || "",
          mediaUrl: m.media_url || "",
          thumbnailUrl: m.thumbnail_url || "",
          permalink: m.permalink || "",
          postedAt: m.timestamp ? new Date(m.timestamp) : null,
          likeCount: Number(m.like_count) || 0,
          commentsCount: Number(m.comments_count) || 0,
          lastSyncedAt: new Date(),
        },
        // Only applied on insert, so a re-sync never clobbers the context or
        // the automation toggle the user set in the UI.
        $setOnInsert: {
          userId,
          mediaId: String(m.id),
          autoReplyEnabled: autoReplyByDefault,
          autoReplySince: autoReplyByDefault ? new Date() : null,
          context: "",
          repliesSent: 0,
        },
      },
      upsert: true,
    },
  }));

  if (postOps.length) await Post.bulkWrite(postOps, { ordered: false });

  let commentsSeen = 0;
  let commentsNew = 0;

  for (const m of media) {
    if (!Number(m.comments_count)) continue;
    let comments = [];
    try {
      comments = await ig.fetchComments(token, m.id, { limit: commentLimit });
    } catch (e) {
      console.error(`[sync] comments for ${m.id} failed:`, extractErrorMessage(e));
      continue;
    }

    commentsSeen += comments.length;
    if (!comments.length) continue;

    const ops = comments
      .filter((c) => String(c.from?.id || "") !== String(account.igBusinessId))
      .map((c) => ({
        updateOne: {
          filter: { userId, commentId: String(c.id) },
          update: {
            $set: {
              mediaId: String(m.id),
              username: c.username || "",
              text: c.text || "",
              fromId: c.from?.id ? String(c.from.id) : "",
              parentCommentId: c.parent_id ? String(c.parent_id) : null,
              commentedAt: c.timestamp ? new Date(c.timestamp) : new Date(),
            },
            // Status is never reset on re-sync: a comment we already replied to
            // must not drop back to "pending" and get answered twice.
            $setOnInsert: {
              userId,
              commentId: String(c.id),
              status: "pending",
              source: "sync",
            },
          },
          upsert: true,
        },
      }));

    if (ops.length) {
      const result = await Comment.bulkWrite(ops, { ordered: false });
      commentsNew += result.upsertedCount || 0;
    }
  }

  account.lastSyncedAt = new Date();
  account.mediaCount = media.length || account.mediaCount;
  account.invalidatedAt = null;
  account.lastError = "";
  await account.save();

  logActivity(userId, "posts.synced", `Synced ${media.length} posts`, {
    posts: media.length,
    commentsSeen,
    commentsNew,
  });

  return { posts: media.length, commentsSeen, commentsNew, syncedAt: account.lastSyncedAt };
}

module.exports = { syncAccount };
