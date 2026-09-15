const crypto = require("crypto");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const { env } = require("../config/env");
const { ApiError, extractErrorMessage } = require("./errors");

const GRAPH = "https://graph.instagram.com";
const OAUTH_TOKEN_URL = "https://api.instagram.com/oauth/access_token";

/** Long-lived tokens last 60 days. Refresh once inside this window. */
const REFRESH_WINDOW_MS = 10 * 24 * 60 * 60 * 1000;
const OAUTH_STATE_TTL_SECONDS = 10 * 60;

function redactToken(token) {
  if (!token) return "";
  const s = String(token);
  return s.length <= 12 ? "****" : `${s.slice(0, 6)}...${s.slice(-4)}`;
}

const graphUrl = (path) => `${GRAPH}/${env.igGraphVersion}/${path}`;

/**
 * Meta signs webhook bodies with the app secret. Without this check anyone who
 * learns the callback URL can post fake comment events and make the app reply
 * on a customer's Instagram account, so this runs before any payload is read.
 */
function verifyWebhookSignature(rawBody, signatureHeader) {
  if (!env.verifyWebhookSignature) return true;
  if (!env.instagramAppSecret) {
    console.error("[webhook] INSTAGRAM_APP_SECRET is not set - cannot verify signature.");
    return false;
  }
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  if (!rawBody || !rawBody.length) return false;

  const expected = crypto
    .createHmac("sha256", env.instagramAppSecret)
    .update(rawBody)
    .digest("hex");
  const received = signatureHeader.slice("sha256=".length);

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** True when Instagram says the token is dead, so the UI can prompt a reconnect. */
function isTokenError(e) {
  const data = e?.response?.data;
  const code = data?.error?.code ?? data?.code;
  const sub = data?.error?.error_subcode;
  return code === 190 || code === 102 || sub === 463 || sub === 467;
}

/** Step 1 of OAuth: authorization code -> short-lived token. */
async function exchangeCodeForToken({ code, redirectUri }) {
  const form = new URLSearchParams();
  form.append("client_id", String(env.instagramAppId));
  form.append("client_secret", String(env.instagramAppSecret));
  form.append("grant_type", "authorization_code");
  form.append("redirect_uri", String(redirectUri));
  form.append("code", String(code));

  const { data } = await axios.post(OAUTH_TOKEN_URL, form, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 20000,
  });

  // The response is sometimes `{data: [{...}]}` and sometimes flat.
  const payload = Array.isArray(data?.data) ? data.data[0] : data;
  const accessToken = payload?.access_token;
  const userId = payload?.user_id;
  if (!accessToken) throw ApiError.badRequest("Instagram did not return an access token", "ig_no_token");

  return { accessToken: String(accessToken), userId: userId ? String(userId) : null };
}

/** Step 2 of OAuth: short-lived token -> 60-day token. */
async function exchangeForLongLivedToken(shortLivedToken) {
  const { data } = await axios.get(`${GRAPH}/access_token`, {
    params: {
      grant_type: "ig_exchange_token",
      client_secret: env.instagramAppSecret,
      access_token: shortLivedToken,
    },
    timeout: 20000,
  });

  if (!data?.access_token) {
    throw ApiError.badRequest("Instagram did not return a long-lived token", "ig_no_long_token");
  }
  return {
    accessToken: String(data.access_token),
    tokenType: data.token_type || "bearer",
    expiresAt: Number.isFinite(data.expires_in)
      ? new Date(Date.now() + Number(data.expires_in) * 1000)
      : null,
  };
}

async function refreshLongLivedToken(accessToken) {
  const { data } = await axios.get(`${GRAPH}/refresh_access_token`, {
    params: { grant_type: "ig_refresh_token", access_token: accessToken },
    timeout: 20000,
  });
  if (!data?.access_token) throw ApiError.badRequest("Instagram token refresh failed", "ig_refresh_failed");
  return {
    accessToken: String(data.access_token),
    expiresAt: Number.isFinite(data.expires_in)
      ? new Date(Date.now() + Number(data.expires_in) * 1000)
      : null,
  };
}

/**
 * Profile lookup right after connect. `user_id` here is the professional
 * account id that webhook events arrive under as `entry[].id` - capturing it
 * now is what makes webhook routing deterministic instead of guesswork.
 */
async function fetchProfile(accessToken) {
  const { data } = await axios.get(graphUrl("me"), {
    params: {
      fields: "id,user_id,username,name,account_type,profile_picture_url,followers_count,media_count",
      access_token: accessToken,
    },
    timeout: 20000,
  });
  return {
    igUserId: data?.id ? String(data.id) : null,
    igBusinessId: data?.user_id ? String(data.user_id) : null,
    username: data?.username || "",
    name: data?.name || "",
    accountType: data?.account_type || "",
    profilePictureUrl: data?.profile_picture_url || "",
    followersCount: Number(data?.followers_count) || 0,
    mediaCount: Number(data?.media_count) || 0,
  };
}

