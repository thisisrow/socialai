const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const AppUser = require("../models/AppUser");
const { must } = require("../utils/helpers");

const JWT_SECRET = process.env.JWT_SECRET;

function signToken(user) {
    console.log(`Signing token for user: ${user._id}`);
    const token = jwt.sign(
        { sub: String(user._id), email: user.email },
        must(JWT_SECRET, "JWT_SECRET"),
        { expiresIn: "30d" }
    );
    console.log("Token signed successfully.");
    return token;
}

exports.signup = async (req, res) => {
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
};

exports.login = async (req, res) => {
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
};
