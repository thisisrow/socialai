const express = require("express");
const cors = require("cors");
const { env } = require("./config/env");
const morgan = require("morgan");

const authRoutes = require("./routes/auth");
const instagramRoutes = require("./routes/instagram");
const postsRoutes = require("./routes/posts");
const contextRoutes = require("./routes/context");
const postStateRoutes = require("./routes/postState");
const webhookRoutes = require("./routes/webhook");
const aiTestRoutes = require("./routes/aiTest");

const app = express();
app.use(morgan("dev"));
app.use(express.json());

// CORS: allow your Vercel domain
app.use(
  cors({
    origin: env.corsOrigins,
    credentials: false,
  }),
);

console.log("Global constants initialized");

app.get("/", (req, res) => {
  res.send("Rumo Server is running.");
});

app.use(authRoutes);
app.use(instagramRoutes);
app.use(postsRoutes);
app.use(contextRoutes);
app.use(postStateRoutes);
app.use(webhookRoutes);
app.use(aiTestRoutes);

module.exports = {
  app,
};
