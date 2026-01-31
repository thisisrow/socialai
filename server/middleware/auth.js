const jwt = require("jsonwebtoken");
const { must } = require("../utils/helpers");

const JWT_SECRET = process.env.JWT_SECRET;

function authMiddleware(req, res, next) {
    console.log("Auth middleware triggered.");
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : "";
    if (!token) {
        console.log("Auth failed: Missing Authorization Bearer token.");
        return res.status(401).json({ error: "Missing Authorization Bearer token" });
    }
    try {
        const payload = jwt.verify(token, must(JWT_SECRET, "JWT_SECRET"));
        req.appUserId = payload.sub;
        console.log(`Auth success. User ID: ${req.appUserId}`);
        next();
    } catch (e) {
        console.error("Auth failed: Invalid token.", e.message);
        return res.status(401).json({ error: "Invalid token" });
    }
}

module.exports = authMiddleware;
