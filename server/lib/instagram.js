const axios = require("axios");
const { env } = require("../config/env");

function redactToken(token) {
  if (!token) return "";
  const s = String(token);
  if (s.length <= 12) return "****";
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

async function replyToComment({ commentId, message, accessToken }) {
  console.log(`Replying to comment: ${commentId}`);
  console.log(`Using access token: ${redactToken(accessToken)}`);
  const urls = [`https://graph.instagram.com/${commentId}/replies`];
  try {
    let lastErr = null;
    for (const url of urls) {
      try {
        console.log(
          `POST ${url} message="${String(message || "").slice(0, 200)}"`,
        );
        await axios.post(url, null, {
          params: { message, access_token: accessToken },
        });
        console.log("Successfully posted reply to Instagram.");
        return;
      } catch (e) {
        lastErr = e;
        console.error(
          "Reply attempt failed:",
          url,
          e?.response?.data || e.message,
        );
      }
    }
    throw lastErr || new Error("All reply attempts failed");
  } catch (e) {
    console.error(
      "Failed to post reply to Instagram:",
      e?.response?.data || e.message,
    );
    throw e;
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
  return postId;
}

module.exports = {
  redactToken,
  replyToComment,
  extractPostId,
};