async function fetchMedia(accessToken, { limit = 25 } = {}) {
  const { data } = await axios.get(graphUrl("me/media"), {
    params: {
      fields:
        "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
      access_token: accessToken,
      limit,
    },
    timeout: 25000,
  });
  return data?.data || [];
}

async function fetchComments(accessToken, mediaId, { limit = 50 } = {}) {
  const { data } = await axios.get(graphUrl(`${mediaId}/comments`), {
    params: {
      fields: "id,text,username,timestamp,from,parent_id,replies{id}",
      access_token: accessToken,
      limit,
    },
    timeout: 20000,
  });
  return data?.data || [];
}

async function replyToComment({ commentId, message, accessToken }) {
  const { data } = await axios.post(graphUrl(`${commentId}/replies`), null, {
    params: { message, access_token: accessToken },
    timeout: 20000,
  });
  return data?.id ? String(data.id) : "";
}

/**
 * Returns a usable access token for an account, refreshing it in place when it
 * is inside the renewal window. Call this instead of reading `acct.accessToken`.
 */
async function ensureFreshToken(igAccount) {
  const expiresAt = igAccount.tokenExpiresAt ? new Date(igAccount.tokenExpiresAt).getTime() : 0;
  const needsRefresh = expiresAt > 0 && expiresAt - Date.now() < REFRESH_WINDOW_MS;
  if (!needsRefresh) return igAccount.accessToken;

  try {
    const refreshed = await refreshLongLivedToken(igAccount.accessToken);
    igAccount.accessToken = refreshed.accessToken;
    igAccount.tokenExpiresAt = refreshed.expiresAt;
    igAccount.lastRefreshedAt = new Date();
    igAccount.invalidatedAt = null;
    igAccount.lastError = "";
    await igAccount.save();
    console.log(`[instagram] refreshed token for @${igAccount.username || igAccount.igUserId}`);
  } catch (e) {
    // A refresh failure is not fatal on its own; the current token may still work.
    console.error("[instagram] token refresh failed:", extractErrorMessage(e));
  }
  return igAccount.accessToken;
}

/** Records a token failure on the account so the UI can surface "reconnect". */
async function markAccountInvalid(igAccount, error) {
  igAccount.invalidatedAt = new Date();
  igAccount.lastError = extractErrorMessage(error).slice(0, 300);
  await igAccount.save().catch(() => {});
}

function buildAuthorizeUrl({ redirectUri, scopes, state }) {
  const params = new URLSearchParams({
    client_id: String(env.instagramAppId || ""),
    redirect_uri: String(redirectUri || ""),
    response_type: "code",
    scope: scopes.join(","),
    force_reauth: "true",
  });
  if (state) params.set("state", state);
  return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
}

/**
 * Bind an Instagram OAuth attempt to the signed-in SocialAI user and the exact
 * redirect URI. This prevents a code obtained in one browser/session from
 * being attached to a different SocialAI account (login CSRF/account linking).
 */
function createOAuthState({ userId, redirectUri }) {
  return jwt.sign(
    {
      sub: String(userId),
      redirectUri: String(redirectUri),
      purpose: "instagram-connect",
    },
    env.jwtSecret,
    {
      expiresIn: OAUTH_STATE_TTL_SECONDS,
      issuer: "socialai",
      audience: "instagram-oauth",
    },
  );
}

function verifyOAuthState(state, { userId, redirectUri }) {
  try {
    const payload = jwt.verify(String(state || ""), env.jwtSecret, {
      issuer: "socialai",
      audience: "instagram-oauth",
    });
    if (
      payload.purpose !== "instagram-connect" ||
      payload.sub !== String(userId) ||
      payload.redirectUri !== String(redirectUri)
    ) {
      throw new Error("OAuth state does not match this connection attempt");
    }
    return payload;
  } catch {
    throw ApiError.badRequest(
      "Instagram connection expired or is invalid. Please try connecting again.",
      "ig_oauth_state_invalid",
    );
  }
}

/** Instagram nests the media id differently depending on the webhook topic. */
function extractMediaId(value) {
  const id =
    value?.media?.id ||
    value?.media_id ||
    value?.post_id ||
    value?.mediaId ||
    value?.object_id ||
    null;
  return id ? String(id) : null;
}

module.exports = {
  GRAPH,
  redactToken,
  verifyWebhookSignature,
  isTokenError,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  refreshLongLivedToken,
  fetchProfile,
  fetchMedia,
  fetchComments,
  replyToComment,
  ensureFreshToken,
  markAccountInvalid,
  buildAuthorizeUrl,
  createOAuthState,
  verifyOAuthState,
  extractMediaId,
};
