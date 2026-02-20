const jwt = require("jsonwebtoken");
const { env, must } = require("../config/env");

function signToken(user) {
  console.log(`Signing token for user: ${user._id}`);
  const token = jwt.sign(
    { sub: String(user._id), email: user.email },
    must(env.jwtSecret, "JWT_SECRET"),
    { expiresIn: env.jwtExpiresIn }
  );
  console.log("Token signed successfully.");
  return token;
}

function authMiddleware(req, res, next) {
  console.log("Auth middleware triggered.");
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) {
    console.log("Auth failed: Missing Authorization Bearer token.");
    return res.status(401).json({ error: "Missing Authorization Bearer token" });
  }
  try {
    const payload = jwt.verify(token, must(env.jwtSecret, "JWT_SECRET"));
    req.appUserId = payload.sub;
    console.log(`Auth success. User ID: ${req.appUserId}`);
    next();
  } catch (e) {
    console.error("Auth failed: Invalid token.", e.message);
    return res.status(401).json({ error: "Invalid token" });
  }
}

module.exports = {
  signToken,
  authMiddleware,
};
