const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { env } = require("../config/env");
const { RefreshToken, User } = require("../models");
const { ApiError } = require("./errors");

const BCRYPT_ROUNDS = 12;

const hashPassword = (plain) => bcrypt.hash(String(plain), BCRYPT_ROUNDS);
const verifyPassword = (plain, hash) => bcrypt.compare(String(plain), String(hash || ""));

/** Short-lived bearer token. Carries tokenVersion so a password change kills it. */
function signAccessToken(user) {
  return jwt.sign(
    { sub: String(user._id), email: user.email, v: user.tokenVersion || 0 },
    env.jwtSecret,
    { expiresIn: env.accessTokenTtl, issuer: "socialai" },
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtSecret, { issuer: "socialai" });
}

const sha256 = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");

/**
 * Issues a refresh token. `familyId` chains rotations together: if an already
 * used token is presented again (i.e. it leaked), the whole family is revoked.
 */
async function issueRefreshToken(user, { familyId, userAgent = "", ip = "" } = {}) {
  const raw = crypto.randomBytes(48).toString("base64url");
  const expiresAt = new Date(Date.now() + env.refreshTokenDays * 24 * 60 * 60 * 1000);

  await RefreshToken.create({
    userId: user._id,
    tokenHash: sha256(raw),
    familyId: familyId || crypto.randomUUID(),
    expiresAt,
    userAgent: String(userAgent).slice(0, 300),
    ip: String(ip).slice(0, 64),
  });

  return { token: raw, expiresAt };
}

/** Validates and rotates a refresh token. Throws ApiError(401) on anything suspicious. */
async function rotateRefreshToken(rawToken, { userAgent = "", ip = "" } = {}) {
  if (!rawToken) throw ApiError.unauthorized("Missing refresh token", "refresh_missing");

  const tokenHash = sha256(rawToken);
  const existing = await RefreshToken.findOne({ tokenHash });
  if (!existing) throw ApiError.unauthorized("Invalid refresh token", "refresh_invalid");

  if (existing.revokedAt) {
    // Replay of an already-rotated token: assume theft, drop every sibling.
    await RefreshToken.updateMany(
      { familyId: existing.familyId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
    throw ApiError.unauthorized("Refresh token reused, please sign in again", "refresh_reused");
  }

  if (existing.expiresAt.getTime() < Date.now()) {
    throw ApiError.unauthorized("Refresh token expired", "refresh_expired");
  }

  const user = await User.findById(existing.userId);
  if (!user) throw ApiError.unauthorized("Account no longer exists", "user_gone");

  const next = await issueRefreshToken(user, { familyId: existing.familyId, userAgent, ip });
  existing.revokedAt = new Date();
  existing.replacedByHash = sha256(next.token);
  await existing.save();

  return { user, refreshToken: next.token, accessToken: signAccessToken(user) };
}

async function revokeRefreshToken(rawToken) {
  if (!rawToken) return;
  await RefreshToken.updateOne(
    { tokenHash: sha256(rawToken) },
    { $set: { revokedAt: new Date() } },
  );
}

async function revokeAllForUser(userId) {
  await RefreshToken.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

module.exports = {
  hashPassword,
  verifyPassword,
  signAccessToken,
  verifyAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllForUser,
  sha256,
};
