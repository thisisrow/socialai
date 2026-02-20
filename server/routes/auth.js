const express = require("express");
const bcrypt = require("bcrypt");
const { AppUser, IgAccount } = require("../db");
const { signToken, authMiddleware } = require("../lib/auth");

const router = express.Router();

router.post("/api/auth/signup", async (req, res) => {
  console.log("POST /api/auth/signup called.");
  try {
    const { email, password } = req.body || {};
    console.log(`Signup attempt for email: ${email}`);
    if (!email || !password) {
      console.log("Signup failed: email or password missing.");
      return res.status(400).json({ error: "email and password required" });
    }
    if (String(password).length < 6) {
      console.log("Signup failed: password too short.");
      return res.status(400).json({ error: "password must be 6+ characters" });
    }

    const existing = await AppUser.findOne({ email: String(email).toLowerCase() }).lean();
    if (existing) {
      console.log("Signup failed: email already registered.");
      return res.status(409).json({ error: "email already registered" });
    }

    console.log("Hashing password...");
    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await AppUser.create({ email: String(email).toLowerCase(), passwordHash });
    console.log(`User created with ID: ${user._id}`);

    const token = signToken(user);
    return res.json({ ok: true, token, user: { id: String(user._id), email: user.email } });
  } catch (e) {
    console.error("Signup error:", e.message);
    return res.status(500).json({ error: e.message });
  }
});

router.post("/api/auth/login", async (req, res) => {
  console.log("POST /api/auth/login called.");
  try {
    const { email, password } = req.body || {};
    console.log(`Login attempt for email: ${email}`);
    if (!email || !password) {
      console.log("Login failed: email or password missing.");
      return res.status(400).json({ error: "email and password required" });
    }

    const user = await AppUser.findOne({ email: String(email).toLowerCase() });
    if (!user) {
      console.log("Login failed: invalid credentials (user not found).");
      return res.status(401).json({ error: "invalid credentials" });
    }

    console.log("Comparing password...");
    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) {
      console.log("Login failed: invalid credentials (password mismatch).");
      return res.status(401).json({ error: "invalid credentials" });
    }

    console.log("Login successful.");
    const token = signToken(user);
    return res.json({ ok: true, token, user: { id: String(user._id), email: user.email } });
  } catch (e) {
    console.error("Login error:", e.message);
    return res.status(500).json({ error: e.message });
  }
});

router.get("/api/me", authMiddleware, async (req, res) => {
  console.log(`GET /api/me called for user: ${req.appUserId}`);
  const user = await AppUser.findById(req.appUserId).lean();
  if (!user) {
    console.log("GET /api/me: user not found.");
    return res.status(404).json({ error: "user not found" });
  }
  const ig = await IgAccount.findOne({ appUserId: user._id }).lean();
  console.log(`GET /api/me: Found user. Instagram connected: ${!!ig}`);
  return res.json({
    ok: true,
    user: { id: String(user._id), email: user.email },
    instagramConnected: !!ig,
    basicUserId: ig?.basicUserId || null,
    igBusinessId: ig?.igBusinessId || null,
  });
});

module.exports = router;
