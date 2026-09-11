const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { env } = require("./config/env");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");
const { rateLimit } = require("./middleware/rateLimit");

const authRoutes = require("./routes/auth");
const { router: instagramRoutes } = require("./routes/instagram");
const postsRoutes = require("./routes/posts");
const commentsRoutes = require("./routes/comments");
const aiRoutes = require("./routes/ai");
const statsRoutes = require("./routes/stats");
const webhookRoutes = require("./routes/webhook");

const app = express();

// Required for correct req.ip behind Vercel / Render / Railway / nginx.
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

app.use(
  cors({
    origin(origin, callback) {
      // No Origin header: curl, server-to-server, and Meta's webhook POSTs.
      if (!origin) return callback(null, true);
      if (env.corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: false,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.use(
  express.json({
    limit: "1mb",
    // Keep the exact bytes so the webhook HMAC can be checked; re-serialising
    // the parsed object would change the signature.
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.get("/", (_req, res) => {
  res.json({ name: "SocialAI API", status: "ok", version: "2.0.0" });
});

app.get("/health", (_req, res) => {
  const mongoose = require("mongoose");
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  res.json({
    status: "ok",
    uptime: Math.round(process.uptime()),
    database: states[mongoose.connection.readyState] || "unknown",
    ai: env.anthropicApiKey ? "configured" : "missing_key",
    model: env.claudeModel,
  });
});

// Webhooks are unauthenticated by design (Meta calls them) and verified by HMAC,
// so they are mounted before the general API limiter.
app.use("/api/webhook", webhookRoutes);

app.use("/api", rateLimit({ windowMs: 60 * 1000, max: 240, keyPrefix: "api" }));

app.use("/api/auth", authRoutes);
app.use("/api/instagram", instagramRoutes);
app.use("/api/posts", postsRoutes);
app.use("/api/comments", commentsRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/stats", statsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = { app };
