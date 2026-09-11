const express = require("express");
const { User, AiSettings, IgAccount, logActivity } = require("../models");
const {
  hashPassword,
  verifyPassword,
  signAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllForUser,
} = require("../lib/auth");
const { requireAuth } = require("../middleware/requireAuth");
const { rateLimit } = require("../middleware/rateLimit");
const { ApiError, asyncHandler, isDuplicateKeyError } = require("../lib/errors");
const { requireEmail, requirePassword, optionalString, requireString } = require("../lib/validate");

const router = express.Router();

const requestMeta = (req) => ({
  userAgent: req.headers["user-agent"] || "",
  ip: req.ip || "",
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyPrefix: "signup",
  message: "Too many sign-up attempts. Try again in an hour.",
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyPrefix: "login",
  message: "Too many sign-in attempts. Try again in 15 minutes.",
});

const refreshLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, keyPrefix: "refresh" });

async function sessionPayload(user, req) {
  const { token: refreshToken } = await issueRefreshToken(user, requestMeta(req));
  return {
    accessToken: signAccessToken(user),
    refreshToken,
    user: user.toPublic(),
  };
}

// ---------------------------------------------------------------- sign up ---
router.post(
  "/signup",
  signupLimiter,
  asyncHandler(async (req, res) => {
    const email = requireEmail(req.body?.email);
    const password = requirePassword(req.body?.password);
    const name = optionalString(req.body?.name, "name", { max: 80 });

    const passwordHash = await hashPassword(password);

    let user;
    try {
      user = await User.create({ email, name, passwordHash, lastLoginAt: new Date() });
    } catch (e) {
      // The unique index is the real guard; a pre-check would still race.
      if (isDuplicateKeyError(e)) {
        throw ApiError.conflict("An account with that email already exists", "email_taken");
      }
      throw e;
    }

    // Give every new tenant its own settings row so the app has no null paths.
    // businessName stays blank on purpose: a person's name is not a brand name,
    // and a wrong one would end up inside the AI system prompt.
    await AiSettings.create({ userId: user._id });
    logActivity(user._id, "auth.signup", "Account created");

    res.status(201).json(await sessionPayload(user, req));
  }),
);

// ----------------------------------------------------------------- log in ---
router.post(
  "/login",
  loginLimiter,
  asyncHandler(async (req, res) => {
    const email = requireEmail(req.body?.email);
    const password = requireString(req.body?.password, "password", { trim: false });

    const user = await User.findOne({ email });
    // Same message and roughly the same work either way, so the response does
    // not reveal whether the email is registered.
    const ok = user ? await verifyPassword(password, user.passwordHash) : false;
    if (!user || !ok) throw ApiError.unauthorized("Incorrect email or password", "invalid_credentials");

    user.lastLoginAt = new Date();
    await user.save();
    logActivity(user._id, "auth.login", "Signed in");

    res.json(await sessionPayload(user, req));
  }),
);

// ---------------------------------------------------------------- refresh ---
router.post(
  "/refresh",
  refreshLimiter,
  asyncHandler(async (req, res) => {
    const presented = req.body?.refreshToken;
    const { user, accessToken, refreshToken } = await rotateRefreshToken(presented, requestMeta(req));
    res.json({ accessToken, refreshToken, user: user.toPublic() });
  }),
);

// --------------------------------------------------------------- sign out ---
router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    await revokeRefreshToken(req.body?.refreshToken);
    res.json({ ok: true });
  }),
);

router.post(
  "/logout-all",
  requireAuth,
  asyncHandler(async (req, res) => {
    await revokeAllForUser(req.userId);
    req.user.tokenVersion = (req.user.tokenVersion || 0) + 1;
    await req.user.save();
    res.json({ ok: true });
  }),
);

// ------------------------------------------------------------ current user ---
router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const instagram = await IgAccount.findOne({ userId: req.userId });
    res.json({
      user: req.user.toPublic(),
      instagram: instagram ? instagram.toPublic() : { connected: false },
    });
  }),
);

router.patch(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.body?.name !== undefined) {
      req.user.name = optionalString(req.body.name, "name", { max: 80 });
    }
    await req.user.save();
    res.json({ user: req.user.toPublic() });
  }),
);

// ---------------------------------------------------------- password change --
router.post(
  "/change-password",
  requireAuth,
  asyncHandler(async (req, res) => {
    const currentPassword = requireString(req.body?.currentPassword, "currentPassword", {
      trim: false,
    });
    const newPassword = requirePassword(req.body?.newPassword, "newPassword");

    const ok = await verifyPassword(currentPassword, req.user.passwordHash);
    if (!ok) throw ApiError.badRequest("Current password is incorrect", "invalid_credentials");

    req.user.passwordHash = await hashPassword(newPassword);
    // Bumping the version invalidates every access token already out there.
    req.user.tokenVersion = (req.user.tokenVersion || 0) + 1;
    await req.user.save();
    await revokeAllForUser(req.userId);

    // The caller is signed out along with everyone else, so hand back a fresh pair.
    res.json(await sessionPayload(req.user, req));
  }),
);

module.exports = router;
