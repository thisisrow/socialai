const { verifyAccessToken } = require("../lib/auth");
const { User } = require("../models");
const { ApiError, asyncHandler } = require("../lib/errors");

/**
 * Every authenticated route goes through here. It sets `req.userId` and
 * `req.user`; route handlers then scope every query by `req.userId`, which is
 * what keeps one tenant's posts, comments and tokens invisible to another.
 */
const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw ApiError.unauthorized("Missing Authorization bearer token", "token_missing");

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (e) {
    const expired = e?.name === "TokenExpiredError";
    throw ApiError.unauthorized(
      expired ? "Access token expired" : "Invalid access token",
      expired ? "token_expired" : "token_invalid",
    );
  }

  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized("Account no longer exists", "user_gone");

  // Password changes and "sign out everywhere" bump tokenVersion, which
  // invalidates access tokens that are still inside their TTL.
  if ((user.tokenVersion || 0) !== (payload.v || 0)) {
    throw ApiError.unauthorized("Session is no longer valid", "token_stale");
  }

  req.userId = user._id;
  req.user = user;
  next();
});

module.exports = { requireAuth };
